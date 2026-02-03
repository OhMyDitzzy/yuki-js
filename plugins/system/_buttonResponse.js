import {
  proto,
  generateWAMessage,
  areJidsSameUser
} from 'baileys'

export async function all(m, chatUpdate) {
  if (m.isBaileys) return
  if (!m.message) return
  if (!(m.message.buttonsResponseMessage || m.message.templateButtonReplyMessage || m.message.listResponseMessage || m.message.interactiveResponseMessage))
    return

  let id;
  if (m.message.buttonsResponseMessage) {
    id = m.message.buttonsResponseMessage.selectedButtonId;
  } else if (m.message.templateButtonReplyMessage) {
    id = m.message.templateButtonReplyMessage.selectedId;
  } else if (m.message.listResponseMessage) {
    id = m.message.listResponseMessage.singleSelectReply?.selectedRowId;
  } else if (m.message.interactiveResponseMessage) {
    id = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id;
  }
  
  let text = m.message.buttonsResponseMessage?.selectedDisplayText || 
             m.message.templateButtonReplyMessage?.selectedDisplayText || 
             m.message.listResponseMessage?.title

  let isIdMessage = false, usedPrefix
  for (let name in global.plugins) {
    let plugin = global.plugins[name]
    if (!plugin) continue
    if (plugin.disabled) continue
    if (!opts['restrict'])
      if (plugin.tags && plugin.tags.includes('admin'))
        continue
    if (typeof plugin.exec !== 'function') continue
    if (!plugin.cmd) continue
    
    const str2Regex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    let _prefix = plugin.customPrefix ? plugin.customPrefix : this.prefix ? this.prefix : global.prefix
    let match = (_prefix instanceof RegExp ?
      [[_prefix.exec(id), _prefix]] :
      Array.isArray(_prefix) ?
        _prefix.map(p => {
          let re = p instanceof RegExp ? p : new RegExp(str2Regex(p))
          return [re.exec(id), re]
        }) :
        typeof _prefix === 'string' ?
          [[new RegExp(str2Regex(_prefix)).exec(id), new RegExp(str2Regex(_prefix))]] :
          [[[], new RegExp]]
    ).find(p => p[1])
    
    if ((usedPrefix = (match[0] || '')[0])) {
      let noPrefix = id.replace(usedPrefix, '')
      let [command] = noPrefix.trim().split` `.filter(v => v)
      command = (command || '').toLowerCase()
      let isId = plugin.cmd instanceof RegExp ?
        plugin.cmd.test(command) :
        Array.isArray(plugin.cmd) ?
          plugin.cmd.some(cmd => cmd instanceof RegExp ?
            cmd.test(command) :
            cmd === command
          ) :
          typeof plugin.cmd === 'string' ?
            plugin.cmd === command :
            false
      if (!isId) continue
      isIdMessage = true
    }
  }
  
  let messageOptions = {
    userJid: this.user.jid
  }
  
  // Only add quoted if it actually exists  
  if (m.quoted?.fakeObj) {
    messageOptions.quoted = m.quoted.fakeObj
  }
  
  let messages = await generateWAMessage(
    m.chat, 
    { 
      text: isIdMessage ? id : text, 
      mentions: m.mentionedJid 
    }, 
    messageOptions
  )
  
  // The problem: m.sender is a LID (1111@lid), while this.user.id is a PN format (628xx:74@s.whatsapp.net). So areJidsSameUser returns false, so fromMe becomes false
  // The best solution is to use m.fromMe which is already set up correctly by Baileys, because fromMe already handles LID vs PN internally.
  messages.key.fromMe = m.fromMe
  messages.key.id = m.key.id
  messages.pushName = m.name
  if (m.isGroup) messages.key.participant = messages.participant = m.sender
  
  if (messages.message) {
    const msgType = Object.keys(messages.message)[0];
    if (messages.message[msgType]?.contextInfo) {
      delete messages.message[msgType].contextInfo.quotedMessage;
    }
  }
  
  if (m.isGroup) {
    messages.key.participant = m.key.participant
    messages.participant = m.sender
    
    if (m.key.participantAlt) {
      messages.key.participantAlt = m.key.participantAlt
    }
  } else {
    if (m.key.remoteJidAlt) {
      messages.key.remoteJidAlt = m.key.remoteJidAlt
    }
  }
  
  let msg = {
    ...chatUpdate,
    messages: [proto.WebMessageInfo.create(messages)].map(v => (v.conn = this, v)),
    type: 'append'
  }
  
  this.ev.emit('messages.upsert', msg)
}