import { Chess } from '../../libs/chess/catur-logic.js';
import { ChessRenderer } from '../../libs/chess/catur-render.js';
import { ChessCommentator } from '../../libs/chess/catur-komentator.js';

let activeGames = {};
let activeChallenges = {};
let gameTimeouts = {};

const TIMEOUT_OPTIONS = {
  '10M': 10 * 60 * 1000,
  '20M': 20 * 60 * 1000,
  '30M': 30 * 60 * 1000
};

const REWARD_WIN = 50000;
const REWARD_DRAW = 20000;

let handler = {
  name: "Game Catur",
  description: "Tantang pengguna lain untuk bermain catur dan dapatkan hadiah uang!",
  tags: ["game"],
  cmd: ["chess", "catur"],
  needRegister: true,
  onlyGroup: true,
  exec: async (m, { conn, args, text, usedPrefix, command }) => {
    const subCommand = args[0]?.toLowerCase();
    
    if (!subCommand || subCommand === 'help') {
      const helpText = `*♟️ CHESS GAME - PANDUAN BERMAIN*

📜 *PERINTAH TERSEDIA:*

*${usedPrefix}${command} tantang* @user
└ Tantang pengguna untuk bermain catur

*${usedPrefix}${command} nyerah*
└ Menyerah saat sedang bermain

*${usedPrefix}${command} cancel*
└ Batalkan tantangan yang dikirim

*${usedPrefix}${command} status*
└ Lihat status permainan aktif

*${usedPrefix}${command} help*
└ Tampilkan panduan ini

📝 *CARA BERMAIN:*

1️⃣ Tantang pemain lain dengan mention/tag
2️⃣ Pilih timeout permainan (10M/20M/30M)
3️⃣ Tunggu pemain menerima tantangan
4️⃣ Mainkan catur dengan notasi sederhana:
   • *e4* (pion ke e4)
   • *Nf3* (kuda ke f3)
   • *Bxe5* atau *Be5* (bishop makan di e5)
   • *Kxf7* (raja makan di f7)
   • *00* (rokade kingside)
   • *000* (rokade queenside)

🏆 *HADIAH:*
• Menang: Rp ${REWARD_WIN.toLocaleString('id-ID')}
• Seri/Draw: Rp ${REWARD_DRAW.toLocaleString('id-ID')} (kedua pemain)
• Kalah: Tidak dapat hadiah

⏱️ *TIMEOUT:*
Jika tidak bergerak dalam waktu yang ditentukan, pemain dianggap kalah.

💡 *TIPS:*
• Gunakan notasi sederhana
• Tidak perlu menulis + atau # untuk skak`;

      return m.reply(helpText);
    }

    if (subCommand === 'tantang') {
      const targetJid = m.quoted?.sender || (m.mentionedJid && m.mentionedJid[0]);
      
      if (!targetJid) {
        return m.reply('❌ Tag/reply pengguna yang ingin kamu tantang!\n\nContoh:\n' + usedPrefix + command + ' tantang @user');
      }

      if (targetJid === m.sender) {
        return m.reply('❌ Kamu tidak bisa menantang diri sendiri!');
      }

      if (targetJid === conn.user.jid) {
        return m.reply('❌ Tidak bisa menantang bot!');
      }

      if (activeGames[m.chat]?.[m.sender] || activeGames[m.chat]?.[targetJid]) {
        return m.reply('❌ Salah satu pemain sedang bermain catur!');
      }

      if (activeChallenges[m.chat]?.[m.sender]) {
        return m.reply('❌ Kamu masih memiliki tantangan yang pending!\nGunakan `' + usedPrefix + command + ' cancel` untuk membatalkan.');
      }

      const timeoutText = `⏱️ *PILIH TIMEOUT PERMAINAN*

Pilih batas waktu untuk setiap giliran:

1️⃣ *10M* - 10 Menit
2️⃣ *20M* - 20 Menit  
3️⃣ *30M* - 30 Menit

Balas dengan: 1, 2, atau 3`;

      const { key } = await conn.reply(m.chat, timeoutText, m);

      activeChallenges[m.chat] = activeChallenges[m.chat] || {};
      activeChallenges[m.chat][m.sender] = {
        step: 'select_timeout',
        challenger: m.sender,
        target: targetJid,
        messageKey: key,
        timeout: setTimeout(async () => {
          await conn.sendMessage(m.chat, { delete: key });
          delete activeChallenges[m.chat]?.[m.sender];
          await m.reply('⏰ Waktu habis! Tantangan dibatalkan.');
        }, 60000)
      };

      return;
    }

    if (subCommand === 'cancel') {
      if (!activeChallenges[m.chat]?.[m.sender]) {
        return m.reply('❌ Kamu tidak memiliki tantangan yang aktif!');
      }

      const challenge = activeChallenges[m.chat][m.sender];
      clearTimeout(challenge.timeout);
      
      if (challenge.messageKey) {
        await conn.sendMessage(m.chat, { delete: challenge.messageKey });
      }

      delete activeChallenges[m.chat][m.sender];
      return m.reply('✅ Tantangan berhasil dibatalkan!');
    }

    if (subCommand === 'nyerah' || subCommand === 'menyerah') {
      if (!activeGames[m.chat]?.[m.sender]) {
        return m.reply('❌ Kamu tidak sedang bermain catur!');
      }

      const gameData = activeGames[m.chat][m.sender];
      const opponent = gameData.white === m.sender ? gameData.black : gameData.white;
      const surrenderer = m.sender;

      if (gameTimeouts[m.chat]?.[m.sender]) {
        clearTimeout(gameTimeouts[m.chat][m.sender]);
      }
      if (gameTimeouts[m.chat]?.[opponent]) {
        clearTimeout(gameTimeouts[m.chat][opponent]);
      }

      global.db.data.users[opponent].money += REWARD_WIN;

      const winnerName = await conn.getName(opponent);
      const loserName = await conn.getName(surrenderer);

      const resultText = `🏳️ *GAME BERAKHIR - MENYERAH*

😢 ${loserName} menyerah!
🎉 ${winnerName} menang!

💰 Hadiah: Rp ${REWARD_WIN.toLocaleString('id-ID')}`;

      await m.reply(resultText);

      delete activeGames[m.chat][gameData.white];
      delete activeGames[m.chat][gameData.black];
      delete gameTimeouts[m.chat]?.[gameData.white];
      delete gameTimeouts[m.chat]?.[gameData.black];

      return;
    }

    if (subCommand === 'status') {
      if (!activeGames[m.chat]?.[m.sender]) {
        return m.reply('❌ Kamu tidak sedang bermain catur!');
      }

      const gameData = activeGames[m.chat][m.sender];
      const opponent = gameData.white === m.sender ? gameData.black : gameData.white;
      const turn = gameData.game.turn();
      const currentPlayer = turn === 'w' ? gameData.white : gameData.black;

      const whiteTime = gameData.whiteTime || 0;
      const blackTime = gameData.blackTime || 0;

      const statusText = `♟️ *STATUS PERMAINAN*

👤 Putih: ${await conn.getName(gameData.white)}
⏱️ Waktu: ${Math.floor(whiteTime / 60000)}m ${Math.floor((whiteTime % 60000) / 1000)}s

👤 Hitam: ${await conn.getName(gameData.black)}
⏱️ Waktu: ${Math.floor(blackTime / 60000)}m ${Math.floor((blackTime % 60000) / 1000)}s

🎯 Giliran: ${await conn.getName(currentPlayer)}
📝 Total gerakan: ${gameData.moveHistory.length}`;

      return m.reply(statusText);
    }

    return conn.reply(m.chat, `❌ Perintah tidak dikenal!\n\nGunakan *${usedPrefix}${command} help* untuk melihat panduan.`, m);
  },

  before: async (m, { conn }) => {
    if (m.isBaileys) return;
    if (!m.text) return;

    if (activeGames[m.chat]?.[m.sender]) {
      const gameData = activeGames[m.chat][m.sender];
      const currentTurn = gameData.game.turn();
      const currentPlayer = currentTurn === 'w' ? gameData.white : gameData.black;

      if (currentPlayer !== m.sender) {
        return;
      }

      const moveInput = m.text.trim();
      
      if (moveInput.startsWith('.') || moveInput.startsWith('/') || moveInput.startsWith('!') || moveInput.length > 10) {
        return;
      }

      const beforeFen = gameData.game.fen();
      const parseResult = gameData.game.parseAndMove(moveInput);

      if (!parseResult.success) {
        const chessNotationPattern = /^[a-hKQRBN][a-h1-8xO\-=+#]*$/i;
        if (!chessNotationPattern.test(moveInput)) {
          return;
        }

        const errorMsg = `❌ *Gerakan tidak valid!*

Input: \`${parseResult.input}\`

${parseResult.suggestion ? `💡 ${parseResult.suggestion.reason}\n\n*Gerakan yang mungkin:*\n${parseResult.suggestion.validMoves.slice(0, 8).join(', ')}` : ''}`;
        
        return m.reply(errorMsg);
      }

      const move = parseResult.move;
      gameData.moveHistory.push(move);

      if (gameTimeouts[m.chat]?.[m.sender]) {
        clearTimeout(gameTimeouts[m.chat][m.sender]);
      }

      const commentary = gameData.commentator.commentateMove(gameData.game, move, currentTurn === 'w' ? 'player' : 'bot', beforeFen);

      const imageBuffer = await gameData.renderer.renderBoard(gameData.game);

      let responseText = `${commentary.emoji} *${commentary.title}*\n\n`;
      responseText += `${commentary.description}\n`;
      responseText += `📊 Evaluation: ${commentary.evaluation}\n`;

      if (gameData.game.isCheckmate()) {
        const winner = m.sender;
        const loser = gameData.white === winner ? gameData.black : gameData.white;

        global.db.data.users[winner].money += REWARD_WIN;

        responseText += `\n🎯 *CHECKMATE!*\n`;
        responseText += `🎉 ${await conn.getName(winner)} MENANG!\n`;
        responseText += `💰 Hadiah: Rp ${REWARD_WIN.toLocaleString('id-ID')}`;

        await conn.sendMessage(m.chat, {
          image: imageBuffer,
          caption: responseText
        }, { quoted: m });

        delete activeGames[m.chat][gameData.white];
        delete activeGames[m.chat][gameData.black];
        if (gameTimeouts[m.chat]) {
          clearTimeout(gameTimeouts[m.chat][gameData.white]);
          clearTimeout(gameTimeouts[m.chat][gameData.black]);
        }

        return;
      }

      if (gameData.game.isDraw()) {
        global.db.data.users[gameData.white].money += REWARD_DRAW;
        global.db.data.users[gameData.black].money += REWARD_DRAW;

        const drawReason = gameData.game.isStalemate() ? 'Stalemate' :
                          gameData.game.isThreefoldRepetition() ? 'Threefold Repetition' :
                          gameData.game.isInsufficientMaterial() ? 'Insufficient Material' : 'Draw';

        responseText += `\n🤝 *SERI (${drawReason})*\n`;
        responseText += `💰 Hadiah masing-masing: Rp ${REWARD_DRAW.toLocaleString('id-ID')}`;

        await conn.sendMessage(m.chat, {
          image: imageBuffer,
          caption: responseText
        }, { quoted: m });

        delete activeGames[m.chat][gameData.white];
        delete activeGames[m.chat][gameData.black];
        if (gameTimeouts[m.chat]) {
          clearTimeout(gameTimeouts[m.chat][gameData.white]);
          clearTimeout(gameTimeouts[m.chat][gameData.black]);
        }

        return;
      }

      if (gameData.game.isCheck()) {
        responseText += `\n⚠️ *SKAK!*\n`;
      }

      const nextPlayer = gameData.game.turn() === 'w' ? gameData.white : gameData.black;
      responseText += `\n⚔️ Giliran: ${await conn.getName(nextPlayer)}`;

      const hint = gameData.commentator.getHint(gameData.game);
      if (hint) {
        responseText += `\n${hint}`;
      }

      await conn.sendMessage(m.chat, {
        image: imageBuffer,
        caption: responseText
      }, { quoted: m });

      gameTimeouts[m.chat] = gameTimeouts[m.chat] || {};
      gameTimeouts[m.chat][nextPlayer] = setTimeout(async () => {
        const winner = m.sender;
        const loser = nextPlayer;

        global.db.data.users[winner].money += REWARD_WIN;

        const timeoutText = `⏰ *WAKTU HABIS!*

😴 ${await conn.getName(loser)} kehabisan waktu!
🎉 ${await conn.getName(winner)} menang!

💰 Hadiah: Rp ${REWARD_WIN.toLocaleString('id-ID')}`;

        await conn.sendMessage(m.chat, { text: timeoutText });

        delete activeGames[m.chat][gameData.white];
        delete activeGames[m.chat][gameData.black];
        delete gameTimeouts[m.chat][gameData.white];
        delete gameTimeouts[m.chat][gameData.black];
      }, gameData.timeoutDuration);

      return;
    }

    if (activeChallenges[m.chat]?.[m.sender]) {
      const challenge = activeChallenges[m.chat][m.sender];

      if (challenge.step === 'select_timeout') {
        const input = m.text.trim();
        const timeoutMap = { '1': '10M', '2': '20M', '3': '30M' };
        const selectedTimeout = timeoutMap[input];

        if (!selectedTimeout) {
          return m.reply('❌ Pilihan tidak valid! Balas dengan: 1, 2, atau 3');
        }

        clearTimeout(challenge.timeout);
        await conn.sendMessage(m.chat, { delete: challenge.messageKey });

        const challengerName = await conn.getName(challenge.challenger);
        const targetName = await conn.getName(challenge.target);

        const challengeText = `♟️ *TANTANGAN CATUR!*

🎮 ${challengerName} menantang kamu bermain catur!

⏱️ Timeout: ${selectedTimeout} per giliran
🏆 Hadiah Menang: Rp ${REWARD_WIN.toLocaleString('id-ID')}
🤝 Hadiah Seri: Rp ${REWARD_DRAW.toLocaleString('id-ID')}

Terima tantangan?
Balas: *terima* atau *tolak*`;

        const { key } = await conn.sendMessage(challenge.target, { text: challengeText });

        activeChallenges[m.chat][m.sender] = {
          step: 'waiting_response',
          challenger: challenge.challenger,
          target: challenge.target,
          timeoutDuration: TIMEOUT_OPTIONS[selectedTimeout],
          timeoutName: selectedTimeout,
          privateMessageKey: key,
          timeout: setTimeout(async () => {
            await conn.sendMessage(challenge.target, { delete: key });
            delete activeChallenges[m.chat]?.[challenge.challenger];
            
            await conn.sendMessage(m.chat, {
              text: `⏰ ${targetName} tidak merespon tantangan dari ${challengerName}.`
            });
          }, 120000)
        };

        return m.reply(`✅ Tantangan dikirim ke ${targetName}!\n⏳ Menunggu respon...`);
      }
    }

    for (const chatId in activeChallenges) {
      for (const challenger in activeChallenges[chatId]) {
        const challenge = activeChallenges[chatId][challenger];
        
        if (challenge.target === m.sender && challenge.step === 'waiting_response') {
          const input = m.text.toLowerCase().trim();

          if (input === 'terima' || input === 'accept') {
            clearTimeout(challenge.timeout);
            await conn.sendMessage(m.sender, { delete: challenge.privateMessageKey });

            const game = new Chess();
            const renderer = new ChessRenderer({
              squareSize: 80,
              borderSize: 30,
            });
            const commentator = new ChessCommentator();

            const isTargetWhite = Math.random() < 0.5;
            const whitePlayer = isTargetWhite ? challenge.target : challenge.challenger;
            const blackPlayer = isTargetWhite ? challenge.challenger : challenge.target;

            const gameData = {
              game,
              renderer,
              commentator,
              white: whitePlayer,
              black: blackPlayer,
              moveHistory: [],
              timeoutDuration: challenge.timeoutDuration,
              whiteTime: challenge.timeoutDuration,
              blackTime: challenge.timeoutDuration,
              lastMoveTime: Date.now()
            };

            activeGames[chatId] = activeGames[chatId] || {};
            activeGames[chatId][whitePlayer] = gameData;
            activeGames[chatId][blackPlayer] = gameData;
            
            const imageBuffer = await renderer.renderBoard(game);

            const startText = `♟️ *PERMAINAN CATUR DIMULAI!*

⚪ Putih: ${await conn.getName(whitePlayer)}
⚫ Hitam: ${await conn.getName(blackPlayer)}

⏱️ Timeout: ${challenge.timeoutName} per giliran
🎯 Giliran: ${await conn.getName(whitePlayer)}

💡 Gunakan notasi sederhana untuk bergerak:
• e4, Nf3, Bxe5, Kxf7, 00, 000

⚔️ Selamat bermain!`;

            await conn.sendMessage(chatId, {
              image: imageBuffer,
              caption: startText
            });

            gameTimeouts[chatId] = gameTimeouts[chatId] || {};
            gameTimeouts[chatId][whitePlayer] = setTimeout(async () => {
              global.db.data.users[blackPlayer].money += REWARD_WIN;

              const timeoutText = `⏰ *WAKTU HABIS!*

😴 ${await conn.getName(whitePlayer)} kehabisan waktu!
🎉 ${await conn.getName(blackPlayer)} menang!

💰 Hadiah: Rp ${REWARD_WIN.toLocaleString('id-ID')}`;

              await conn.sendMessage(chatId, { text: timeoutText });

              delete activeGames[chatId][whitePlayer];
              delete activeGames[chatId][blackPlayer];
              delete gameTimeouts[chatId][whitePlayer];
              delete gameTimeouts[chatId][blackPlayer];
            }, challenge.timeoutDuration);

            await conn.sendMessage(chatId, {
              text: `✅ ${await conn.getName(challenge.target)} menerima tantangan dari ${await conn.getName(challenge.challenger)}!`
            });

            delete activeChallenges[chatId][challenger];
            return;
          }

          if (input === 'tolak' || input === 'reject') {
            clearTimeout(challenge.timeout);
            await conn.sendMessage(m.sender, { delete: challenge.privateMessageKey });

            await m.reply('✅ Tantangan ditolak.');

            await conn.sendMessage(chatId, {
              text: `❌ ${await conn.getName(challenge.target)} menolak tantangan dari ${await conn.getName(challenge.challenger)}.`
            });

            delete activeChallenges[chatId][challenger];
            return;
          }
        }
      }
    }
  }
}

export default handler;