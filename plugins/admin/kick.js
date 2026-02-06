import { areJidsSameUser } from "baileys";

let handler = {
  name: "Kick member",
  description: "Kick members from the group",
  tags: ["admin_group"],
  usage: ["kick"],
  admin: true,
  botAdmin: true,
  group: true,
  cmd: ["kick", "dor", "kik"],
  usePrefix: false,
  exec: async (m, { conn, text, participants }) => {
    const rawWho = m.quoted?.sender || (m.mentionedJid && m.mentionedJid[0]) || (text ? (text.replace(/\D/g, '') + '@s.whatsapp.net') : '')
    
    if (!rawWho) throw 'Reply / tag yang ingin di kick'
    
    const who = rawWho.decodeJid ? rawWho.decodeJid() : rawWho
    
    await conn.groupParticipantsUpdate(m.chat, [who], 'remove')
    
    m.reply("Suksess kick member tolol nan dongo")
  }
}

export default handler;
