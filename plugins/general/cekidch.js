let handler = {
  name: "Check channel ID",
  description: "Check the channel ID in the form of @newsletter",
  cmd: ["cekchid", "chid", "checkidchannel"],
  tags: ["public"],
  needRegister: true,
  exec: async (m, { conn }) => {
    try {
      let id = (await m.getQuotedObj())?.msg.contextInfo.forwardedNewsletterMessageInfo;
      conn.sendButton(m.chat, {
        body: {
          text: `This is your newsletter id from: ${id.newsletterName}`
        },
        footer: {
          text: "Copy the ID below"
        },
      }, [{
        type: "copy",
        text: "Copy",
        copy_code: id.newsletterJid
      }], { quoted: m })
    } catch (e) {
      throw `❌ Messages must be forwarded from the channel, Or the message is too old.`
    }
  }
}

export default handler;
