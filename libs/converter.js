import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream, unlinkSync, existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

/**
 * @typedef {Object} FFmpegResult
 * @property {Buffer} data
 * @property {string} filename
 * @property {Function} delete
 */

/**
 * FFmpeg conversion function
 * @param {Buffer} buffer - Input buffer
 * @param {string[]} args - FFmpeg arguments
 * @param {string} ext - Input file extension
 * @param {string} ext2 - Output file extension
 * @returns {Promise<FFmpegResult>}
 */
async function ffmpeg(buffer, args = [], ext = '', ext2 = '') {
  const tmp = join(__dirname, '../tmp', `${Date.now()}.${ext}`);
  const out = `${tmp}.${ext2}`;

  try {
    await writeFile(tmp, buffer);

    const { stdout, stderr } = await execAsync(`ffmpeg -y -i "${tmp}" ${args.join(' ')} "${out}"`);
    
    await writeFile(tmp, '');
    await execAsync(`rm "${tmp}"`);

    const data = await readFile(out);
    
    return {
      data,
      filename: out,
      async delete() {
        try {
          await execAsync(`rm "${out}"`);
        } catch (error) {
          console.error('Error deleting file:', error);
        }
      }
    };
  } catch (e) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
      if (existsSync(out)) unlinkSync(out);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw e;
  }
}

/**
 * Convert Audio to Playable WhatsApp Audio (PTT/Voice Note)
 * @param {Buffer} buffer - Audio Buffer
 * @param {string} ext - File Extension 
 * @returns {Promise<FFmpegResult>} Promise with converted audio data
 */
export function toPTT(buffer, ext) {
  return ffmpeg(
    buffer,
    ['-vn', '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on'],
    ext,
    'ogg'
  );
}

/**
 * Convert Audio to Playable WhatsApp Audio
 * @param {Buffer} buffer - Audio Buffer
 * @param {string} ext - File Extension 
 * @returns {Promise<FFmpegResult>} Promise with converted audio data
 */
export function toAudio(buffer, ext) {
  return ffmpeg(
    buffer,
    ['-vn', '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on', '-compression_level', '10'],
    ext,
    'opus'
  );
}

/**
 * Convert Video to Playable WhatsApp Video
 * @param {Buffer} buffer - Video Buffer
 * @param {string} ext - File Extension 
 * @returns {Promise<FFmpegResult>} Promise with converted video data
 */
export function toVideo(buffer, ext) {
  return ffmpeg(
    buffer,
    ['-c:v', 'libx264', '-c:a', 'aac', '-ab', '128k', '-ar', '44100', '-crf', '32', '-preset', 'slow'],
    ext,
    'mp4'
  );
}

export { ffmpeg };