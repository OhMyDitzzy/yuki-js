import {
  DEFAULT_CONNECTION_CONFIG,
  md5,
  toNumber,
  updateMessageWithReceipt,
  updateMessageWithReaction,
  jidDecode,
  jidNormalizedUser,
  proto
} from "baileys";
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import KeyedDB from "@adiwajshing/keyed-db";

/**
 * @typedef {import('baileys').WASocket} WASocket
 * @typedef {import('baileys').Chat} Chat
 * @typedef {import('baileys').Contact} Contact
 * @typedef {import('baileys').GroupMetadata} GroupMetadata
 * @typedef {import('baileys').PresenceData} PresenceData
 * @typedef {import('baileys').WAMessage} WAMessage
 * @typedef {import('baileys').WAMessageKey} WAMessageKey
 * @typedef {import('baileys').MessageUserReceipt} MessageUserReceipt
 * @typedef {import('baileys').BaileysEventEmitter} BaileysEventEmitter
 * @typedef {import('baileys').ConnectionState} ConnectionState
 */

export const LabelAssociationType = {
  Chat: "label_jid",
  Message: "label_message"
};

class ObjectRepository {
  constructor(entities = {}) {
    this.entityMap = new Map(Object.entries(entities));
  }

  findById(id) {
    return this.entityMap.get(id);
  }

  findAll() {
    return Array.from(this.entityMap.values());
  }

  upsertById(id, entity) {
    return this.entityMap.set(id, { ...entity });
  }

  deleteById(id) {
    return this.entityMap.delete(id);
  }

  count() {
    return this.entityMap.size;
  }

  toJSON() {
    return this.findAll();
  }
}

function makeOrderedDictionary(idGetter) {
  const array = [];
  const dict = {};

  const get = (id) => dict[id];

  const update = (item) => {
    const id = idGetter(item);
    const idx = array.findIndex(i => idGetter(i) === id);
    if (idx >= 0) {
      array[idx] = item;
      dict[id] = item;
      return true;
    }
    return false;
  };

  const upsert = (item, mode) => {
    const id = idGetter(item);
    if (get(id)) {
      update(item);
    } else {
      if (mode === 'append') {
        array.push(item);
      } else {
        array.splice(0, 0, item);
      }
      dict[id] = item;
    }
  };

  const remove = (item) => {
    const id = idGetter(item);
    const idx = array.findIndex(i => idGetter(i) === id);
    if (idx >= 0) {
      array.splice(idx, 1);
      delete dict[id];
      return true;
    }
    return false;
  };

  return {
    array,
    get,
    upsert,
    update,
    remove,
    updateAssign: (id, update) => {
      const item = get(id);
      if (item) {
        Object.assign(item, update);
        delete dict[id];
        dict[idGetter(item)] = item;
        return true;
      }
      return false;
    },
    clear: () => {
      array.splice(0, array.length);
      for (const key of Object.keys(dict)) {
        delete dict[key];
      }
    },
    filter: (contain) => {
      let i = 0;
      while (i < array.length) {
        if (!contain(array[i])) {
          delete dict[idGetter(array[i])];
          array.splice(i, 1);
        } else {
          i += 1;
        }
      }
    },
    toJSON: () => array,
    fromJSON: (newItems) => {
      array.splice(0, array.length, ...newItems);
    }
  };
}

export const waChatKey = (pin) => ({
  key: (c) =>
    (pin ? (c.pinned ? '1' : '0') : '') +
    (c.archived ? '0' : '1') +
    (c.conversationTimestamp ? c.conversationTimestamp.toString(16).padStart(8, '0') : '') +
    c.id,
  compare: (k1, k2) => k2.localeCompare(k1)
});

export const waMessageID = (m) => m.key.id || '';

export const waLabelAssociationKey = {
  key: (la) =>
    la.type === LabelAssociationType.Chat
      ? la.chatId + la.labelId
      : la.chatId + la.messageId + la.labelId,
  compare: (k1, k2) => k2.localeCompare(k1)
};

const makeMessagesDictionary = () => makeOrderedDictionary(waMessageID);

function initializeDatabase(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS store_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_key ON store_data(key)`);

  return db;
}

export const makeInMemoryStore = async (config) => {
  const socket = config.socket;
  const chatKey = config.chatKey || waChatKey(true);
  const labelAssociationKey = config.labelAssociationKey || waLabelAssociationKey;
  const logger = config.logger || DEFAULT_CONNECTION_CONFIG.logger.child({ stream: 'in-mem-store' });
  const saveInterval = config.saveInterval || 60000;

  const STORE_PATH = path.join(process.cwd(), 'data', 'store.db');
  let saveIntervalId = null;
  let db = null;

  try {
    db = initializeDatabase(STORE_PATH);
    logger.info({ path: STORE_PATH }, 'SQLite database initialized');
  } catch (e) {
    logger.error({ error: e }, 'Failed to initialize database');
  }

  const chats = new KeyedDB.default(chatKey, (c) => c.id);
  const messages = {};
  const contacts = {};
  const groupMetadata = {};
  const presences = {};
  const state = { connection: 'close' };
  const labels = new ObjectRepository();
  const labelAssociations = new KeyedDB.default(labelAssociationKey, labelAssociationKey.key);

  const assertMessageList = (jid) => {
    if (!messages[jid]) {
      messages[jid] = makeMessagesDictionary();
    }
    return messages[jid];
  };

  const contactsUpsert = (newContacts) => {
    const oldContacts = new Set(Object.keys(contacts));
    for (const contact of newContacts) {
      oldContacts.delete(contact.id);
      contacts[contact.id] = Object.assign(contacts[contact.id] || {}, contact);
    }
    return oldContacts;
  };

  const labelsUpsert = (newLabels) => {
    for (const label of newLabels) {
      labels.upsertById(label.id, label);
    }
  };

  const bind = (ev) => {
    ev.on('connection.update', update => {
      Object.assign(state, update);
    });

    ev.on('messaging-history.set', ({ chats: newChats, contacts: newContacts, messages: newMessages, isLatest, syncType }) => {
      if (syncType === proto.HistorySync.HistorySyncType.ON_DEMAND) {
        return;
      }

      if (isLatest) {
        chats.clear();
        for (const id in messages) {
          delete messages[id];
        }
      }

      const chatsAdded = chats.insertIfAbsent(...newChats).length;
      logger.debug({ chatsAdded }, 'synced chats');

      const oldContacts = contactsUpsert(newContacts);
      if (isLatest) {
        const oldContactsArray = Array.from(oldContacts);
        for (const jid of oldContactsArray) {
          delete contacts[jid];
        }
      }

      logger.debug({ deletedContacts: isLatest ? oldContacts.size : 0, newContacts }, 'synced contacts');

      for (const msg of newMessages) {
        const jid = msg.key.remoteJid;
        const list = assertMessageList(jid);
        list.upsert(msg, 'prepend');
      }

      logger.debug({ messages: newMessages.length }, 'synced messages');
    });

    ev.on('contacts.upsert', contacts => {
      contactsUpsert(contacts);
    });

    ev.on('contacts.update', async (updates) => {
      for (const update of updates) {
        let contact;

        if (contacts[update.id]) {
          contact = contacts[update.id];
        } else {
          const contactHashes = await Promise.all(
            Object.keys(contacts).map(async (contactId) => {
              const { user } = jidDecode(contactId);
              return [contactId, (await md5(Buffer.from(user + 'WA_ADD_NOTIF', 'utf8'))).toString('base64').slice(0, 3)];
            })
          );
          contact = contacts[contactHashes.find(([, b]) => b === update.id?.[0])?.[0] || ''];
        }

        if (contact) {
          if (update.imgUrl === 'changed') {
            contact.imgUrl = socket ? await socket.profilePictureUrl(contact.id) : undefined;
          } else if (update.imgUrl === 'removed') {
            delete contact.imgUrl;
          }
        } else {
          return logger.debug({ update }, 'got update for non-existant contact');
        }

        Object.assign(contacts[contact.id], contact);
      }
    });

    ev.on('chats.upsert', newChats => {
      chats.upsert(...newChats);
    });

    ev.on('chats.update', updates => {
      for (let update of updates) {
        const result = chats.update(update.id, (chat) => {
          if (update.unreadCount > 0) {
            update = { ...update };
            update.unreadCount = (chat.unreadCount || 0) + update.unreadCount;
          }
          Object.assign(chat, update);
        });

        if (!result) {
          logger.debug({ update }, 'got update for non-existant chat');
        }
      }
    });

    ev.on('labels.edit', (label) => {
      if (label.deleted) {
        return labels.deleteById(label.id);
      }

      if (labels.count() < 20) {
        return labels.upsertById(label.id, label);
      }

      logger.error('Labels count exceed');
    });

    ev.on('labels.association', ({ type, association }) => {
      switch (type) {
        case 'add':
          labelAssociations.upsert(association);
          break;
        case 'remove':
          labelAssociations.delete(association);
          break;
        default:
          console.error(`unknown operation type [${type}]`);
      }
    });

    ev.on('presence.update', ({ id, presences: update }) => {
      presences[id] = presences[id] || {};
      Object.assign(presences[id], update);
    });

    ev.on('chats.delete', deletions => {
      for (const item of deletions) {
        if (chats.get(item)) {
          chats.deleteById(item);
        }
      }
    });

    ev.on('messages.upsert', ({ messages: newMessages, type }) => {
      switch (type) {
        case 'append':
        case 'notify':
          for (const msg of newMessages) {
            const jid = jidNormalizedUser(msg.key.remoteJid);
            const list = assertMessageList(jid);
            list.upsert(msg, 'append');

            if (type === 'notify' && !chats.get(jid)) {
              ev.emit('chats.upsert', [
                {
                  id: jid,
                  conversationTimestamp: toNumber(msg.messageTimestamp),
                  unreadCount: 1
                }
              ]);
            }
          }
          break;
      }
    });

    ev.on('messages.update', updates => {
      for (const { update, key } of updates) {
        const list = assertMessageList(jidNormalizedUser(key.remoteJid));

        if (update?.status) {
          const listStatus = list.get(key.id)?.status;
          if (listStatus && update?.status <= listStatus) {
            logger.debug({ update, storedStatus: listStatus }, 'status stored newer then update');
            delete update.status;
            logger.debug({ update }, 'new update object');
          }
        }

        const result = list.updateAssign(key.id, update);
        if (!result) {
          logger.debug({ update }, 'got update for non-existent message');
        }
      }
    });

    ev.on('messages.delete', item => {
      if ('all' in item) {
        const list = messages[item.jid];
        list?.clear();
      } else {
        const jid = item.keys[0]?.remoteJid;
        const list = messages[jid];
        if (list) {
          const idSet = new Set(item.keys.map(k => k.id));
          list.filter(m => !idSet.has(m.key.id));
        }
      }
    });

    ev.on('groups.update', updates => {
      for (const update of updates) {
        const id = update.id;
        if (groupMetadata[id]) {
          Object.assign(groupMetadata[id], update);
        } else {
          logger.debug({ update }, 'got update for non-existant group metadata');
        }
      }
    });

    ev.on('group-participants.update', ({ id, participants, action }) => {
      const metadata = groupMetadata[id];
      if (metadata) {
        switch (action) {
          case 'add':
            metadata.participants.push(
              ...participants.map(participantId => ({
                id: participantId,
                isAdmin: false,
                isSuperAdmin: false
              }))
            );
            break;
          case 'demote':
          case 'promote':
            for (const participant of metadata.participants) {
              if (participants.includes(participant.id)) {
                participant.isAdmin = action === 'promote';
              }
            }
            break;
          case 'remove':
            metadata.participants = metadata.participants.filter(
              p => !participants.includes(p.id)
            );
            break;
        }
      }
    });

    ev.on('message-receipt.update', updates => {
      for (const { key, receipt } of updates) {
        const obj = messages[key.remoteJid];
        const msg = obj?.get(key.id);
        if (msg) {
          updateMessageWithReceipt(msg, receipt);
        }
      }
    });

    ev.on('messages.reaction', (reactions) => {
      for (const { key, reaction } of reactions) {
        const obj = messages[key.remoteJid];
        const msg = obj?.get(key.id);
        if (msg) {
          updateMessageWithReaction(msg, reaction);
        }
      }
    });
  };

  const toJSON = () => ({
    chats,
    contacts,
    messages,
    labels,
    labelAssociations
  });

  const fromJSON = (json) => {
    chats.upsert(...json.chats);
    labelAssociations.upsert(...(json.labelAssociations || []));
    contactsUpsert(Object.values(json.contacts));
    labelsUpsert(Object.values(json.labels || {}));

    for (const jid in json.messages) {
      const list = assertMessageList(jid);
      for (const msg of json.messages[jid]) {
        list.upsert(proto.WebMessageInfo.fromObject(msg), 'append');
      }
    }
  };

  const writeToDatabase = () => {
    if (!db) {
      logger.error('Database not initialized');
      return;
    }

    try {
      const data = toJSON();
      const jsonString = JSON.stringify(data);
      const timestamp = Date.now();

      const transaction = db.transaction(() => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO store_data (key, value, updated_at)
          VALUES (?, ?, ?)
        `);

        stmt.run('store', jsonString, timestamp);
      });

      transaction();

      logger.debug('Store saved to SQLite database');
    } catch (e) {
      logger.error({ error: e }, 'Failed to save store to database');
    }
  };

  const readFromDatabase = () => {
    if (!db) {
      logger.error('Database not initialized');
      return;
    }

    try {
      const stmt = db.prepare('SELECT value FROM store_data WHERE key = ?');
      const row = stmt.get('store');

      if (row) {
        const json = JSON.parse(row.value);
        fromJSON(json);
        logger.info('Store loaded from SQLite database');
      } else {
        logger.debug('No existing store data found in database');
      }
    } catch (e) {
      logger.error({ error: e }, 'Failed to load store from database');
    }
  };

  const startAutoSave = () => {
    if (saveIntervalId) {
      logger.warn('Auto-save already running');
      return;
    }

    logger.info({ interval: saveInterval }, 'Starting auto-save to SQLite');

    saveIntervalId = setInterval(() => {
      writeToDatabase();
    }, saveInterval);
  };

  const stopAutoSave = () => {
    if (saveIntervalId) {
      clearInterval(saveIntervalId);
      saveIntervalId = null;
      logger.info('Auto-save stopped');
    }
  };

  const cleanup = async () => {
    stopAutoSave();

    // We save it first before cleaning (optional, can be deleted if we want a full cleanup)
    // writeToDatabase();
    chats.clear();
    labelAssociations.clear();

    for (const jid in messages) {
      delete messages[jid];
    }

    for (const jid in contacts) {
      delete contacts[jid];
    }

    for (const jid in groupMetadata) {
      delete groupMetadata[jid];
    }

    for (const jid in presences) {
      delete presences[jid];
    }

    labels.entityMap.clear();

    if (db) {
      try {
        db.close();
        db = null;
        logger.info('Database connection closed');
      } catch (e) {
        logger.error({ error: e }, 'Failed to close database');
      }
    }

    try {
      if (fs.existsSync(STORE_PATH)) {
        fs.unlinkSync(STORE_PATH);
        logger.info({ path: STORE_PATH }, 'Store database file deleted');
      }

      const walPath = STORE_PATH + '-wal';
      const shmPath = STORE_PATH + '-shm';

      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
      }
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
      }
    } catch (e) {
      logger.error({ error: e }, 'Failed to delete store database files');
    }

    try {
      db = initializeDatabase(STORE_PATH);
      logger.info({ path: STORE_PATH }, 'Store reinitialized with fresh database');

      startAutoSave();
    } catch (e) {
      logger.error({ error: e }, 'Failed to reinitialize database after cleanup');
    }
  };

  return {
    chats,
    contacts,
    messages,
    groupMetadata,
    state,
    presences,
    labels,
    labelAssociations,
    bind,

    loadMessages: async (jid, count, cursor) => {
      const list = assertMessageList(jid);
      const mode = !cursor || 'before' in cursor ? 'before' : 'after';
      const cursorKey = cursor ? ('before' in cursor ? cursor.before : cursor.after) : undefined;
      const cursorValue = cursorKey ? list.get(cursorKey.id) : undefined;

      let msgs;

      if (list && mode === 'before' && (!cursorKey || cursorValue)) {
        if (cursorValue) {
          const msgIdx = list.array.findIndex(m => m.key.id === cursorKey?.id);
          msgs = list.array.slice(0, msgIdx);
        } else {
          msgs = list.array;
        }

        const diff = count - msgs.length;
        if (diff < 0) {
          msgs = msgs.slice(-count);
        }
      } else {
        msgs = [];
      }

      return msgs;
    },

    getLabels: () => labels,

    getChatLabels: (chatId) => {
      return labelAssociations.filter((la) => la.chatId === chatId).all();
    },

    getMessageLabels: (messageId) => {
      const associations = labelAssociations
        .filter((la) => la.messageId === messageId)
        .all();
      return associations.map(({ labelId }) => labelId);
    },

    loadMessage: async (jid, id) => messages[jid]?.get(id),

    mostRecentMessage: async (jid) => {
      const message = messages[jid]?.array.slice(-1)[0];
      return message;
    },

    fetchImageUrl: async (jid, socket) => {
      const contact = contacts[jid];
      if (!contact) {
        return socket?.profilePictureUrl(jid);
      }
      if (typeof contact.imgUrl === 'undefined') {
        contact.imgUrl = await socket?.profilePictureUrl(jid);
      }
      return contact.imgUrl;
    },

    fetchGroupMetadata: async (jid, socket) => {
      if (!groupMetadata[jid]) {
        const metadata = await socket?.groupMetadata(jid);
        if (metadata) {
          groupMetadata[jid] = metadata;
        }
      }
      return groupMetadata[jid];
    },

    fetchMessageReceipts: async ({ remoteJid, id }) => {
      const list = messages[remoteJid];
      const msg = list?.get(id);
      return msg?.userReceipt;
    },

    toJSON,
    fromJSON,
    writeToDatabase,
    readFromDatabase,
    startAutoSave,
    stopAutoSave,
    cleanup
  };
};
