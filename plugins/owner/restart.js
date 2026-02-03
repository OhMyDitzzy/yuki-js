let handler = {
  cmd: ["restart", "rc"],
  onlyRealOwner: true,
  exec: async (m, { conn, text }) => {
    if (!process.send) {
      return m.reply(`❌ Process not handled by cluster`);
    }
    
    await m.reply(`Restarting bot... see ya!`);
    
    if (global.conn.user.jid === conn.user.jid) {
       process.exit(1);
    }
  }
}

export default handler;