import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

let handler = {
  cmd: ["backup", "backupdb", "cleanbackup", "checkpoint"],
  onlyRealOwner: true,
  exec: async (m, { conn, command, usedPrefix, text, args }) => {

    const parseFlags = (args) => {
      const flags = {
        _: [],
        remove: false,
        days: 7,
        force: false,
      };

      const combinedArgs = args.join(' ');

      const processedArgs = [];
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
  
        if (arg.startsWith('-') && arg.length > 2 && !arg.startsWith('--')) {
          const flagChars = arg.slice(1).split('');
          for (const char of flagChars) {
            processedArgs.push(`-${char}`);
          }
        } else {
          processedArgs.push(arg);
        }
      }

      for (let i = 0; i < processedArgs.length; i++) {
        const arg = processedArgs[i];
        
        if (arg === '--remove-file' || arg === '-r') {
          flags.remove = true;
        } else if (arg === '--days' || arg === '-d') {
          flags.days = parseInt(processedArgs[i + 1]) || 7;
          i++;
        } else if (arg === '--force' || arg === '-f') {
          flags.force = true;
        } else if (!arg.startsWith('-')) {
          flags._.push(arg);
        }
      }
      
      return flags;
    };
    
    const flags = parseFlags(args);
    
    if (command === 'backup' || command === 'backupdb') {
      m.reply('⏳ Membuat backup database...');

      const result = await global.db.autoBackup('data/backups');
           
      if (result.success) {
        m.reply(`✅ Backup berhasil dibuat!\n📁 ${result.path}`);
        try {
          const backupFile = readFileSync(result.path);    
          const fileName = result.path.split('/').pop() || result.path.split('\\').pop() || 'user.db';
   
          await conn.sendMessage(
            m.chat, 
            { 
              document: backupFile, 
              mimetype: 'application/octet-stream', 
              fileName: fileName 
            }, 
            { quoted: m }
          );
          
        } catch (sendError) {
          console.error('Error sending backup file:', sendError);
        }
      } else {
        m.reply(`❌ Backup gagal: ${result.error}`);
      }
    } 
    
    else if (command === 'cleanbackup') {
      const days = flags.days;
      const shouldRemove = flags.remove;
      const isForced = flags.force;
            
      if (shouldRemove && !isForced) {
        return m.reply(`⚠️ Peringatan!\n\nAnda akan menghapus semua backup yang lebih lama dari ${days} hari.\n\nGunakan: ${usedPrefix}cleanbackup --remove-file --force\natau: ${usedPrefix}cleanbackup -rf\n\nuntuk konfirmasi penghapusan.`);
      }
      
      if (shouldRemove && isForced) {
        m.reply(`⏳ Membersihkan backup lama (>${days} hari)...`);
        
        const result = global.db.cleanOldBackups('data/backups', days);
        
        if (result.error) {
          return m.reply(`❌ Error: ${result.error}`);
        }
        
        if (result.deleted === 0) {
          return m.reply(`✅ Tidak ada backup yang lebih lama dari ${days} hari.`);
        }
        
        let txt = `✅ Berhasil menghapus ${result.deleted} backup!\n\n`;
        txt += `📋 File yang dihapus:\n`;
        result.files.forEach((f, i) => {
          txt += `${i + 1}. ${f}\n`;
        });
        
        m.reply(txt);
      } else {
        try {
          const bf = 'data/backups';
          
          if (!existsSync(bf)) {
            return m.reply('❌ Folder backup tidak ditemukan!');
          }
          
          const files = readdirSync(bf)
            .filter(f => f.endsWith('.db'))
            .map(f => ({
              name: f,
              path: join(bf, f),
              time: statSync(join(bf, f)).mtimeMs,
              size: statSync(join(bf, f)).size
            }));
          
          if (files.length === 0) {
            return m.reply('✅ Tidak ada backup ditemukan.');
          }
          
          const now = Date.now();
          const maxAge = days * 24 * 60 * 60 * 1000;
          const oldFiles = files.filter(f => (now - f.time) > maxAge);
          
          if (oldFiles.length === 0) {
            return m.reply(`✅ Tidak ada backup yang lebih lama dari ${days} hari.\n\nTotal backup tersedia: ${files.length}`);
          }
          
          const totalSize = oldFiles.reduce((sum, f) => sum + f.size, 0);
          const formatSize = (bytes) => {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
            return (bytes / 1024 / 1024).toFixed(2) + ' MB';
          };
          
          let txt = `📋 *Preview Backup yang Akan Dihapus:*\n\n`;
          txt += `Lebih tua dari: ${days} hari\n`;
          txt += `Total file: ${oldFiles.length}\n`;
          txt += `Total size: ${formatSize(totalSize)}\n\n`;
          
          oldFiles.slice(0, 10).forEach((f, i) => {
            const date = new Date(f.time);
            txt += `${i + 1}. ${f.name}\n`;
            txt += `   📅 ${date.toLocaleString('id-ID')}\n`;
            txt += `   💾 ${formatSize(f.size)}\n\n`;
          });
          
          if (oldFiles.length > 10) {
            txt += `... dan ${oldFiles.length - 10} file lainnya\n\n`;
          }
          
          txt += `━━━━━━━━━━━━━━━━\n`;
          txt += `Untuk menghapus, gunakan:\n`;
          txt += `${usedPrefix}cleanbackup -rf\n`;
          txt += `atau\n`;
          txt += `${usedPrefix}cleanbackup --remove-file --force\n\n`;
          txt += `Ubah hari dengan:\n`;
          txt += `${usedPrefix}cleanbackup -d 14 -rf`;
          
          m.reply(txt);
        } catch (e) {
          m.reply('❌ Error: ' + e.message);
        }
      }
    } 
    
    else if (command === 'checkpoint') {
      m.reply('⏳ Melakukan checkpoint...');
      const result = global.db.checkpoint();
     
      const walPath = global.db.dbPath + '-wal';
      
      let walSize = 0;
      if (existsSync(walPath)) {
        walSize = statSync(walPath).size;
      }
      
      const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
      };
      
      m.reply(`✅ Checkpoint selesai!\n\n💾 WAL size: ${formatSize(walSize)}`);
    }
  }
}

export default handler;