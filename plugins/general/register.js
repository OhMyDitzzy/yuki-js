import { Captcha } from "./register_utils.js"

let v1 = { key: { participant: '0@s.whatsapp.net', remoteJid: "0@s.whatsapp.net" }, message: { conversation: "REGISTER (1/3)" } }
let v2 = { key: { participant: '0@s.whatsapp.net', remoteJid: "0@s.whatsapp.net" }, message: { conversation: "REGISTER (2/3)" } }
let v3 = { key: { participant: '0@s.whatsapp.net', remoteJid: "0@s.whatsapp.net" }, message: { conversation: "REGISTER (3/3)" } }

let handler = {
  name: "Register a new account",
  description: "Register yourself as a Yuki user",
  tags: ["public"],
  cmd: ["reg", "register"],
  exec: async (m, { conn, args }) => {
    if (args.length > 0) throw "Just use this command without arguments!";

    conn.register = conn.register ? conn.register : {};
    if (conn.register[m.chat]?.[m.sender]) return m.reply("*You are requesting verification!*");

    let user = global.db.data.users[m.sender];

    if (user.registered === true) return conn.reply(m.chat, '```✅ Your account has been verified```', m);

    const captcha = new Captcha(4);

    const captchaBuffer = await captcha.build({
      border: "#7289DA",
      opacity: 0.6
    });

    const caption = `*Please enter the captcha code shown in the image above.*

\`Expires in:\` *5 minutes*
\`Maximum Attempt:\` 3

Reply with the code to verify`;

    let { key } = await conn.sendFile(m.chat, captchaBuffer, 'captcha.png', caption, v1);
    captcha.cleanup();

    conn.register[m.chat] = {
      ...conn.register[m.chat],
      [m.sender]: {
        step: 1,
        message: m,
        sender: m.sender,
        otp: captcha.value,
        user,
        key,
        attempts: 0,
        timeout: setTimeout(async () => {
          await conn.sendMessage(m.chat, { delete: key });
          delete conn.register[m.chat][m.sender];
          await conn.sendMessage(m.chat, { text: "*Registration timeout.*\n\nPlease use `/register` to start again." }, { quoted: m });
        }, 300000)
      }
    };
  },
  before: async (m, { conn }) => {
    conn.register = conn.register ? conn.register : {};

    if (m.isBaileys) return;
    if (!conn.register[m.chat]?.[m.sender]) return;
    if (!m.text) return;

    let registerData = conn.register[m.chat]?.[m.sender];
    let { timeout, otp, step, attempts, key } = registerData;

    if (step === 1) {
      if (m.text !== otp) {
        attempts = (attempts || 0) + 1;

        if (attempts >= 3) {
          clearTimeout(timeout);

          await conn.sendMessage(m.chat, { delete: key });
          delete conn.register[m.chat]?.[m.sender];
          return await conn.sendMessage(m.chat, {
            text: `🚩 Maximum attempts reached (3/3).\nYour verification code was wrong.\n\nPlease use \`/register\` to start again.`
          }, { quoted: m });
        }

        conn.register[m.chat][m.sender].attempts = attempts;
        return await conn.sendMessage(m.chat, {
          text: `🚩 Wrong captcha code. (${attempts}/3 attempts)\nPlease try again.`
        }, { quoted: m });
      }

      clearTimeout(timeout);
      await conn.sendMessage(m.chat, { delete: key });

      const caption = `*Please enter your name:*`
      let messageName = await conn.sendMessage(m.chat, { text: caption }, { quoted: v2 });

      let nameTimeout = setTimeout(async () => {
        await conn.sendMessage(m.chat, { delete: messageName.key });
        delete conn.register[m.chat]?.[m.sender];
        await conn.sendMessage(m.chat, { text: "⏰ Registration timeout. Please use `/register` to start again." }, { quoted: m });
      }, 180000);
      conn.register[m.chat][m.sender] = { step: 2, timeout: nameTimeout, key: messageName.key };
    } else if (step === 2) {
      clearTimeout(timeout);
      let name = m.text.trim();

      if (name.length < 3) {
        await conn.sendMessage(m.chat, { delete: key });
        delete conn.register[m.chat]?.[m.sender];
        return await conn.sendMessage(m.chat, {
          text: "🚩 Name must be at least 3 characters long.\n\nPlease use `/register` to start again."
        }, { quoted: m });
      }

      let user = global.db.data.users[m.sender];
      user.name = name;

      await conn.sendMessage(m.chat, { text: "✅", edit: key });

      const ageCaption = `*Please enter your age:*`;
      let messageAge = await conn.sendMessage(m.chat, { text: ageCaption }, { quoted: v3 });
      let ageTimeout = setTimeout(async () => {
        await conn.sendMessage(m.chat, { delete: messageAge.key });
        delete conn.register[m.chat]?.[m.sender];
        await conn.sendMessage(m.chat, { text: "⏰ Registration timeout. Please use `/register` to start again." }, { quoted: m });
      }, 180000);
      conn.register[m.chat][m.sender] = { step: 3, timeout: ageTimeout, key: messageAge.key };
    } else if (step === 3) {
      clearTimeout(timeout);
      let age = parseInt(m.text);

      if (isNaN(age)) {
        await conn.sendMessage(m.chat, { delete: key });
        delete conn.register[m.chat]?.[m.sender];
        return await conn.sendMessage(m.chat, {
          text: "🚩 Invalid age, please enter a valid number.\n\nPlease use `/register` to start again."
        }, { quoted: m });
      }

      let user = global.db.data.users[m.sender];
      let ppUrl = await conn.profilePictureUrl(m.sender, 'image').catch((_) => "https://telegra.ph/file/1dff1788814dd281170f8.jpg");

      user.age = age;

      await conn.sendMessage(m.chat, { text: "✅", edit: key });
      
      user.limit += 100;
      user.money = (user.money || 0) + 10000;
      user.exp = (user.exp || 0) + 50;

      user.regTime = +new Date();
      user.registered = true;

      const teks = `✅ *Registration successfully!*

\`Name:\` ${user.name}
\`Age:\` ${user.age}
\`Total Limit:\` ${user.limit}

Welcome! Now, you can access Yuki's features.`

      await conn.sendMessage(m.chat, {
        text: teks,
        contextInfo: {
          externalAdReply: {
            title: '🎊 Registration Complete',
            body: 'Welcome to Yuki Botz!',
            thumbnailUrl: ppUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: m });

      delete conn.register[m.chat]?.[m.sender];
    }
  }
}

export default handler;
