import { spawn } from 'child_process';

const handler = {
  name: "Convert sticker to image",
  description: "Convert a sticker to image",
  tags: ["media"],
  usage: [".toimg <reply-to-sticker>"],
  needRegister: true,
  limit: true,
  cmd: ["toimg"],
  exec: async (m, { conn, usedPrefix, command }) => {
    if (!m.quoted) throw `• *Reply to the sticker by sending the command:* ${usedPrefix + command}`;
    m.react("⏳");
    
    let mime = m.quoted.mimetype || "";
    if (!/webp/.test(mime)) throw `Reply sticker with caption *${usedPrefix + command}*`;

    let media = await m.quoted.download();
    let out = Buffer.alloc(0);

    if (/webp/.test(mime)) {
      try {
        out = await new Promise((resolve, reject) => {
          const proc = spawn("ffmpeg", [
            "-i", "pipe:0",
            "-vcodec", "png",
            "-f", "image2pipe",
            "-vframes", "1",
            "pipe:1"
          ]);

          const chunks = [];
          
          proc.stdout.on('data', (chunk) => {
            chunks.push(chunk);
          });

          proc.stderr.on('data', (data) => {
            console.error('FFmpeg stderr:', data.toString());
          });

          proc.on('close', (code) => {
            if (code !== 0) {
              reject(new Error(`FFmpeg process exited with code ${code}`));
            } else {
              const buffer = Buffer.concat(chunks);
              if (buffer.length === 0) {
                reject(new Error("Conversion failed - empty output"));
              } else {
                resolve(buffer);
              }
            }
          });

          proc.on('error', (err) => {
            reject(err);
          });

          proc.stdin.write(media);
          proc.stdin.end();
        });

      } catch (e) {
        console.error("FFmpeg error:", e);
        m.react("❌");
        throw `Failed to convert sticker: ${e.message}`;
      }
    }

    m.react("✅");
    await conn.sendFile(m.chat, out, `sticker-${Date.now()}.png`, "Success!", m);
  }
};

export default handler;