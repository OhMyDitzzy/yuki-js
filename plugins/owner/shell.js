import cp, { exec as _exec } from 'child_process'
import { promisify } from 'util'

let exec = promisify(_exec).bind(cp)
const handler = {
  cmd: /.*/,
  customPrefix: /^[$]/,
  onlyOwner: true,
  exec: async (m, { conn, isOwner, command, text }) => {
    if (!isOwner) return
    if (conn.user.jid !== conn.user.jid) return

    let { key } = await m.reply("Executing...")

    try {
      const result = await exec(command.trimStart()  + ' ' + text.trimEnd())
      
      if (result.stdout.toString().trim())
        await conn.sendMessage(m.chat, { text: result.stdout.toString(), edit: key }, { quoted: m })

      if (result.stderr.toString().trim())
        await conn.sendMessage(m.chat, { text: result.stderr.toString(), edit: key }, { quoted: m })

    } catch (err) {
      await conn.sendMessage(m.chat, { text: String(err.stderr || err.message || err), edit: key }, { quoted: m })
    }
  }
}

export default handler;
