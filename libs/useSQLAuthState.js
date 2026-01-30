import { initAuthCreds, proto, BufferJSON } from 'baileys';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, statSync } from 'fs';
import { dirname } from 'path';

const dbInstances = new Map();

function getOrCreateDbInstance(dbPath, tableName) {
  let instance = dbInstances.get(dbPath);
  
  if (!instance) {
    const db = new Database(dbPath);
    
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000');
    db.pragma('temp_store = MEMORY');
    db.pragma('busy_timeout = 5000');

    db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    instance = {
      db,
      tableName,
      refCount: 0
    };
    
    dbInstances.set(dbPath, instance);
  }
  
  instance.refCount++;
  return instance;
}

export async function useSQLiteAuthState(config) {
  const dbPath = typeof config === 'string' ? config : config.dbPath;
  const tableName = typeof config === 'object' ? config.tableName || 'auth_state' : 'auth_state';

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const instance = getOrCreateDbInstance(dbPath, tableName);
  const { db } = instance;

  // Prepared statements
  const insertStmt = db.prepare(`
    INSERT INTO ${tableName} (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  
  const selectStmt = db.prepare(`SELECT value FROM ${tableName} WHERE key = ?`);
  const deleteStmt = db.prepare(`DELETE FROM ${tableName} WHERE key = ?`);

  const writeData = (key, data) => {
    try {
      const json = JSON.stringify(data, BufferJSON.replacer);
      insertStmt.run(key, json);
    } catch (error) {
      console.error(`Error writing key ${key}:`, error);
    }
  };

  const readData = (key) => {
    try {
      const row = selectStmt.get(key);
      if (!row) return null;

      return JSON.parse(row.value, BufferJSON.reviver);
    } catch (error) {
      console.error(`Error reading key ${key}:`, error);
      return null;
    }
  };

  const removeData = (key) => {
    try {
      deleteStmt.run(key);
    } catch (error) {
      console.error(`Error removing key ${key}:`, error);
    }
  };

  let creds = readData('creds') || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};

          ids.forEach((id) => {
            const key = `${type}-${id}`;
            let value = readData(key);

            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }

            data[id] = value;
          });

          return data;
        },

        set: async (data) => {
          const transaction = db.transaction(() => {
            for (const category in data) {
              for (const id in data[category]) {
                const value = data[category][id];
                const key = `${category}-${id}`;

                if (value) {
                  writeData(key, value);
                } else {
                  removeData(key);
                }
              }
            }
          });

          try {
            transaction();
          } catch (error) {
            console.error('Transaction failed:', error);
          }
        }
      }
    },

    saveCreds: async () => {
      const transaction = db.transaction(() => {
        writeData('creds', creds);
      });

      try {
        transaction();
      } catch (error) {
        console.error('Error saving creds:', error);
      }
    },

    clearState: () => {
      try {
        db.exec(`DELETE FROM ${tableName}`);
        creds = initAuthCreds();
      } catch (error) {
        console.error('Error clearing state:', error);
      }
    }
  };
}

export function closeSQLiteAuthState(dbPath) {
  try {
    const instance = dbInstances.get(dbPath);
    if (!instance) return;

    instance.refCount--;

    if (instance.refCount <= 0) {
      try {
        instance.db.pragma('optimize');
        instance.db.close();
      } catch (e) {
        console.error('Error closing database:', e);
      }

      dbInstances.delete(dbPath);
    }
  } catch (error) {
    console.error('Error closing database:', error);
  }
}

export function getAuthStateStats(dbPath) {
  try {
    if (!existsSync(dbPath)) {
      return { totalKeys: 0, size: 0, credsExists: false };
    }

    const db = new Database(dbPath, { readonly: true });
    
    const countResult = db.prepare('SELECT COUNT(*) as count FROM auth_state').get();
    const totalKeys = countResult.count;

    const credsResult = db.prepare('SELECT key FROM auth_state WHERE key = ?').get('creds');
    const credsExists = !!credsResult;

    db.close();

    const size = statSync(dbPath).size;

    return { totalKeys, size, credsExists };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { totalKeys: 0, size: 0, credsExists: false };
  }
}