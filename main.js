import "./config/index.js";
import path from 'path';
import fs from "fs";
import { platform } from 'process'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'
global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') { return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString() }; global.__dirname = function dirname(pathURL) { return path.dirname(global.__filename(pathURL, true)) }; global.__require = function require(dir = import.meta.url) { return createRequire(dir) }

import chokidar from "chokidar";
import syntaxerror from "syntax-error";
import { spawn } from 'child_process';
import { format } from "util";
import chalk from "chalk";
import yargs from "yargs";
import { serialize, protoType, makeWASocket } from './libs/simple.js';
import { SQLiteDB } from "./libs/database.js";
import { closeSQLiteAuthState, useSQLiteAuthState } from "./libs/useSQLAuthState.js";
import { Browsers, DisconnectReason, makeCacheableSignalKeyStore } from "baileys";
import pino from "pino";
import { tmpdir } from "os";

// https://nodejs.org/api/process.html#processloadenvfilepath
process.loadEnvFile();

protoType();
serialize();

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) })) : '')

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp(`^[${(opts['prefix'] || "@#_\\/.!$%+£¥€°=¬‚„…†‡ˆ‰Š‹ŒŽ'':;?&\\-").replace(/[|\\{}()[\]^$+*?.\-]/g, "\\$&")}]`)

global.db = new SQLiteDB(process.env.USER_DB_PATH);
global.loadDatabase = async function loadDatabase() {
  if (db.READ) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!db.READ) {
          clearInterval(interval);
          resolve(db.data == null ? global.loadDatabase() : db.data);
        }
      }, 1000);
    });
  }

  if (db.data !== null) return;
  db.READ = true;
  await db.read().catch(console.error);
  db.READ = false;
  db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    rpg: {},
    ...(db.data || {})
  }
}

const { state, saveCreds } = await useSQLiteAuthState(process.cwd() + process.env.DB_PATH);

/** @type {import("baileys").UserFacingSocketConfig} */
const connOptions = {
  browser: Browsers.macOS("Safari"),
  logger: pino({ level: "silent" }),
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, pino().child({
      level: "silent",
      stream: "store"
    }))
  },
  generateHighQualityLinkPreview: true,
}

global.conn = makeWASocket(connOptions);
conn.isInit = false;

/** @param {import("baileys").BaileysEventMap["connection.update"]} update */
async function connectionUpdate(update) {
  const { receivedPendingNotifications, connection, lastDisconnect, isOnline, isNewLogin, qr } = update;

  if (qr) {
    if (!conn.authState.creds.registered) {
      conn.logger.info("No accounts linked to the bot yet, Trying to request a pairing code...");
      setTimeout(async () => {
        let code = await conn.requestPairingCode(process.env.PAIRING_NUMBER, "DITZDEVS")
        code = code?.match(/.{1,4}/g)?.join('-') || code
        conn.logger.info("Code successfully requested!")
        console.log(chalk.black(chalk.bgGreen(`Your pairing code : `)), chalk.black(chalk.white(code)))
      }, 3000)
    }
  }

  if (isNewLogin) {
    conn.isInit = true;
  }

  if (connection === 'connecting') {
    conn.logger.info('Activating Bot, Please wait a moment...');
  } else if (connection === 'open') {
    conn.logger.info('Connected... ✓');
  }

  if (isOnline === true) {
    conn.logger.info('Active Status... ✓');
  } else if (isOnline === false) {
    conn.logger.warn('Dead Status');
  }

  if (receivedPendingNotifications) {
    conn.logger.warn('Received pending notifications detected, Waiting for New Messages...');
  }

  if (connection === 'close') {
    // TODO: Implement a gracefull shutdown
    /*if (conn.isShuttingDown) {
      conn.logger.info('Connection closed gracefully');
      return;
    }*/

    conn.logger.error('Connection lost...');

    if (lastDisconnect?.error) {
      const statusCode = lastDisconnect.error.output?.statusCode;
      const errorMessage = lastDisconnect.error.output?.payload?.message || lastDisconnect.error.message;

      conn.logger.error(`Disconnect reason: ${errorMessage} (${statusCode})`);

      if (statusCode === DisconnectReason.loggedOut) {
        conn.logger.error('Logged out permanently. Please do pairing code again.');
        process.exit(0);
      }

      if (statusCode === DisconnectReason.badSession) {
        console.log('Bad session. Clearing auth state...');
        try {
          closeSQLiteAuthState(process.env.DB_PATH);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await import('fs').then(fs => {
            return Promise.all([
              fs.promises.unlink(`./${process.env.DB_PATH}`).catch(() => { }),
              fs.promises.unlink(`./${process.env.DB_PATH + "-shm"}`).catch(() => { }),
              fs.promises.unlink(`./${process.env.DB_PATH + "-wal"}`).catch(() => { })
            ]);
          });
        } catch (e) {
          conn.logger.error(`Failed to clear session: ${e}`);
        }
        process.exit(0);
      }

      if (
        statusCode === DisconnectReason.connectionClosed ||
        statusCode === DisconnectReason.connectionLost ||
        statusCode === DisconnectReason.connectionReplaced ||
        statusCode === DisconnectReason.timedOut
      ) {
        conn.logger.info('Connection issue detected. Attempting reconnect in 5s...');

        try {
          if (saveCreds && state?.creds) {
            await saveCreds();
            conn.logger.info('Credentials saved before reconnect');
          }
        } catch (e) {
          conn.logger.error(`Failed to save creds before reconnect: ${e}`);
        }

        setTimeout(async () => {
          try {
            await global.reloadHandler(true);
          } catch (e) {
            conn.logger.error(`Reconnect failed: ${e}`);
            process.exit(1);
          }
        }, 5000);
        return;
      }

      if (statusCode === DisconnectReason.restartRequired) {
        conn.logger.info('Restart required by WhatsApp...');

        try {
          if (saveCreds && state?.creds) {
            await saveCreds();
          }
        } catch (e) {
          conn.logger.error(`Failed to save creds: ${e}`);
        }

        setTimeout(async () => {
          try {
            await global.reloadHandler(true);
          } catch (e) {
            conn.logger.error(`Reconnect failed: ${e}`);
            process.exit(1);
          }
        }, 5000);
        return;
      }

      conn.logger.error(`Unknown disconnect reason: ${statusCode}`);
      setTimeout(async () => {
        try {
          if (saveCreds && state?.creds) {
            await saveCreds();
          }
          await global.reloadHandler(true);
        } catch (e) {
          conn.logger.error(`Reconnect failed: ${e}`);
          process.exit(1);
        }
      }, 5000);
    }
  }

  if (global.db.data == null) {
    await global.loadDatabase();
  }
}

process.on('uncaughtException', console.error)

let isInit = true
let handler = await import('./handler.js')
global.reloadHandler = async function reloadHandler(restartConn) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);

    if (Object.keys(Handler || {}).length) handler = Handler
  } catch (e) {
    console.error(e);
  }

  if (restartConn) {
    const oldChats = global.conn.chats
    try { global.conn.ws.close() } catch { }
    conn.ev.removeAllListeners()
    global.conn = makeWASocket(connOptions, { chats: oldChats })
    isInit = true
  }

  if (!isInit) {
    conn.ev.off('messages.upsert', conn.handler);
    conn.ev.off('connection.update', conn.connectionUpdate);
  }

  conn.handler = handler.handler.bind(global.conn);
  conn.connectionUpdate = connectionUpdate.bind(global.conn);
  conn.onCall = handler.onCall.bind(global.conn);

  conn.ev.on("messages.upsert", conn.handler);
  conn.ev.on("connection.update", conn.connectionUpdate);
  conn.ev.on("call", conn.onCall);

  isInit = false;
  return true;
}

function getAllJsFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);

    if (file.endsWith('_utils') && file.endsWith('_utils.js')) return;

    if (fs.statSync(fullPath).isDirectory()) {
      getAllJsFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.js')) {
      arrayOfFiles.push(fullPath);
    }
  })

  return arrayOfFiles;
}

let pluginsFolder = path.join(__dirname, "plugins");
let pluginsFilter = (filename) => /\.js$/.test(filename);

async function loadAllPlugins() {
  let jsFiles = getAllJsFiles(pluginsFolder);
  global.plugins = {};

  conn.logger.info(`Loading ${jsFiles.length} plugins, please wait...`);

  for (let fullPath of jsFiles) {
    const filename = path.relative(pluginsFolder, fullPath);

    if (filename.includes('_utils' + path.sep) || filename.endsWith('_utils.js')) continue;

    try {
      let file = global.__filename(path.join(pluginsFolder, filename))
      const module = await import(file)
      global.plugins[filename] = module.default || module
    } catch (e) {
      conn.logger.error(`Failed to load plugins ${filename}: ${e}`);
      delete global.plugins[filename]
    }
  }

  conn.logger.info("Plugins loaded... ✓");
  return Object.keys(global.plugins).length;
}

global.reload = async (filename) => {
  let relativePath = path.isAbsolute(filename)
    ? path.relative(pluginsFolder, filename)
    : filename;

  if (pluginsFilter(relativePath)) {
    let dir = global.__filename(path.join(pluginsFolder, relativePath), true);

    if (relativePath in global.plugins) {
      if (fs.existsSync(dir)) conn.logger.info("Re - require plugin " + relativePath);
      else {
        conn.logger.warn(`Deleted plugin ${relativePath}`);
        return delete global.plugins[relativePath];
      }
    } else conn.logger.info(`requiring new plugin '${relativePath}'`);

    let err = syntaxerror(fs.readFileSync(dir), relativePath, {
      sourceType: "module",
      allowAwaitOutsideFunction: true
    })

    if (err) conn.logger.error(`syntax error while loading '${relativePath}'\n${format(err)}`)

    else try {
      const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`))
      global.plugins[relativePath] = module.default || module
    } catch (e) {
      conn.logger.error(`error require plugin '${relativePath}\n${format(e)}'`)
      delete global.plugins[relativePath];
    } finally {
      global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)))
    }
  }
}

async function _quickTest() {
  let test = await Promise.all([
    spawn('ffmpeg'),
    spawn('ffprobe'),
    spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
    spawn('convert'),
    spawn('magick'),
    spawn('gm'),
    spawn('find', ['--version'])
  ].map(p => {
    return Promise.race([
      new Promise(resolve => {
        p.on('close', code => {
          resolve(code !== 127);
        });
      }),
      new Promise(resolve => {
        p.on('error', _ => resolve(false));
      })
    ]);
  }));

  let [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test;

  let s = global.support = {
    ffmpeg,
    ffprobe,
    ffmpegWebp,
    convert,
    magick,
    gm,
    find
  };

  Object.freeze(global.support);

  if (!s.ffmpeg) {
    conn.logger.warn(`Please install ffmpeg first to be able to process videos.`);
  }

  if (s.ffmpeg && !s.ffmpegWebp) {
    conn.logger.warn('Stickers May Not Animate without libwebp in ffmpeg (--enable-libwebp while compiling ffmpeg)');
  }

  if (!s.convert && !s.magick && !s.gm) {
    conn.logger.warn('Sticker Feature May Not Work Without imagemagick and libwebp in ffmpeg not installed');
  }
}

async function initialize() {
  try {
    conn.logger.info("Initializing bot...");
    
    await global.loadDatabase();
    
    global.db.startAutoBackup(6, 'data/backups');
    
    global.db.cleanupInterval = setInterval(() => {
      global.db.cleanOldBackups('data/backups', 7);
    }, 24 * 60 * 60 * 1000);
    
    await _quickTest().catch(console.error);
    await loadAllPlugins();
    await global.reloadHandler();    

    if (!opts["test"]) {
      setInterval(async () => {
        if (global.db.data) await global.db.write().catch(console.error);
      }, 30000);
    }

    if (!opts["test"]) {
      setInterval(() => {
        if ((global.support || {}).find) {
          const tmp = [tmpdir(), 'tmp'];
          tmp.forEach(filename => spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']));
        }
      }, 30000);
    }

    const watcher = chokidar.watch(pluginsFolder, {
      persistent: true,
      ignoreInitial: true,
      usePolling: false,
      depth: Infinity,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      },
    });

    watcher
      .on("change", global.reload)
      .on("add", global.reload)
      .on("unlink", global.reload);

    conn.logger.info("Bot successfully initialized!");
  } catch (e) {
    conn.logger.error("Failed to initialize bot: " + e)
    process.exit(0);
  }
}

initialize()