import sharp from "sharp";
import { unlink, mkdir, writeFile, rm, readFile } from "fs/promises";
import { randomBytes } from "crypto";
import path from "path";
import { spawn } from "child_process";
import { tmpdir } from "os";

const handler = {
  name: "Convert sticker/audio to video",
  description: "Convert a sticker or audio to video",
  usage: [".tovideo <reply-to-sticker>"],
  tags: ["media"],
  needRegister: true,
  limit: true,
  cmd: ["tovideo", "tovidio", "tovid"],
  exec: async (m, { conn, usedPrefix, command }) => {
    if (!m.quoted)
      throw `• *Reply to the sticker or audio by sending the command:* ${usedPrefix + command}`;

    m.react("⏳");

    let mime = m.quoted.mimetype || "";
    if (!/webp|audio/.test(mime))
      throw `Reply sticker or audio with caption *${usedPrefix + command}*`;

    let media = await m.quoted.download();
    let out = Buffer.alloc(0);

    try {
      if (/webp/.test(mime)) {
        const tempDir = path.join(tmpdir(), `frames-${randomBytes(8).toString("hex")}`);
        const tempOutputFile = path.join(tmpdir(), `video-${randomBytes(8).toString("hex")}.mp4`);
        let metadata;
        
        try {
          metadata = await sharp(media, { animated: true }).metadata();
        } catch (e) {
          metadata = await sharp(media).metadata();
        }

        const isAnimated = (metadata.pages || 1) > 1;

        if (isAnimated) {
          await mkdir(tempDir, { recursive: true });

          const frameCount = metadata.pages || 1;
          const delay = metadata.delay || [];
          const avgDelay =
            delay.length > 0
              ? delay.reduce((a, b) => a + b, 0) / delay.length
              : 40;
          const fps = Math.min(Math.round(1000 / avgDelay), 25);

          const maxFrames = Math.min(frameCount * 3, fps * 3);
          const loopCount = Math.ceil(maxFrames / frameCount);

          const batchSize = 10;
          let frameIndex = 0;

          for (let loop = 0; loop < loopCount; loop++) {
            for (
              let batchStart = 0;
              batchStart < frameCount;
              batchStart += batchSize
            ) {
              const batchEnd = Math.min(batchStart + batchSize, frameCount);
              const batchPromises = [];

              for (let i = batchStart; i < batchEnd; i++) {
                if (frameIndex >= maxFrames) break;

                const framePath = path.join(
                  tempDir,
                  `frame_${frameIndex.toString().padStart(4, "0")}.png`
                );

                batchPromises.push(
                  sharp(media, { page: i })
                    .resize(512, 512, {
                      fit: "contain",
                      background: { r: 255, g: 255, b: 255, alpha: 1 },
                    })
                    .png()
                    .toFile(framePath)
                    .catch((err) => console.error(`Error frame ${i}:`, err))
                );

                frameIndex++;
              }

              await Promise.all(batchPromises);
              if (frameIndex >= maxFrames) break;
            }
            if (frameIndex >= maxFrames) break;
          }

          // FFmpeg untuk animated
          await new Promise((resolve, reject) => {
            const proc = spawn("ffmpeg", [
              "-framerate",
              fps.toString(),
              "-i",
              path.join(tempDir, "frame_%04d.png"),
              "-f",
              "lavfi",
              "-i",
              "anullsrc=channel_layout=stereo:sample_rate=44100",
              "-c:v",
              "libx264",
              "-preset",
              "ultrafast",
              "-c:a",
              "aac",
              "-b:a",
              "128k",
              "-pix_fmt",
              "yuv420p",
              "-shortest",
              "-movflags",
              "+faststart",
              "-y",
              tempOutputFile,
            ]);

            let stderrData = '';
            proc.stderr.on('data', (data) => {
              stderrData += data.toString();
            });

            proc.on('close', (code) => {
              if (code !== 0) {
                console.error("FFmpeg stderr:", stderrData);
                reject(new Error(`FFmpeg failed with exit code ${code}`));
              } else {
                resolve();
              }
            });

            proc.on('error', reject);
          });

          await rm(tempDir, { recursive: true, force: true }).catch(() => {});

          out = await readFile(tempOutputFile);
          await unlink(tempOutputFile).catch(() => {});
        } else {
          // Static sticker
          const tempOutputFile = path.join(tmpdir(), `video-${randomBytes(8).toString("hex")}.mp4`);

          const pngBuffer = await sharp(media)
            .resize(512, 512, {
              fit: "contain",
              background: { r: 255, g: 255, b: 255, alpha: 1 },
            })
            .png()
            .toBuffer();

          await new Promise((resolve, reject) => {
            const proc = spawn("ffmpeg", [
              "-loop",
              "1",
              "-framerate",
              "25",
              "-i",
              "pipe:0",
              "-f",
              "lavfi",
              "-i",
              "anullsrc=channel_layout=stereo:sample_rate=44100",
              "-c:v",
              "libx264",
              "-c:a",
              "aac",
              "-b:a",
              "128k",
              "-pix_fmt",
              "yuv420p",
              "-t",
              "3",
              "-shortest",
              "-movflags",
              "+faststart",
              "-y",
              tempOutputFile,
            ]);

            let stderrData = '';
            proc.stderr.on('data', (data) => {
              stderrData += data.toString();
            });

            proc.on('close', (code) => {
              if (code !== 0) {
                console.error("FFmpeg stderr:", stderrData);
                reject(new Error(`FFmpeg failed with exit code ${code}`));
              } else {
                resolve();
              }
            });

            proc.on('error', reject);

            proc.stdin.write(pngBuffer);
            proc.stdin.end();
          });

          out = await readFile(tempOutputFile);
          await unlink(tempOutputFile).catch(() => {});
        }

        if (out.length === 0) {
          throw new Error("Output file is empty");
        }
      } else if (/audio/.test(mime)) {
        const tempFile = path.join(tmpdir(), `video-${randomBytes(8).toString("hex")}.mp4`);

        await new Promise((resolve, reject) => {
          const proc = spawn("ffmpeg", [
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=640x480:r=25",
            "-i",
            "pipe:0",
            "-c:v",
            "libx264",
            "-tune",
            "stillimage",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-pix_fmt",
            "yuv420p",
            "-shortest",
            "-movflags",
            "+faststart",
            "-y",
            tempFile,
          ]);

          let stderrData = '';
          proc.stderr.on('data', (data) => {
            stderrData += data.toString();
          });

          proc.on('close', (code) => {
            if (code !== 0) {
              console.error("FFmpeg stderr:", stderrData);
              reject(new Error(`FFmpeg failed with exit code ${code}`));
            } else {
              resolve();
            }
          });

          proc.on('error', reject);

          proc.stdin.write(media);
          proc.stdin.end();
        });

        out = await readFile(tempFile);
        await unlink(tempFile).catch(() => {});

        if (out.length === 0) {
          throw new Error("Output file is empty");
        }
      }

      m.react("✅");
      await conn.sendFile(
        m.chat,
        out,
        `video-${Date.now()}.mp4`,
        "Success!",
        m
      );
    } catch (e) {
      console.error("Conversion error:", e);
      m.react("❌");
      throw `Failed to convert to video: ${e.message}`;
    }
  },
};

export default handler;