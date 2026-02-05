let handler = {
  cmd: ["shutdown", "stop"],
  onlyRealOwner: true,
  exec: async (m, { conn }) => {
    if (!process.send) {
      return m.reply(`❌ Process not handled by cluster`);
    }
    
    await m.reply(`🛑 Shutting down bot gracefully...\n\nGoodbye! 👋`);
 
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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
      process.exit(0);
    }
  }
}

export default handler;