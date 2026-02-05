import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { createWriteStream, existsSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import { readFile, writeFile, unlink } from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import webp from 'node-webpmux';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const temp = process.platform === 'win32' ? process.env.TEMP : tmpdir();

/**
 * @typedef {Object} MediaInput
 * @property {Buffer} data
 * @property {string} [ext]
 * @property {string} [mimetype]
 */

/**
 * @typedef {Object} StickerMetadata
 * @property {string} [packId]
 * @property {string} [packName]
 * @property {string} [packPublish]
 * @property {string} [androidApp]
 * @property {string} [iOSApp]
 * @property {string[]} [emojis]
 * @property {number} [isAvatar]
 */

/**
 * Convert image to WebP
 * @param {MediaInput} media - Media input
 * @returns {Promise<Buffer>} WebP buffer
 */
export async function imageToWebp(media) {
  const tmpFileIn = join(temp, `${randomBytes(6).readUIntLE(0, 6).toString(36)}.${media?.ext || 'png'}`);
  const tmpFileOut = join(temp, `${randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);

  await writeFile(tmpFileIn, media.data);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(tmpFileIn)
        .on('error', reject)
        .on('end', () => resolve(true))
        .addOutputOptions([
          '-vcodec', 'libwebp',
          '-sws_flags', 'lanczos',
          '-vf',
          "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0",
        ])
        .toFormat('webp')
        .save(tmpFileOut);
    });

    await unlink(tmpFileIn);
    const buff = await readFile(tmpFileOut);
    await unlink(tmpFileOut);

    return buff;
  } catch (e) {
    if (existsSync(tmpFileIn)) await unlink(tmpFileIn);
    if (existsSync(tmpFileOut)) await unlink(tmpFileOut);
    throw e;
  }
}

/**
 * Convert video to WebP
 * @param {MediaInput} media - Media input
 * @returns {Promise<Buffer>} WebP buffer
 */
export async function videoToWebp(media) {
  const tmpFileIn = join(temp, `${randomBytes(6).readUIntLE(0, 6).toString(36)}.${media?.ext || 'mp4'}`);
  const tmpFileOut = join(temp, `${randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);

  await writeFile(tmpFileIn, media.data);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(tmpFileIn)
        .on('error', reject)
        .on('end', () => resolve(true))
        .addOutputOptions([
          '-vcodec', 'libwebp',
          '-sws_flags', 'lanczos',
          '-vf',
          "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0,fps=15",
          '-loop', '0',
          '-ss', '00:00:00',
          '-t', '00:00:10',
          '-preset', 'default',
          '-an',
          '-vsync', '0',
        ])
        .toFormat('webp')
        .save(tmpFileOut);
    });

    await unlink(tmpFileIn);
    const buff = await readFile(tmpFileOut);
    await unlink(tmpFileOut);

    return buff;
  } catch (e) {
    if (existsSync(tmpFileIn)) await unlink(tmpFileIn);
    if (existsSync(tmpFileOut)) await unlink(tmpFileOut);
    throw e;
  }
}

/**
 * Write EXIF metadata to WebP
 * @param {MediaInput} media - Media input
 * @param {StickerMetadata} [metadata] - Sticker metadata
 * @returns {Promise<Buffer|null>} Buffer with EXIF or null
 */
export async function writeExif(media, metadata) {
  let wMedia;

  if (/webp/.test(media.mimetype || '')) {
    wMedia = media.data;
  } else if (/image/.test(media.mimetype || '')) {
    wMedia = await imageToWebp(media);
  } else if (/video/.test(media.mimetype || '')) {
    wMedia = await videoToWebp(media);
  } else {
    return null;
  }

  if (metadata && Object.keys(metadata).length !== 0) {
    const img = new webp.Image();
    const json = {
      'sticker-pack-id': metadata.packId || `DitzDev-${Date.now()}`,
      'sticker-pack-name': metadata.packName || '',
      'sticker-pack-publisher': metadata.packPublish || '',
      'android-app-store-link': metadata.androidApp || 'https://github.com/DitzDev/Yuki',
      'ios-app-store-link': metadata.iOSApp || 'https://github.com/DitzDev/Yuki',
      emojis: metadata.emojis || ['😋', '😎', '🤣', '😂', '😁'],
      'is-avatar-sticker': metadata.isAvatar || 0,
    };

    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);
    const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);

    await img.load(wMedia);
    img.exif = exif;

    return await img.save(null);
  }

  return wMedia;
}