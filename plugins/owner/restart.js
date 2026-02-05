let handler = {
  cmd: ["restart", "rc"],
  onlyRealOwner: true,
  exec: async (m, { conn, text }) => {
    if (!process.send) {
      return m.reply(`❌ Process not handled by cluster`);
    }
    
    await m.reply(`Restarting bot... see ya!`);
    
    if (global.store) {
      conn.logger.info('Cleaning up store...');
      await global.store.cleanup();
    }

    if (global.db?.data) {
      conn.logger.info('Final database save... ✓');
      await global.db.write().catch((e) => {
        conn.logger.error('Failed to save database:', e);
      });
    }
    
    if (global.conn.user.jid === conn.user.jid) {
       process.exit(1);
    }
  }
}

export default handler;