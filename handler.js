import { initializeDatabase } from "./libs/database-initializer.js";
import { smsg } from "./libs/simple.js"
import util from "util";

const isNumber = (x) => typeof x === 'number' && !isNaN(x)
const delay = (ms) => isNumber(ms) && new Promise(resolve => setTimeout(resolve, ms))

/** @param {import("baileys").BaileysEventMap["messages.upsert"]} chatUpdate  */
export async function handler(chatUpdate) {
  this.msgqueque = this.msgqueque || [];
  if (!chatUpdate) return;
  this.pushMessage(chatUpdate.messages).catch(console.error);

  let m = chatUpdate.messages[chatUpdate.messages.length - 1];

  if (!m) return;
  if (global.db.data === null) await loadDatabase();

  try {
    m = smsg(this, m);
    if (!m) return;
    m.exp = 0;
    m.limit = false;

    try {
      initializeDatabase(m, this.user.lid);
    } catch (e) {
      console.error(e);
    }

    if (opts["self"]) {
      m.exp = 0;
      m.limit = false;
    }
    if (opts["nyimak"]) return;
    if (opts["self"] && !m.fromMe && !global.db.data.users[m.sender].moderator) return
    if (opts["autoread"]) await this.readMessages([m.key]);
    if (opts["pconly"] && m.chat.endsWith('g.us')) return;
    if (opts["gconly"] && !m.fromMe && !m.chat.endsWith("g.us") && !global.db.data.users[m.sender].premium) return conn.sendMessage(m.chat, { text: `Bot Access to Private Chat Denied` }, { quoted: m });
    if (opts['swonly'] && m.chat !== 'status@broadcast') return;
    if (typeof m.text !== 'string') m.text = '';
    const body = typeof m.text == 'string' ? m.text : false;
    const isROwner = [conn.decodeJid(global.conn.user.id), ...global.owner.map(([number]) => number)].map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.isGroup ? m.key.participantAlt ?? m.key.participant : m.key.remoteJidAlt ?? m.key.remoteJid)
    const isOwner = isROwner || m.fromMe
    const isMods = isOwner || global.mods.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.isGroup ? m.key.participantAlt ?? m.key.participant : m.key.remoteJidAlt ?? m.key.remoteJid)
    const isPrems = isROwner || global.db.data.users[m.sender].premiumDate > 0;

    const groupMetadata = (m.isGroup ? (conn.chats[m.chat] || {}).metadata : {}) || {};
    const participants = (m.isGroup ? groupMetadata.participants : []) || [];

    const user = (m.isGroup ? participants.find(u => u.id === m.sender) : {})
    const bot = (m.isGroup ? participants.find(u => u.id === this.user.lid.split('@')[0].split(':')[0] + "@lid") : {}) || {};

    const isRAdmin = user && user.admin == 'superadmin' || false
    const isAdmin = isRAdmin || user && user.admin == 'admin' || false // Is User Admin?
    const isBotAdmin = bot && bot.admin || false // Are you Admin?
    const isBans = global.db.data.users[m.sender].banned;
    if (isROwner) {
      db.data.users[m.sender].premium = true;
      db.data.users[m.sender].premiumDate = "infinity";
      db.data.users[m.sender].limit = "infinity";
      db.data.users[m.sender].moderator = true;
    }

    if (opts['queque'] && m.text && !(isMods || isPrems)) {
      let queque = this.msgqueque, time = 1000 * 5
      const previousID = queque[queque.length - 1]
      queque.push(m.id || m.key.id)
      setInterval(async function() {
        if (queque.indexOf(previousID) === -1) clearInterval(this)
        else await delay(time)
      }, time)
    }
    let _user = global.db.data && global.db.data.users && global.db.data.users[m.sender]

    m.exp += Math.ceil(Math.random() * 10);
    let usedPrefix;

    for (let name in global.plugins) {
      let plugin = global.plugins[name]
      if (!plugin) continue;
      if (typeof plugin.all === "function") {
        try {
          await plugin.all.call(this, m, chatUpdate);
        } catch (e) {
          console.error(e)
        }
      }

      if (!opts['restrict']) if (plugin.tags && plugin.tags.includes('admin')) {
        continue
      }

      const str2Regex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
      let _prefix = plugin.customPrefix ? plugin.customPrefix : conn.prefix ? conn.prefix : global.prefix;
      const usePrefix = plugin.usePrefix !== false;
      let match;

      const prefixMatch = (_prefix instanceof RegExp ?
        [[_prefix.exec(m.text), _prefix]] :
        Array.isArray(_prefix) ?
          _prefix.map(p => {
            let re = p instanceof RegExp ?
              p :
              new RegExp(str2Regex(p))
            return [re.exec(m.text), re]
          }) :
          typeof _prefix === 'string' ?
            [[new RegExp(str2Regex(_prefix)).exec(m.text), new RegExp(str2Regex(_prefix))]] :
            [[[], new RegExp]]
      ).find(p => p[1]);

      if (usePrefix) {
        match = prefixMatch;
      } else {
        match = prefixMatch && prefixMatch[0] && prefixMatch[0][0] ?
          prefixMatch : // There is a matching prefix, use it.
          [[['', m.text], new RegExp("^")]]; // No prefix, use direct text
      }

      if (typeof plugin.before === 'function') if (await plugin.before.call(this, m, {
        match,
        conn: this,
        participants,
        groupMetadata,
        user,
        bot,
        isROwner,
        isOwner,
        isRAdmin,
        isAdmin,
        isBotAdmin,
        isPrems,
        isBans,
        chatUpdate,
      })) continue;

      if (typeof plugin.exec !== "function") continue;

      let noPrefix, command, args, _args, text;
      if (usePrefix) {
        if ((usedPrefix = (match[0] || '')[0])) {
          noPrefix = m.text.replace(usedPrefix, '');
          [command, ...args] = noPrefix.trim().split` `.filter((v) => v);
          _args = noPrefix.trim().split` `.slice(1);
          text = _args.join` `;
        } else {
          continue;
        }
      } else {
        const hasPrefix = match && match[0] && match[0][0];

        if (!hasPrefix && !m.text.match(/^[A-Za-z]/)) return;

        if (hasPrefix) {
          // There is a prefix, delete the prefix
          usedPrefix = match[0][0];
          noPrefix = m.text.replace(usedPrefix, '');
        } else {
          // No prefix, use direct text
          noPrefix = m.text;
          usedPrefix = '';
        }

        [command, ...args] = noPrefix.trim().split` `.filter((v) => v);
        _args = noPrefix.trim().split` `.slice(1);
        text = _args.join` `;
      }

      command = (command || '').toLowerCase();

      let fail = plugin.fail || global.dfail;
      let isAccept = plugin.cmd instanceof RegExp ?
        plugin.cmd.test(command) :
        Array.isArray(plugin.cmd) ?
          plugin.cmd.some((cmd) => cmd instanceof RegExp ?
            cmd.test(command) :
            cmd === command
          ) :
          typeof plugin.cmd === 'string' ?
            plugin.cmd === command :
            false;

      if (!isAccept) continue;

      if (plugin.disabled && !global.db.data.users[m.sender].moderator) {
        await m.reply("Sorry, This command is currently disabled by the owner :(");
        return;
      }

      m.plugin = name
      if (m.chat in global.db.data.chats || m.sender in global.db.data.users) {
        let chat = global.db.data.chats[m.chat]
        let user = global.db.data.users[m.sender]
        if (name != 'owner/unbanchat.js' && chat && chat.isBanned) return
        if (name != 'owner/unbanuser.js' && user && user.banned && !user.moderator) return fail('banned', m, this)
      }
      if (plugin.onlyRealOwner && plugin.onlyOwner && !(isROwner || isOwner)) {
        fail('owner', m, this)
        continue
      }
      if (plugin.onlyRealOwner && !isROwner) { // Real Owner
        fail('rowner', m, this)
        continue
      }
      if (plugin.onlyOwner && !isOwner) { // Number Owner
        fail('owner', m, this)
        continue
      }
      if (plugin.onlyMods && !isMods) { // Moderator
        fail('mods', m, this)
        continue
      }
      if (plugin.onlyPremium && !isPrems) { // Premium
        fail('premium', m, this)
        continue
      }
      if (plugin.usedInBanned && !isBans) { // Banned
        fail('banned', m, this)
        continue
      }
      if (plugin.onlyGroup && !m.isGroup) { // Group Only
        fail('group', m, this)
        continue
      } else if (plugin.botAdmin && !isBotAdmin) { // You Admin
        fail('botAdmin', m, this)
        continue
      } else if (plugin.onlyAdmin && !isAdmin) { // User Admin
        fail('admin', m, this)
        continue
      }
      if (plugin.onlyPrivate && m.isGroup) { // Private Chat Only
        fail('private', m, this)
        continue
      }
      if (plugin.needRegister == true && _user.registered == false) { // Need to register?
        fail('unreg', m, this)
        continue
      }
      m.isCommand = true

      if (!opts["self"]) {
        let xp = 'exp' in plugin ? parseInt(plugin.exp) : 17 // XP Earning per command
        m.exp += xp
      } else {
        m.exp = 0;
      }

      if (!isPrems && plugin.limit && global.db.data.users[m.sender].limit < plugin.limit * 1) {
        this.reply(m.chat, "Your bot usage limit has expired and will be reset at 00.00 WIB (Indonesian Time)\nTo get more limit upgrade to premium send *.premium*", m);
      }

      if (plugin.level > _user.level) {
        this.reply(m.chat, `${plugin.level} level is required to use this command. Your level is ${_user.level}`, m)
        continue // If the level has not been reached
      }
      let extra = {
        match,
        usedPrefix,
        noPrefix,
        _args,
        args,
        body,
        command,
        text,
        conn: this,
        participants,
        groupMetadata,
        user,
        bot,
        isROwner,
        isOwner,
        isRAdmin,
        isAdmin,
        isBotAdmin,
        isPrems,
        isBans,
        delay,
        chatUpdate,
      }

      try {
        await plugin.exec.call(this, m, extra);
        if (!isPrems) m.limit = m.limit || plugin.limit || true;
      } catch (e) {
        m.error = e
        console.error(e)
        if (e) {
          let text = util.format(e)
          for (let key of Object.values(global.APIKeys))
            text = text.replace(new RegExp(key, 'g'), 'DitzDev')
          if (e.name) for (let [jid] of global.owner.filter(([number, _, isDeveloper]) => isDeveloper && number)) {
            let data = (await this.onWhatsApp(jid))[0] || {}
            if (data.exists) conn.reply(data.jid, `*Plugin:* ${m.plugin}\n*Sender:* ${m.sender}\n*Chat:* ${m.chat}\n*Command:* ${usedPrefix}${command} ${args.join(' ')}\n\n\`\`\`${text}\`\`\``, m)
          }
          conn.reply(m.chat, text, m)
        }
      } finally {
        if (typeof plugin.after === 'function') {
          try {
            await plugin.after.call(this, m, extra)
          } catch (e) {
            console.error(e)
          }
        }
      }
      break
    }
  } catch (e) {
    console.error(e);
  } finally {
    let user, stats = global.db.data.stats
    if (m) {
      if (m.sender && (user = global.db.data.users[m.sender])) {
        user.exp += Number(m.exp) || 0
        user.limit -= Number(m.limit) || 0
        if (user.limit < 0) user.limit = 0
      }
      let stat
      if (m.plugin) {
        let now = Date.now()
        if (m.plugin in stats) {
          stat = stats[m.plugin]
          if (!isNumber(stat.total)) stat.total = 1
          if (!isNumber(stat.success)) stat.success = m.error != null ? 0 : 1
          if (!isNumber(stat.last)) stat.last = now
          if (!isNumber(stat.lastSuccess)) stat.lastSuccess = m.error != null ? 0 : now
        } else
          stat = stats[m.plugin] = {
            total: 1,
            success: m.error != null ? 0 : 1,
            last: now,
            lastSuccess: m.error != null ? 0 : now
          }
        stat.total += 1
        stat.last = now
        if (m.error == null) {
          stat.success += 1
          stat.lastSuccess = now
        }
      }
    }

    try {
      await (await import("./libs/print.js")).default(m, this);
    } catch (e) {
      console.log(m, m.quoted, e)
    }
  }
}

const processedCalls = new Set();

/** @param {import("baileys").BaileysEventMap["call"]} update */
export async function onCall(calls) {
  for (const call of calls) {
    const { from, id, status, isGroup } = call;
    if (isGroup || status !== 'ringing') continue;
    if (processedCalls.has(id)) continue;

    processedCalls.add(id);

    setTimeout(() => processedCalls.delete(id), 1 * 60 * 1000);

    let users = global.db.data.users[from]

    try {
      const rejectNode = {
        tag: 'call',
        attrs: {
          from: conn.user.lid,
          to: from,
          id: conn.generateMessageTag()
        },
        content: [
          {
            tag: 'reject',
            attrs: {
              'call-id': id,
              'call-creator': from,
              count: '0'
            }
          }
        ]
      };
      await conn.sendNode(rejectNode);

      await new Promise(resolve => setTimeout(resolve, 500));
      conn.reply(from, `You have been banned for calling a bot!\nContact the owner if this is a mistake: @${global.nomorown}`, null);
      users.banned = true;
      users.bannedReason = 'Calling Bot';
    } catch (e) {
      console.error('Error:', e);
    }
  }
}

global.dfail = (type, m, conn) => {
  let user = global.db.data.users[m.sender]
  let imgr = 'https://files.catbox.moe/0604mz.jpeg'
  const bannedReason = user.bannedReason ? '```' + user.bannedReason + '```' : '```Without reason```'
  let msg = {
    rowner: '```Sorry, This Feature Is For Creators Only```',
    owner: '```Sorry, this feature is only for Owners```',
    mods: '```Sorry, This Feature is for Moderators only```',
    group: '```Sorry, this feature can only be used in groups```',
    private: '```This feature can only be used in Private Chat!```',
    admin: null,
    botAdmin: '```Yuki Blom Jadi Admin, Gabisa pake Fitur itu🥲```',
    restrict: '```Restrict is turned on in this Chat, Please turn off restrict```',
    unreg: '```You are not registered yet, please register first:\nVia WhatsApp Directly: .register\nVia Website: .regweb```',
    premium: '```This feature can only be accessed by premium members!```',
    banned: '```You cannot use this command because you have been banned! With reason: ```' + bannedReason,
  }[type];
  if (type === 'admin') {
    let stickerBuffer = fs.readFileSync('./media/admin.webp');
    conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m });
  } else if (msg) {
    return conn.sendMessage(
      m.chat,
      {
        text: msg,
        contextInfo: {
          mentionedJid: conn.parseMention(msg),
          groupMentions: [],
          isForwarded: true,
          businessMessageForwardInfo: {
            businessOwnerJid: global.owner[0] + "@s.whatsapp.net",
          },
          forwardingScore: 256,
          externalAdReply: {
            title: "Yuki Botz by DitzDev",
            body: 'ACCESS_DANIED',
            thumbnailUrl: imgr,
            sourceUrl: null,
            mediaType: 1,
            renderLargerThumbnail: false,
          },
        },
      },
      { quoted: m },
    );
  }
  let msg3 = {
    zevent: `This command can only be used during event*!`
  }[type]
  if (msg3) return m.reply(msg3)
}
