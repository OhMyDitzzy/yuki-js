let handler = {
  cmd: ["gc", "clearmem", "forcegc"],
  onlyRealOwner: true,
  exec: async (m, { conn }) => {
    if (typeof global.gc !== 'function') {
      return m.reply(`❌ GC not exposed. Run with --expose-gc flag.`);
    }
    
    const memBefore = process.memoryUsage();    
    await m.reply(`Running garbage collector...`);
    
    const startTime = Date.now();
    global.gc();
    
    const duration = Date.now() - startTime; 
    await new Promise(resolve => setTimeout(resolve, 100));   
    const memAfter = process.memoryUsage();    
    const formatMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);   
    const heapDiff = memBefore.heapUsed - memAfter.heapUsed;
    const rssDiff = memBefore.rss - memAfter.rss;
    
    await m.reply(
      `*Garbage Collection Done*\n` +
      `Duration: ${duration}ms\n\n` +
      `*Before:*\n` +
      `• Heap: ${formatMB(memBefore.heapUsed)} MB\n` +
      `• RSS: ${formatMB(memBefore.rss)} MB\n\n` +
      `*After:*\n` +
      `• Heap: ${formatMB(memAfter.heapUsed)} MB\n` +
      `• RSS: ${formatMB(memAfter.rss)} MB\n\n` +
      `*Freed:*\n` +
      `• Heap: ${heapDiff > 0 ? '-' : '+'}${formatMB(Math.abs(heapDiff))} MB\n` +
      `• RSS: ${rssDiff > 0 ? '-' : '+'}${formatMB(Math.abs(rssDiff))} MB`
    );
  }
}

export default handler;