let handler = {
  cmd: /^del(ete)?$/i,
  limit: true,
  exec: (m) => {
    if (!m.quoted) throw false
    let { chat, fromMe, id, isBaileys } = m.quoted
    if (!isBaileys) return conn.reply(m.chat, 'Pesan tersebut bukan dikirim oleh bot!', m)
    conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: true, id: m.quoted.id, participant: m.quoted.sender } })
  }
}

export default handler;