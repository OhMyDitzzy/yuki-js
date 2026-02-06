let handler = {
  name: "Check channel ID",
  description: "Check the channel ID in the form of @newsletter",
  cmd: ["cekchid", "chid", "checkidchannel"],
  tags: ["public"],
  needRegister: true,
  exec: async (m, { conn }) => {
    try {
      let id = (await m.getQuotedObj())?.msg.contextInfo.forwardedNewsletterMessageInfo;
      m.reply(`This is your newsletter id from: ${id.newsletterName}\nID: ${id.newsletterJid}`)
    } catch (e) {
      throw `❌ Messages must be forwarded from the channel, Or the message is too old.`
    }
  }
}

export default handler;
