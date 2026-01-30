import { createInterface } from 'readline';
import cfonts from 'cfonts';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { setupMaster, fork } from 'cluster';
import { watchFile, unwatchFile } from 'fs';
import yargs from "yargs";
import { createRequire } from 'module';

const { say } = cfonts;
const rl = createInterface(process.stdin, process.stdout);
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(__dirname);
const { author } = require(join(__dirname, './package.json'));

say("Yuki", {
  font: "chrome",
  align: "center",
  gradient: ["red", "magenta"]
})

say(`Made by ${author.name || author}`, {
  font: "console",
  align: "center",
  gradient: ["red", "magenta"]
})

var isRunning = false;

function start(file) {
  if (isRunning) return;
  isRunning = true;
  let args = [join(__dirname, file), ...process.argv.slice(2)];

  setupMaster({ exec: args[0], args: args.slice(1) });
  let p = fork();

  p.on('message', data => {
    console.log('[RECEIVED]', data);
    switch (data) {
      case 'reset':
        p.kill(); // Change here
        isRunning = false;
        start(file);
        break;
      case 'uptime':
        p.send(process.uptime());
        break;
      default:
        console.warn('[UNRECOGNIZED MESSAGE]', data);
    }
  });

  p.on('exit', (_, code) => {
    isRunning = false;
    console.error('[❗] Exited with code:', code);
    if (code !== 0) {
      console.log('Restarting worker due to non-zero exit code...');
      return start(file);
    }

    watchFile(args[0], () => {
      unwatchFile(args[0]);
      start(file);
    });
  });

  let opts = yargs(process.argv.slice(2)).exitProcess(false).parse();

  if (!opts['test']) {
    if (!rl.listenerCount()) {
      rl.on('line', line => {
        p.emit('message', line.trim());
      });
    }
  }
}

start("main.js");
