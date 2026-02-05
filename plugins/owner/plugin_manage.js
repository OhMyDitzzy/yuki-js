import syntaxerror from "syntax-error";
import fs from "fs";

let handler = {
  cmd: ["sf", "df", "enable", "disable"],
  onlyRealOwner: true,
  usePrefix: false,
  exec: async (m, { conn, command, text }) => {
    if (!text) throw `*• Example:* ${command} *[filename]*`;

    if (command === "sf") {
      if (!m.quoted) throw `*Reply your code*`;

      let filePath = `plugins/${text}.js`;
      let dir = filePath.split("/").slice(0, -1).join("/");

      const code = m.quoted.text;
      const err = syntaxerror(code, 'anonymous', {
        sourceType: 'module',
        allowAwaitOutsideFunction: true
      });

      if (err) return m.reply(`❌ *Syntax Error Detected!*\n\n` +
        `Cannot save file due to syntax errors:\n` +
        `\`\`\`\n${err}\n\`\`\``);

      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, code);

      let key = await conn.sendMessage(
        m.chat,
        { text: "Saving code..." },
        { quoted: m },
      );

      await conn.sendMessage(
        m.chat,
        {
          text: `✅ Code successfully saved!\n📁 Path: \`${filePath}\``,
          edit: key.key,
        },
        { quoted: m },
      );
    } else if (command === "df") {
      let path = `plugins/${text}.js`;

      let key = await conn.sendMessage(
        m.chat,
        { text: "Deleting code..." },
        { quoted: m },
      );

      if (!fs.existsSync(path)) {
        return conn.sendMessage(
          m.chat,
          { text: `❌ I can't find the code`, edit: key.key },
          { quoted: m },
        );
      }

      fs.unlinkSync(path);

      await conn.sendMessage(
        m.chat,
        { text: `✅ Successfully deleted file\n📁 Path: \`${path}\``, edit: key.key },
        { quoted: m },
      );
    } else if (command === "enable") {
      let path = `plugins/${text}.js`;

      if (!fs.existsSync(path)) {
        return m.reply(`❌ Plugin not found: \`${path}\``);
      }

      let code = fs.readFileSync(path, "utf-8");
      code = code.replace(/^\s*disabled:\s*(true|false),?\s*\n/gm, "");
      code = code.replace(/(\n\s*\n)\s*\n+/g, "\n");

      fs.writeFileSync(path, code);

      await m.reply(`✅ Plugin enabled!\n📁 Path: \`${path}\``);
    } else if (command === "disable") {
      let path = `plugins/${text}.js`;

      if (!fs.existsSync(path)) {
        return m.reply(`❌ Plugin not found: \`${path}\``);
      }

      let code = fs.readFileSync(path, "utf-8");

      code = code.replace(/^\s*disabled:\s*(true|false),?\s*$/gm, "");

      code = code.replace(/\n\s*\n\s*\n/g, "\n\n");

      code = code.replace(
        /^(\s*)(cmd:\s*(?:\[|\/|"))/gm,
        "$1disabled: true,\n$1$2"
      );

      fs.writeFileSync(path, code);

      await m.reply(`✅ Plugin disabled!\n📁 Path: \`${path}\``);
    }
  }
}

export default handler;
