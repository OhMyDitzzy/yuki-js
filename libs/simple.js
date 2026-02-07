import _makeWASocket, { areJidsSameUser, downloadContentFromMessage, extractMessageContent, generateForwardMessageContent, generateWAMessage, delay, generateWAMessageFromContent, getDevice, isJidNewsletter, jidDecode, proto, WAMessageStubType, prepareWAMessageMedia } from "baileys";
import { toAudio } from "./converter.js";
import chalk from "chalk";
import { format } from "util";
import os from "os";
import PhoneNumber from "awesome-phonenumber";
import { fileTypeFromBuffer } from "file-type";
import fs from "fs";
import path, { dirname } from "path";
import { Jimp, JimpMime } from 'jimp';
import { makeInMemoryStore } from "./makeInMemoryStore.js"
import pino from "pino";
import { randomBytes } from "crypto";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

global.store = await makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }), saveInterval: 60000 })

export function makeWASocket(config, options = {}) {
  const conn = _makeWASocket(config);

  const sock = Object.defineProperties(conn, {
    chats: {
      value: { ...(options.chats || {}) },
      writable: true
    },
    decodeJid: {
      value(jid) {
        if (!jid || typeof jid !== 'string') return (!nullish(jid) && jid) || null
        return jid.decodeJid()
      }
    },
    logger: {
      get() {
        return {
          info(...args) {
            console.log(
              chalk.bold.bgRgb(51, 204, 51)('INFO '),
              `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
              chalk.cyan(format(...args))
            )
          },
          error(...args) {
            console.log(
              chalk.bold.bgRgb(247, 38, 33)('ERROR '),
              `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
              chalk.rgb(255, 38, 0)(format(...args))
            )
          },
          warn(...args) {
            console.log(
              chalk.bold.bgRgb(255, 153, 0)('WARNING '),
              `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
              chalk.redBright(format(...args))
            )
          },
          trace(...args) {
            console.log(
              chalk.grey('TRACE '),
              `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
              chalk.white(format(...args))
            )
          },
          debug(...args) {
            console.log(
              chalk.bold.bgRgb(66, 167, 245)('DEBUG '),
              `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
              chalk.white(format(...args))
            )
          }
        }
      },
      enumerable: true
    },

    getFile: {
      async value(PATH, saveToFile = false) {
        try {
          let res, filename;
          let data = Buffer.isBuffer(PATH)
            ? PATH
            : PATH instanceof ArrayBuffer
              ? Buffer.from(PATH)
              : /^data:.*?\/.*?;base64,/i.test(PATH)
                ? Buffer.from(PATH.split(',')[1], 'base64')
                : /^https?:\/\//.test(PATH)
                  ? (res = await fetch(PATH), Buffer.from(await res.arrayBuffer()))
                  : fs.existsSync(PATH)
                    ? (filename = PATH, fs.readFileSync(PATH))
                    : typeof PATH === 'string'
                      ? Buffer.from(PATH)
                      : Buffer.alloc(0);
          if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer');

          const type = await fileTypeFromBuffer(data) || {
            mime: 'application/octet-stream',
            ext: 'bin'
          };

          if (data && saveToFile && !filename) {
            filename = path.join(__dirname, '../tmp/' + Date.now() + '.' + type.ext);
            await fs.promises.writeFile(filename, data);
          }

          return {
            res,
            filename,
            ...type,
            data,
            deleteFile() {
              return filename && fs.promises.unlink(filename);
            }
          };
        } catch (err) {
          console.error('Error:', err);
        }
      },
      enumerable: true
    },
    sendFile: {
      async value(jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) {
        try {
          let type = await conn.getFile(path, true);
          let { res, data: file, filename: pathFile } = type;

          if ((res && res.status !== 200) || (!res && file.length <= 65536)) {
            try { throw { json: JSON.parse(file.toString()) } }
            catch (e) { if (e.json) throw e.json }
          }

          const getMimeType = function(mime, options) {
            if (/webp/.test(mime) || (options.asSticker && /image/.test(mime))) return 'sticker';
            if (/image/.test(mime) || (options.asImage && /webp/.test(mime))) return 'image';
            if (/video/.test(mime)) return 'video';
            if (/audio/.test(mime)) return 'audio';
            return 'document';
          };
          let mtype = getMimeType(type.mime, options);
          let mimetype = options.mimetype || type.mime;
          if (/audio/.test(type.mime)) {
            let convert = await toAudio(file, type.ext);
            file = convert.data;
            pathFile = convert.filename;
            mtype = 'audio';
            mimetype = options.mimetype || 'audio/ogg; codecs=opus';
          }

          let message = {
            caption,
            ptt,
            [mtype]: file,
            mimetype,
            fileName: filename || (pathFile ? pathFile.split('/').pop() : undefined),
            ...options
          };

          let opt = { filename, quoted, ptt, upload: conn.waUploadToServer, ...options };
          let m = await conn.sendMessage(jid, message, opt);

          return m;
        } catch (e) {
          throw new Error('Error: ' + e);
        }
      },
      enumerable: true
    },
    sendContact: {
      async value(jid, data, quoted, options = {}) {
        try {
          if (!Array.isArray(data[0]) && typeof data[0] === 'string') data = [data];

          let contacts = [];
          for (let [number, name] of data) {
            number = number.replace(/[^0-9]/g, '');
            if (!number) throw new Error('Invalid phone number provided.');

            let njid = number + '@s.whatsapp.net';

            let biz = await conn.getBusinessProfile(njid).catch(_ => null) || {};
            let vname = conn.chats[njid]?.vname || conn.getName(njid) || name;
            let bizDescription = biz.description ? `\nX-WA-BIZ-NAME:${vname}\nX-WA-BIZ-DESCRIPTION:${biz.description.replace(/\n/g, '\\n')}` : '';

            let vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${name.replace(/\n/g, '\\n')}
TEL;type=CELL;type=VOICE;waid=${number}:${PhoneNumber('+' + number).getNumber('international')}${bizDescription}
END:VCARD`.trim();

            contacts.push({ vcard, displayName: name });
          }

          return await conn.sendMessage(jid, {
            ...options,
            contacts: {
              displayName: (contacts.length > 1 ? `${contacts.length} contacts` : contacts[0].displayName) || null,
              contacts
            }
          }, { quoted, ...options });
        } catch (err) {
          throw new Error('Error: ' + err.message);
        }
      },
      enumerable: true
    },
    sendAlbum: {
      async value(jid, medias, options = {}) {
        for (const media of medias) {
          if (!media.image && !media.video)
            throw new TypeError(`medias[i] must have image or video property`)
        }

        const time = options.delay || 500
        delete options.delay

        const album = generateWAMessageFromContent(jid, {
          albumMessage: {
            expectedImageCount: medias.filter(media => media.image).length,
            expectedVideoCount: medias.filter(media => media.video).length,
            ...options
          }
        }, { userJid: conn.user.lid, ...options })
        await conn.relayMessage(jid, album.message, { messageId: album.key.id })

        let msg;
        for (const i in medias) {
          const media = medias[i]
          if (media.image) {
            msg = await generateWAMessage(jid, {
              image: media.image,
              ...media,
              ...options
            }, {
              userJid: conn.user.lis,
              upload: async (readStream, opts) => {
                const up = await conn.waUploadToServer(readStream, {
                  ...opts,
                  newsletter: isJidNewsletter(jid)
                })
                return up
              },
              ...options
            })
          } else if (media.video) {
            msg = await generateWAMessage(jid, {
              video: media.video,
              ...media,
              ...options
            }, {
              userJid: conn.user.lid,
              upload: async (readStream, opts) => {
                const up = await conn.waUploadToServer(readStream, {
                  ...opts,
                  newsletter: isJidNewsletter(jid)
                })
                return up
              },
              ...options,
            })
          }
          if (msg) {
            msg.message.messageContextInfo = {
              messageSecret: randomBytes(32),
              messageAssociation: {
                associationType: 1,
                parentMessageKey: album.key
              }
            }
          }
          await conn.relayMessage(jid, msg.message, {
            messageId: msg.key.id
          })
          await delay(time)
        }
      },
      enumerable: true
    },
    sendCarousel: {
      async value(
        jid,
        bodyOpts,
        cards,
        quoted,
      ) {
        try {
          let preparedCards = await Promise.all(cards.map(async (card) => {
            let imageMedia;
            if (card.image) {
              if (Buffer.isBuffer(card.image)) {
                imageMedia = await prepareWAMessageMedia(
                  { image: card.image },
                  { upload: conn.waUploadToServer }
                );
              } else if (typeof card.image === 'string') {
                imageMedia = await prepareWAMessageMedia(
                  { image: { url: card.image } },
                  { upload: conn.waUploadToServer }
                );
              }
            }

            let cardButtons = card.buttons ? card.buttons.map((button) => {
              if (button.type === "url") {
                return {
                  name: "cta_url",
                  buttonParamsJson: JSON.stringify({
                    display_text: button.text,
                    url: button.url,
                    merchant_url: button.url
                  })
                };
              } else if (button.type === 'copy') {
                return {
                  name: "cta_copy",
                  buttonParamsJson: JSON.stringify({
                    display_text: button.text,
                    id: button.id,
                    copy_code: button.copy_code
                  })
                };
              } else if (button.type === 'buttons') {
                return {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: button.text,
                    id: button.id
                  })
                };
              } else if (button.type === "reminder") {
                return {
                  name: "cta_reminder",
                  buttonParamsJson: JSON.stringify({
                    display_text: button.text,
                    id: button.id
                  })
                };
              } else if (button.type === "webview") {
                return {
                  name: "open_webview",
                  buttonParamsJson: JSON.stringify({
                    link: {
                      in_app_webview: true,
                      display_text: button.text,
                      url: button.url,
                      success_url: button.url + "/success",
                      cancel_url: button.url + "/cancel"
                    }
                  })
                };
              }
            }) : [];

            return {
              ...(card.header && imageMedia && {
                header: proto.Message.InteractiveMessage.Header.create({
                  title: card.header,
                  hasMediaAttachment: true,
                  ...imageMedia
                })
              }),
              ...(card.body && {
                body: proto.Message.InteractiveMessage.Body.create({
                  text: card.body
                })
              }),
              ...(card.footer && {
                footer: proto.Message.InteractiveMessage.Footer.create({
                  text: card.footer
                })
              }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: cardButtons
              })
            };
          }));

          let msg = generateWAMessageFromContent(jid, {
            interactiveMessage: proto.Message.InteractiveMessage.create({
              ...(bodyOpts.contextInfo && {
                contextInfo: bodyOpts.contextInfo
              }),
              ...(bodyOpts.header && {
                header: proto.Message.InteractiveMessage.Header.create(bodyOpts.header)
              }),
              ...(bodyOpts.body && {
                body: proto.Message.InteractiveMessage.Body.create(bodyOpts.body)
              }),
              ...(bodyOpts.footer && {
                footer: proto.Message.InteractiveMessage.Footer.create(bodyOpts.footer)
              }),
              carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
                cards: preparedCards
              })
            })
          }, quoted);

          await conn.relayMessage(jid, msg.message, {
            messageId: msg.key.id
          });
        } catch (e) {
          console.error('Error sending carousel:', e);
        }
      }
    },
    sendButtonLoc: {
      async value(jid, text, footer, btn, locOpts = {}, options = {}) {
        try {
          if (!jid) throw new TypeError("jid is required");
          if (!text) throw new TypeError("text is required");
          if (!Array.isArray(btn)) throw new TypeError("btn must be an array");

          const buttonLimit = 3;

          const validButtons = btn.slice(0, buttonLimit).filter(b =>
            Array.isArray(b) && b.length >= 2 && b[0] && b[1]
          );

          if (validButtons.length === 0) {
            throw new Error("At least one valid button is required");
          }

          const buttons = validButtons.map((b) => {
            const [buttonText, buttonId] = b;

            return {
              buttonId: buttonId.toString().trim(),
              buttonText: {
                displayText: buttonText.toString().trim()
              },
              type: 1
            };
          });

          const content = {
            buttonsMessage: {
              contentText: text.toString(),
              footerText: footer ? footer.toString() : undefined,
              buttons: buttons,
              headerType: 6
            }
          };

          content.buttonsMessage.locationMessage = {
            degreesLatitude: 0,
            degreesLongitude: 0,
          };

          if (locOpts && typeof locOpts === 'object') {
            const {
              degreesLatitude,
              degreesLongitude,
              name,
              address,
              jpegThumbnail
            } = locOpts;

            if (degreesLatitude !== undefined) {
              content.buttonsMessage.locationMessage.degreesLatitude = parseFloat(degreesLatitude) || 0;
            }

            if (degreesLongitude !== undefined) {
              content.buttonsMessage.locationMessage.degreesLongitude = parseFloat(degreesLongitude) || 0;
            }

            if (name !== undefined) {
              content.buttonsMessage.locationMessage.name = name.toString();
            }

            if (address !== undefined) {
              content.buttonsMessage.locationMessage.address = address.toString();
            }

            if (jpegThumbnail !== undefined) {
              content.buttonsMessage.locationMessage.jpegThumbnail = jpegThumbnail;
            }
          }

          if (options && typeof options === 'object') {
            if (options.contextInfo) {
              content.buttonsMessage.contextInfo = options.contextInfo;
            }

            if (options.mentions) {
              content.buttonsMessage.mentions = options.mentions;
            }
          }

          const msg = generateWAMessageFromContent(
            jid,
            content,
            {
              ...options,
              userJid: this.user.id
            }
          );

          await conn.relayMessage(jid, msg.message, {
            messageId: msg.key.id,
          });

        } catch (error) {
          console.error('Error in sendButtonLoc:', error);
          throw error;
        }
      }
    },
    sendButton: {
      async value(jid, btnOpts, buttons, quoted) {
        try {
          let interactiveBtn = buttons.map((button) => {
            if (button.type === "url") {
              return {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: button.text,
                  url: button.url,
                  merchant_url: button.url
                })
              }
            } else if (button.type === 'copy') {
              return {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                  display_text: button.text,
                  id: button.id,
                  copy_code: button.copy_code
                })
              }
            } else if (button.type === 'buttons') {
              return {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: button.text,
                  id: button.id
                })
              };
            } else if (button.type === "reminder") {
              return {
                name: "cta_reminder",
                buttonParamsJson: JSON.stringify({
                  display_text: button.text,
                  id: button.id
                })
              }
            } else if (button.type === "webview") {
              return {
                name: "open_webview",
                buttonParamsJson: JSON.stringify({
                  link: {
                    in_app_webview: true,
                    display_text: button.text,
                    url: button.url,
                    success_url: button.url + "/success",
                    cancel_url: button.url + "/cancel"
                  }
                })
              }
            }
          });

          let msg = generateWAMessageFromContent(jid, {
            interactiveMessage: proto.Message.InteractiveMessage.create({
              ...(btnOpts.contextInfo && {
                contextInfo: btnOpts.contextInfo
              }),
              ...(btnOpts.header && {
                header: proto.Message.InteractiveMessage.Header.create(btnOpts.header)
              }),
              ...(btnOpts.body && {
                body: proto.Message.InteractiveMessage.Body.create(btnOpts.body)
              }),
              ...(btnOpts.footer && {
                footer: proto.Message.InteractiveMessage.Footer.create(btnOpts.footer)
              }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: interactiveBtn
              })
            })
          }, quoted)

          await conn.relayMessage(jid, msg.message, {
            messageId: msg.key.id,
          })
        } catch (e) {
          console.error(`Error sending button message: ${e}`)
        }
      }
    },
    sendList: {
      async value(
        jid,
        btnOpts,
        buttons,
        quoted
      ) {
        try {
          let msg = generateWAMessageFromContent(jid, {
            interactiveMessage: proto.Message.InteractiveMessage.create({
              ...(btnOpts.contextInfo && {
                contextInfo: btnOpts.contextInfo
              }),
              ...(btnOpts.header && {
                header: proto.Message.InteractiveMessage.Header.create(btnOpts.header)
              }),
              ...(btnOpts.body && {
                body: proto.Message.InteractiveMessage.Body.create(btnOpts.body)
              }),
              ...(btnOpts.footer && {
                footer: proto.Message.InteractiveMessage.Footer.create(btnOpts.footer)
              }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: [{
                  name: "single_select",
                  buttonParamsJson: JSON.stringify(buttons)
                }],
                ...(btnOpts.messageParamsJson && {
                  messageParamsJson: JSON.stringify(btnOpts.messageParamsJson)
                })
              })
            })
          }, quoted)

          await conn.relayMessage(jid, msg.message, {
            messageId: msg.key.id,
          })
        } catch (e) {
          console.error(e)
        }
      },
      enumerable: true
    },
    sendSticker: {
      async value(jid, path, quoted, exif = {}) {
        const { data, mime } = await conn.getFile(path)
        if (!data || data.length === 0) throw new TypeError('File not found')
        const meta = {
          packName: (exif.packName ?? exif.packname ?? global.stickpack) || '',
          packPublish: (exif.packPublish ?? exif.packpublish ?? global.stickauth) || ''
        }
        const sticker = await (await import('./exif.js')).writeExif({ mimetype: mime, data }, meta)
        return conn.sendMessage(jid, { sticker }, { quoted, upload: conn.waUploadToServer })
      },
    },
    resize: {
      async value(image, width, height) {
        let oyy = await Jimp.read(image)
        let kiyomasa = await oyy.resize(width, height).getBuffer(JimpMime.jpeg)
        return kiyomasa
      }
    },
    reply: {
      value(
        jid,
        text = "",
        quoted,
        options
      ) {
        let cleanText = typeof text === "string" ? text.replace(/@lid/g, "") : text;
        return Buffer.isBuffer(text)
          ? conn.sendFile(jid, text, "file", "", quoted, false, options)
          : conn.sendMessage(
            jid,
            {
              ...options,
              text: cleanText,
              contextInfo: {
                mentionedJid: conn.parseMention(text),
                ...(global.adReply?.contextInfo || {}),
              },
              ...options,
            },
            {
              quoted,
              ephemeralExpiration: global.ephemeral,
              ...options,
            },
          );
      },
    },
    sendMedia: {
      async value(jid, path, quoted, options = {}) {
        try {
          let type = await conn.getFile(path, true);
          let { ext, mime, data: file } = type;

          if (!mime) throw new Error('File type could not be determined.');

          let getMediaType = function(mime, options) {
            if (options.asDocument) return 'document';
            if (/image/.test(mime)) return 'image';
            if (/video/.test(mime)) return 'video';
            if (/audio/.test(mime)) return 'audio';
            return null;
          }

          let mediaType = getMediaType(mime, options);
          if (!mediaType) throw new Error('Unsupported media type.');
          let message = {
            [mediaType]: file,
            mimetype: mime,
            fileName: options.fileName || path.split('/').pop(),
            ...options
          };
          return await conn.sendMessage(jid, message, { quoted });
        } catch (err) {
          throw new Error('Error: ' + err.message);
        }
      },
      enumerable: true
    },
    downloadM: {
      async value(m, type, saveToFile) {
        try {
          if (!m || !(m.url || m.directPath)) {
            throw new Error("Invalid message or media not found.");
          }

          const dlType = type === "sticker" ? "image" : type;
          let stream;
          try {
            stream = await downloadContentFromMessage(m, dlType);
          } catch (e) {
            if (
              /readableStream/i.test(String(e?.message)) &&
              /PassThrough/i.test(String(e?.message))
            ) {
              const nodeStream = await import("stream");
              const origFromWeb = nodeStream.Readable.fromWeb?.bind(
                nodeStream.Readable,
              );
              if (origFromWeb) {
                try {
                  nodeStream.Readable.fromWeb = function(rs, opts) {
                    if (rs && typeof rs.getReader !== "function") return rs;
                    return origFromWeb(rs, opts);
                  };
                  stream = await downloadContentFromMessage(m, dlType);
                } finally {
                  nodeStream.Readable.fromWeb = origFromWeb;
                }
              } else {
                throw e;
              }
            } else {
              throw e;
            }
          }

          const toBuffer = async (s) => {
            if (s && typeof s.getReader === "function") {
              const reader = s.getReader();
              const chunks = [];
              for (; ;) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) chunks.push(Buffer.from(value));
              }
              return Buffer.concat(chunks);
            }

            if (s && typeof s[Symbol.asyncIterator] === "function") {
              const chunks = [];
              for await (const chunk of s) {
                chunks.push(Buffer.from(chunk));
              }
              return Buffer.concat(chunks);
            }
            throw new Error(
              "Unsupported stream type from downloadContentFromMessage",
            );
          };

          const buffer = await toBuffer(stream);

          if (saveToFile) {
            const fileType = await fileTypeFromBuffer(buffer);
            const filename =
              saveToFile || `downloaded_media.${fileType?.ext || "bin"}`;
            await fs.promises.writeFile(filename, buffer);
            return filename;
          }

          return buffer;
        } catch (err) {
          console.error("Error downloading media message:", err);
          throw new Error("Failed to download media: " + err.message);
        }
      },
      enumerable: true,
    },
    downloadAndSaveMediaMessage: {
      async value(message, filename, attachExtension = true) {
        try {
          let quoted = message.msg || message;
          let mime = (message.msg || message).mimetype || '';
          let messageType = mime.split('/')[0];

          if (!['image', 'video', 'audio', 'document'].includes(messageType)) {
            throw new Error('Message does not contain downloadable media.');
          }

          const dlType = messageType === 'sticker' ? 'image' : messageType;
          let stream;
          try {
            stream = await downloadContentFromMessage(quoted, dlType);
          } catch (e) {
            if (/readableStream/i.test(String(e?.message)) && /PassThrough/i.test(String(e?.message))) {
              const nodeStream = await import('stream');
              const origFromWeb = nodeStream.Readable.fromWeb?.bind(nodeStream.Readable);
              if (origFromWeb) {
                try {
                  nodeStream.Readable.fromWeb = function(rs, opts) {
                    if (rs && typeof rs.getReader !== 'function') return rs;
                    return origFromWeb(rs, opts);
                  };
                  stream = await downloadContentFromMessage(quoted, dlType);
                } finally {
                  nodeStream.Readable.fromWeb = origFromWeb;
                }
              } else {
                throw e;
              }
            } else {
              throw e;
            }
          }

          const toBuffer = async (s) => {
            if (s && typeof s.getReader === 'function') {
              const reader = s.getReader();
              const chunks = [];
              for (; ;) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) chunks.push(Buffer.from(value));
              }
              return Buffer.concat(chunks);
            }
            if (s && typeof s[Symbol.asyncIterator] === 'function') {
              const chunks = [];
              for await (const chunk of s) {
                chunks.push(Buffer.from(chunk));
              }
              return Buffer.concat(chunks);
            }
            throw new Error('Unsupported stream type from downloadContentFromMessage');
          };

          const buffer = await toBuffer(stream);
          let fileType = await fileTypeFromBuffer(buffer);
          if (!fileType) {
            fileType = { ext: 'bin', mime: 'application/octet-stream' };
          }

          const trueFileName = attachExtension ? `${filename}.${fileType.ext}` : filename;
          await fs.promises.writeFile(trueFileName, buffer);

          return trueFileName;
        } catch (err) {
          throw new Error('Error: ' + err.message);
        }
      },
      enumerable: true
    },
    delay: {
      async value(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms)
        )
      }
    },
    cMod: {
      value(jid, message, text = '', sender = conn.user.jid, options = {}) {
        if (options.mentions && !Array.isArray(options.mentions)) options.mentions = [options.mentions]
        let copy = message.toJSON()
        delete copy.message.messageContextInfo
        delete copy.message.senderKeyDistributionMessage
        let mtype = Object.keys(copy.message)[0]
        let msg = copy.message
        let content = msg[mtype]
        if (typeof content === 'string') msg[mtype] = text || content
        else if (content.caption) content.caption = text || content.caption
        else if (content.text) content.text = text || content.text
        if (typeof content !== 'string') {
          msg[mtype] = { ...content, ...options }
          msg[mtype].contextInfo = {
            ...(content.contextInfo || {}),
            mentionedJid: options.mentions || content.contextInfo?.mentionedJid || []
          }
        }
        if (copy.participant) sender = copy.participant = sender || copy.participant
        else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
        if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid
        else if (copy.key.remoteJid.includes('@broadcast')) sender = sender || copy.key.remoteJid
        copy.key.remoteJid = jid
        copy.key.fromMe = areJidsSameUser(sender, conn.user.id) || false
        return proto.WebMessageInfo.create(copy)
      },
      enumerable: true
    },
    copyNForward: {
      async value(jid, message, forwardingScore = true, options = {}) {
        let vtype
        if (options.readViewOnce && message.message.viewOnceMessage?.message) {
          vtype = Object.keys(message.message.viewOnceMessage.message)[0]
          delete message.message.viewOnceMessage.message[vtype].viewOnce
          message.message = proto.Message.create(
            JSON.parse(JSON.stringify(message.message.viewOnceMessage.message))
          )
          message.message[vtype].contextInfo = message.message.viewOnceMessage.contextInfo
        }
        let mtype = Object.keys(message.message)[0]
        let m = generateForwardMessageContent(message, !!forwardingScore)
        let ctype = Object.keys(m)[0]
        if (forwardingScore && typeof forwardingScore === 'number' && forwardingScore > 1) m[ctype].contextInfo.forwardingScore += forwardingScore
        m[ctype].contextInfo = {
          ...(message.message[mtype].contextInfo || {}),
          ...(m[ctype].contextInfo || {})
        }
        m = generateWAMessageFromContent(jid, m, {
          ...options,
          userJid: conn.user.jid
        })
        await conn.relayMessage(jid, m.message, { messageId: m.key.id, additionalAttributes: { ...options } })
        return m
      },
      enumerable: true
    },
    parseMention: {
      value(text) {
        if (!text) return [];
        const mentions = [];

        const regexLid = /@?([0-9]{10,25}@lid)/g;
        const regexJid = /@([0-9]{5,16})(?!@lid)/g;

        let match;

        while ((match = regexLid.exec(text)) !== null) {
          mentions.push(match[1]);
        }
        const lidNumbers = mentions.map(lid => lid.replace(/@lid$/, ''));

        while ((match = regexJid.exec(text)) !== null) {
          const numberId = match[1];

          if (lidNumbers.includes(numberId)) continue;

          mentions.push(numberId + "@s.whatsapp.net");
        }

        return mentions;
      },
      enumerable: true
    },
    saveName: {
      async value(id, name = '') {
        if (!id) return
        id = conn.decodeJid(id)
        let isGroup = id.endsWith('@g.us')
        if (id in conn.contacts && conn.contacts[id][isGroup ? 'subject' : 'name'] && id in conn.chats) return
        let metadata = {}
        if (isGroup) metadata = await conn.groupMetadata(id)
        let chat = { ...(conn.contacts[id] || {}), id, ...(isGroup ? { subject: metadata.subject, desc: metadata.desc } : { name }) }
        conn.contacts[id] = chat
        conn.chats[id] = chat
      }
    },
    getName: {
      value(jid = '', withoutContact = false) {
        jid = conn.decodeJid(jid)
        withoutContact = conn.withoutContact || withoutContact
        let v
        if (jid.endsWith('@g.us')) return new Promise(async (resolve) => {
          v = conn.chats[jid] || {}
          if (!(v.name || v.subject)) v = await conn.groupMetadata(jid) || {}
          resolve(v.name || v.subject || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = jid === '0@s.whatsapp.net' ? {
          jid,
          vname: 'WhatsApp'
        } : areJidsSameUser(jid, conn.user.id) ?
          conn.user :
          (conn.chats[jid] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.vname || v.notify || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
      },
      enumerable: true
    },
    loadMessage: {
      value(messageID) {
        return Object.entries(conn.chats)
          .filter(([_, { messages }]) => typeof messages === 'object')
          .find(([_, { messages }]) => Object.entries(messages)
            .find(([k, v]) => (k === messageID || v.key?.id === messageID)))
          ?.[1].messages?.[messageID]
      },
      enumerable: true
    },
    processMessageStubType: {
      async value(m) {
        if (!m.messageStubType) return;
        const chat = await conn.decodeJid(
          m.key.remoteJid ||
          m.message?.senderKeyDistributionMessage?.groupId ||
          "",
        );
        if (!chat || chat === "status@broadcast") return;
        const emitGroupUpdate = (update) => {
          conn.ev.emit("groups.update", [{ id: chat, ...update }]);
        };
        switch (m.messageStubType) {
          case WAMessageStubType.REVOKE:
          case WAMessageStubType.GROUP_CHANGE_INVITE_LINK:
            emitGroupUpdate({ revoke: m.messageStubParameters[0] });
            break;
          case WAMessageStubType.GROUP_CHANGE_ICON:
            emitGroupUpdate({ icon: m.messageStubParameters[0] });
            break;
          default: {
            console.log({
              messageStubType: m.messageStubType,
              messageStubParameters: m.messageStubParameters,
              type: WAMessageStubType[m.messageStubType],
            });
            break;
          }
        }
        const isGroup = chat.endsWith("@g.us");
        if (!isGroup) return;
        let chats = conn.chats[chat];
        if (!chats) chats = conn.chats[chat] = { id: chat };
        chats.isChats = true;
        const metadata = await conn.groupMetadata(chat).catch(() => null);
        if (!metadata) return;
        chats.subject = metadata.subject;
        chats.metadata = metadata;
      },
    },
    insertAllGroup: {
      async value() {
        const groups = await conn.groupFetchAllParticipating().catch(_ => null) || {}
        for (const group in groups) conn.chats[group] = { ...(conn.chats[group] || {}), id: group, subject: groups[group].subject, isChats: true, metadata: groups[group] }
        return conn.chats
      },
    },
    pushMessage: {
      async value(m) {
        if (!m) return;
        if (!Array.isArray(m)) m = [m];
        for (const message of m) {
          try {
            if (!message) continue;
            if (
              message.messageStubType &&
              message.messageStubType != WAMessageStubType.CIPHERTEXT
            )
              conn.processMessageStubType(message).catch(console.error);
            const _mtype = Object.keys(message.message || {});
            const mtype =
              (!["senderKeyDistributionMessage", "messageContextInfo"].includes(
                _mtype[0],
              ) &&
                _mtype[0]) ||
              (_mtype.length >= 3 &&
                _mtype[1] !== "messageContextInfo" &&
                _mtype[1]) ||
              _mtype[_mtype.length - 1];
            const chat = await conn.decodeJid(
              message.key.remoteJid ||
              message.message?.senderKeyDistributionMessage?.groupId ||
              "",
            );
            if (mtype && message.message[mtype] && message.message[mtype].contextInfo?.quotedMessage) {
              let context = message.message[mtype].contextInfo;
              if (!context || !context.quotedMessage || typeof context.quotedMessage !== 'object' || Object.keys(context.quotedMessage).length === 0) {
                continue;
              }

              let participant = await conn.decodeJid(context.participant);
              const remoteJid = await conn.decodeJid(
                context.remoteJid || participant,
              );

              let quoted =
                message.message[mtype].contextInfo.quotedMessage;
              if (!quoted) continue;
              if (remoteJid && remoteJid !== "status@broadcast" && quoted) {
                let qMtype = Object.keys(quoted)[0];
                if (qMtype == "conversation") {
                  quoted.extendedTextMessage = { text: quoted[qMtype] };
                  delete quoted.conversation;
                  qMtype = "extendedTextMessage";
                }
                if (!quoted[qMtype].contextInfo)
                  quoted[qMtype].contextInfo = {};
                quoted[qMtype].contextInfo.mentionedJid =
                  context.mentionedJid ||
                  quoted[qMtype].contextInfo.mentionedJid ||
                  [];
                const isGroup = remoteJid.endsWith("g.us");
                if (isGroup && !participant) participant = remoteJid;
                const qM = {
                  key: {
                    remoteJid,
                    fromMe: areJidsSameUser(conn.user.jid, remoteJid),
                    id: context.stanzaId,
                    participant,
                  },
                  message: JSON.parse(JSON.stringify(quoted)),
                  ...(isGroup ? { participant } : {}),
                };
                let qChats = conn.chats[participant];
                if (!qChats)
                  qChats = conn.chats[participant] = {
                    id: participant,
                    isChats: !isGroup,
                  };
                if (!qChats.messages) qChats.messages = {};
                if (!qChats.messages[context.stanzaId] && !qM.key.fromMe)
                  qChats.messages[context.stanzaId] = qM;
                let qChatsMessages;
                if (
                  (qChatsMessages = Object.entries(qChats.messages)).length > 40
                )
                  qChats.messages = Object.fromEntries(
                    qChatsMessages.slice(30, qChatsMessages.length),
                  );
              }
            }
            if (!chat || chat === "status@broadcast") continue;
            const isGroup = chat.endsWith("@g.us");
            let chats = conn.chats[chat];
            if (!chats) {
              if (isGroup) await conn.insertAllGroup().catch(console.error);
              chats = conn.chats[chat] = {
                id: chat,
                isChats: true,
                ...(conn.chats[chat] || {}),
              };
            }
            let metadata, sender;
            if (isGroup) {
              if (!chats.subject || !chats.metadata) {
                metadata =
                  (await conn.groupMetadata(chat).catch(() => ({}))) || {};
                if (!chats.subject) chats.subject = metadata.subject || "";
                if (!chats.metadata) chats.metadata = metadata;
              }
              sender = await conn.decodeJid(
                (message.key?.fromMe && conn.user.id) ||
                message.participant ||
                message.key?.participant ||
                chat ||
                "",
              );
              if (sender !== chat) {
                let chats = conn.chats[sender];
                if (!chats) chats = conn.chats[sender] = { id: sender };
                if (!chats.name)
                  chats.name = message.pushName || chats.name || "";
              }
            } else if (!chats.name)
              chats.name = message.pushName || chats.name || "";
            if (
              ["senderKeyDistributionMessage", "messageContextInfo"].includes(
                mtype,
              )
            )
              continue;
            chats.isChats = true;
            if (!chats.messages) chats.messages = {};
            const fromMe =
              message.key.fromMe ||
              areJidsSameUser(sender || chat, conn.user.id);
            if (
              !["protocolMessage"].includes(mtype) &&
              !fromMe &&
              message.messageStubType != WAMessageStubType.CIPHERTEXT &&
              message.message
            ) {
              delete message.message.messageContextInfo;
              delete message.message.senderKeyDistributionMessage;
              chats.messages[message.key.id] = JSON.parse(
                JSON.stringify(message, null, 2),
              );
              let chatsMessages;
              if ((chatsMessages = Object.entries(chats.messages)).length > 40)
                chats.messages = Object.fromEntries(
                  chatsMessages.slice(30, chatsMessages.length),
                );
            }
          } catch (e) {
            console.error(e);
          }
        }
      },
    },
    serializeM: {
      value(m) {
        return smsg(conn, m)
      }
    }
  });

  store.readFromDatabase();
  store.startAutoSave();
  store.bind(conn.ev);

  if (sock.user?.id) sock.user.jid = sock.decodeJid(sock.user.id);
  return sock;
}

export function smsg(conn, m) {
  if (!m) return m
  let M = proto.WebMessageInfo
  m = M.create(m)
  Object.defineProperty(m, 'conn', { enumerable: false, writable: true, value: conn })
  let protocolMessageKey
  if (m.message) {
    if (m.mtype == 'protocolMessage' && m.msg.key) {
      protocolMessageKey = m.msg.key
      if (protocolMessageKey == 'status@broadcast') protocolMessageKey.remoteJid = m.chat
      if (!protocolMessageKey.participant || protocolMessageKey.participant == 'status_me') protocolMessageKey.participant = m.sender
      protocolMessageKey.fromMe = conn.decodeJid(protocolMessageKey.participant) === conn.decodeJid(conn.user.id)
      if (!protocolMessageKey.fromMe && protocolMessageKey.remoteJid === conn.decodeJid(conn.user.id)) protocolMessageKey.remoteJid = m.sender
    }
    if (m.quoted) if (!m.quoted.mediaMessage) delete m.quoted.download
  }
  if (!m.mediaMessage) delete m.download

  try {
    if (protocolMessageKey && m.mtype == 'protocolMessage' && (m.msg.type === 0 || m.msg.type === undefined || m.msg.type === null)) conn.ev.emit('message.delete', protocolMessageKey)
  } catch (e) {
    console.error(e)
  }
  return m
}

export function serialize() {
  const MediaType = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'];

  return Object.defineProperties(proto.WebMessageInfo.prototype, {
    conn: {
      value: undefined,
      enumerable: false,
      writable: true
    },
    id: {
      get() {
        return this.key?.id;
      },
    },
    isBaileys: {
      get() {
        return (
          this.id?.length === 16 ||
          (this.id?.startsWith("3EB0") && this.id?.length === 22) ||
          false
        );
      },
    },
    chat: {
      get() {
        const senderKeyDistributionMessage =
          this.message?.senderKeyDistributionMessage?.groupId;
        return (
          this.key?.remoteJid ||
          (senderKeyDistributionMessage &&
            senderKeyDistributionMessage !== "status@broadcast") ||
          ""
        ).decodeJid();
      },
    },
    isGroup: {
      get() {
        return this.chat.endsWith("@g.us") ? true : false;
      },
      enumerable: true,
    },
    sender: {
      get() {
        if (this.key?.fromMe) return (this.conn?.user?.lid || '').decodeJid()
        const raw = (this.key.participant || this.chat || '');
        // there is no point to search jid again
        // its time to migrate to LID
        return String(raw).decodeJid();
      },
      enumerable: true
    },
    fromMe: {
      get() {
        return (
          this.key?.fromMe ||
          areJidsSameUser(this.conn?.user.id, this.sender) ||
          false
        );
      },
    },
    mtype: {
      get() {
        if (!this.message) return "";
        const type = Object.keys(this.message);
        return (
          (!["senderKeyDistributionMessage", "messageContextInfo"].includes(
            type[0],
          ) &&
            type[0]) ||
          (type.length >= 3 && type[1] !== "messageContextInfo" && type[1]) ||
          type[type.length - 1]
        );
      },
      enumerable: true,
    },
    msg: {
      get() {
        if (!this.message) return null;
        return this.message[this.mtype];
      },
    },
    mediaMessage: {
      get() {
        if (!this.message) return null;
        const Message =
          (this.msg?.url || this.msg?.directPath
            ? {
              ...this.message,
            }
            : extractMessageContent(this.message)) || null;
        if (!Message) return null;
        const mtype = Object.keys(Message)[0];
        return MediaType.includes(mtype) ? Message : null;
      },
      enumerable: true,
    },
    messages: {
      get() {
        return this.message ? this.message : null;
      },
      enumerable: true,
    },

    mediaType: {
      get() {
        let message;
        if (!(message = this.mediaMessage)) return null;
        return Object.keys(message)[0];
      },
      enumerable: true,
    },
    quoted: {
      get() {
        const self = this
        const msg = self.msg
        const contextInfo = msg?.contextInfo
        const quoted = contextInfo?.quotedMessage
        const conns = this.conn
        if (!msg || !contextInfo || !quoted) return null
        const type = Object.keys(quoted)[0]
        let q = quoted[type]
        const text = typeof q === 'string' ? q : q.text
        return Object.defineProperties(JSON.parse(JSON.stringify(typeof q === 'string' ? {
          text: q
        } : q)), {
          mtype: {
            get() {
              return type;
            },
            enumerable: true,
          },
          mediaMessage: {
            get() {
              const Message =
                (q.url || q.directPath
                  ? {
                    ...quoted,
                  }
                  : extractMessageContent(quoted)) || null;
              if (!Message) return null;
              const mtype = Object.keys(Message)[0];
              return MediaType.includes(mtype) ? Message : null;
            },
            enumerable: true,
          },
          messages: {
            get() {
              return quoted ? quoted : null;
            },
            enumerable: true,
          },
          mediaType: {
            get() {
              let message;
              if (!(message = this.mediaMessage)) return null;
              return Object.keys(message)[0];
            },
            enumerable: true,
          },
          id: {
            get() {
              return contextInfo.stanzaId;
            },
            enumerable: true,
          },
          chat: {
            get() {
              return contextInfo.remoteJid || self.chat;
            },
            enumerable: true,
          },
          isBaileys: {
            get() {
              return (
                this.id?.length === 16 ||
                (this.id?.startsWith("3EB0") && this.id.length === 22) ||
                false
              );
            },
            enumerable: true,
          },
          sender: {
            get() {
              const raw = (contextInfo.participant || this.chat || "");
              return String(raw).decodeJid();
            },
            enumerable: true
          },
          fromMe: {
            get() {
              return areJidsSameUser(this.sender, self.conn?.user.jid);
            },
            enumerable: true,
          },
          text: {
            get() {
              return (
                text ||
                this.caption ||
                this.contentText ||
                this.selectedDisplayText ||
                ""
              );
            },
            enumerable: true,
          },
          mentionedJid: {
            get() {
              let raw = q.contextInfo?.mentionedJid || self.getQuotedObj()?.mentionedJid || []
              return raw.map((jid) => String(jid).decodeJid())
            },
            enumerable: true
          },
          name: {
            get() {
              const sender = this.sender;
              return sender ? self.conn?.getName(sender) : null;
            },
            enumerable: true,
          },
          vM: {
            get() {
              return proto.WebMessageInfo.create({
                key: {
                  fromMe: this.fromMe,
                  remoteJid: this.chat,
                  id: this.id,
                },
                message: quoted,
                ...(self.isGroup
                  ? {
                    participant: this.sender,
                  }
                  : {}),
              });
            },
          },
          fakeObj: {
            get() {
              return this.vM;
            },
          },
          download: {
            value(saveToFile = false) {
              const mtype = this.mediaType;
              const mediaRoot = this.mediaMessage;
              if (!mtype || !mediaRoot || !mediaRoot[mtype]) {
                throw new Error(
                  "No downloadable media found in quoted message. Reply to an image/video/sticker or resend the media.",
                );
              }
              return self.conn?.downloadM(
                mediaRoot[mtype],
                mtype.replace(/message/i, ""),
                saveToFile,
              );
            },
            enumerable: true,
            configurable: true,
          },
          reply: {
            value(text, chatId, options) {
              return self.conn?.reply(
                chatId ? chatId : this.chat,
                text,
                this.vM,
                options,
              );
            },
            enumerable: true,
          },
          copy: {
            value() {
              const M = proto.WebMessageInfo;
              return smsg(conns, M.create(M.toObject(this.vM)));
            },
            enumerable: true,
          },
          forward: {
            value(jid, force = false, options) {
              return self.conn?.sendMessage(
                jid,
                {
                  forward: this.vM,
                  force,
                  ...options,
                },
                {
                  ...options,
                },
              );
            },
            enumerable: true,
          },
          copyNForward: {
            value(jid, forceForward = false, options) {
              return self.conn?.copyNForward(
                jid,
                this.vM,
                forceForward,
                options,
              );
            },
            enumerable: true,
          },
          cMod: {
            value(
              jid,
              text = "",
              sender = this.sender,
              options = {},
            ) {
              return self.conn?.cMod(jid, this.vM, text, sender, options);
            },
            enumerable: true,
          },
          delete: {
            value() {
              return self.conn?.sendMessage(this.chat, {
                delete: this.vM.key,
              });
            },
            enumerable: true,
          },
          react: {
            value(text) {
              return self.conn?.sendMessage(this.chat, {
                react: {
                  text,
                  key: this.vM.key,
                },
              });
            },
            enumerable: true
          },
          command: {
            get() {
              const str2Regex = (str) =>
                str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
              let _prefix = this.prefix ? this.prefix : global.prefix;
              let match = (
                _prefix instanceof RegExp
                  ? [
                    [
                      _prefix.exec(
                        text ||
                        this.caption ||
                        this.contentText ||
                        this.selectedDisplayText ||
                        "",
                      ),
                      _prefix,
                    ],
                  ]
                  : Array.isArray(_prefix)
                    ? _prefix.map((p) => {
                      let re =
                        p instanceof RegExp ? p : new RegExp(str2Regex(p));
                      return [
                        re.exec(
                          text ||
                          this.caption ||
                          this.contentText ||
                          this.selectedDisplayText ||
                          "",
                        ),
                        re,
                      ];
                    })
                    : typeof _prefix === "string"
                      ? [
                        [
                          new RegExp(str2Regex(_prefix)).exec(
                            text ||
                            this.caption ||
                            this.contentText ||
                            this.selectedDisplayText ||
                            "",
                          ),
                          new RegExp(str2Regex(_prefix)),
                        ],
                      ]
                      : [
                        [
                          [],
                          new RegExp(),
                        ],
                      ]
              ).find((p) => p[1]);
              let result =
                ((opts?.["multiprefix"] ?? true) && (match[0] || "")[0]) ||
                ((opts?.["noprefix"] ?? false)
                  ? null
                  : (match[0] || "")[0]);
              let noPrefix = !result
                ? text ||
                this.caption ||
                this.contentText ||
                this.selectedDisplayText ||
                ""
                : (
                  text ||
                  this.caption ||
                  this.contentText ||
                  this.selectedDisplayText ||
                  ""
                ).replace(result, "");
              let args_v2 = noPrefix.trim().split(/ +/);
              let [command, ...args] = noPrefix
                .trim()
                .split(" ")
                .filter((v) => v);
              return {
                command,
                args,
                args_v2,
                noPrefix,
                match,
              };
            },
            enumerable: true,
          },
          device: {
            get() {
              const device = getDevice(this.vM.key?.id);
              const platform = os.platform();
              const isUnknownDevice = device === "unknown" && platform;
              const res = device
                ? isUnknownDevice
                  ? platform === "android"
                    ? "Android"
                    : ["win32", "darwin", "linux"].includes(platform)
                      ? "Desktop"
                      : "Unknown"
                  : device
                : "Unknown Device";

              return res;
            },
            enumerable: true,
          },
          isBot: {
            get() {
              const idBot = this.vM.key?.id;
              return ["3EB0"].some(
                (k) =>
                  idBot.includes(k) && this.sender !== this.conn?.user.jid,
              );
            },
            enumerable: true,
          }
        })
      },
      enumerable: true
    },
    _text: {
      value: null,
      writable: true,
    },
    text: {
      get() {
        const msg = this.msg;
        const text =
          (typeof msg === "string" ? msg : msg?.text) ||
          msg?.caption ||
          msg?.contentText ||
          "";
        return typeof this._text === "string"
          ? this._text
          : "" ||
          (typeof text === "string"
            ? text
            : text?.selectedDisplayText ||
            text?.hydratedTemplate?.hydratedContentText ||
            text) ||
          "";
      },
      set(str) {
        return (this._text = str);
      },
      enumerable: true,
    },
    mentionedJid: {
      get() {
        let raw = this.msg?.contextInfo?.mentionedJid?.length && this.msg.contextInfo.mentionedJid || [];
        return raw.map((jid) => String(jid).decodeJid());
      },
      enumerable: true
    },
    name: {
      get() {
        return (
          (!nullish(this.pushName) && this.pushName) ||
          this.conn?.getName(this.sender)
        );
      },
      enumerable: true,
    },
    download: {
      value(saveToFile = false) {
        const mtype = this.mediaType;
        const mediaRoot = this.mediaMessage;
        if (!mtype || !mediaRoot || !mediaRoot[mtype]) {
          throw new Error(
            "No downloadable media found in message. Send or reply to an image/video/sticker.",
          );
        }
        return this.conn?.downloadM(
          mediaRoot[mtype],
          mtype.replace(/message/i, ""),
          saveToFile,
        );
      },
      enumerable: true,
      configurable: true,
    },
    reply: {
      value(
        text,
        chatId,
        options,
      ) {
        return this.conn?.reply(
          chatId ? chatId : this.chat,
          text,
          this,
          options,
        );
      },
    },
    copy: {
      value() {
        const M = proto.WebMessageInfo;
        return smsg(this.conn, M.create(M.toObject(this)));
      },
      enumerable: true,
    },
    forward: {
      value(jid, force = false, options = {}) {
        return this.conn?.sendMessage(
          jid,
          {
            forward: this,
            force,
            ...options,
          },
          {
            ...options,
          },
        );
      },
      enumerable: true,
    },
    copyNForward: {
      value(jid, forceForward = false, options = {}) {
        return this.conn?.copyNForward(jid, this, forceForward, options);
      },
      enumerable: true,
    },
    cMod: {
      value(jid, text = "", sender = this.sender, options = {}) {
        return this.conn?.cMod(jid, this, text, sender, options);
      },
      enumerable: true,
    },
    getQuotedObj: {
      value() {
        if (!this.quoted.id) return null;
        const q = proto.WebMessageInfo.create(
          this.conn?.loadMessage(this.quoted.id) || this.quoted.vM,
        );
        return smsg(this.conn, q);
      },
      enumerable: true,
    },
    getQuotedMessage: {
      get() {
        return this.getQuotedObj;
      },
    },
    delete: {
      value() {
        return this.conn?.sendMessage(this.chat, {
          delete: this.key,
        });
      },
      enumerable: true,
    },
    react: {
      value(text) {
        return this.conn?.sendMessage(this.chat, {
          react: {
            text,
            key: this.key,
          },
        });
      },
      enumerable: true,
    },
    device: {
      get() {
        const device = getDevice(this.key?.id);
        const platform = os.platform();
        const isUnknownDevice = device === "unknown" && platform;
        const res = device
          ? isUnknownDevice
            ? platform === "android"
              ? "Android Device"
              : ["win32", "darwin", "linux"].includes(platform)
                ? "Desktop"
                : "Unknown Device"
            : device
          : "Unknown Device";

        return res;
      },
      enumerable: true,
    },
    isBot: {
      get() {
        const idBot = this.key?.id;
        return ["3EB0"].some(
          (k) => idBot.includes(k) && this.sender !== this.conn?.user.jid,
        );
      },
      enumerable: true,
    }
  })
}

export function protoType() {
  Buffer.prototype.toArrayBuffer = function toArrayBufferV2() {
    const ab = new ArrayBuffer(this.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < this.length; ++i) {
      view[i] = this[i];
    }
    return ab;
  }

  Buffer.prototype.toArrayBufferV2 = function toArrayBuffer() {
    return this.buffer.slice(this.byteOffset, this.byteOffset + this.byteLength)
  }

  ArrayBuffer.prototype.toBuffer = function toBuffer() {
    return Buffer.from(new Uint8Array(this))
  }

  Uint8Array.prototype.getFileType = ArrayBuffer.prototype.getFileType = Buffer.prototype.getFileType = async function getFileType() {
    return await fileTypeFromBuffer(this)
  }

  String.prototype.isNumber = Number.prototype.isNumber = isNumber

  String.prototype.capitalize = function capitalize() {
    return this.charAt(0).toUpperCase() + this.slice(1, this.length)
  }

  String.prototype.capitalizeV2 = function capitalizeV2() {
    const str = this.split(' ')
    return str.map(v => v.capitalize()).join(' ')
  }
  String.prototype.decodeJid = function decodeJid() {
    if (/:\d+@/gi.test(this)) {
      const decode = jidDecode(this) || {}
      return (decode.user && decode.server && decode.user + '@' + decode.server || this).trim()
    } else return this.trim()
  }

  Number.prototype.toTimeString = function toTimeString() {
    const seconds = Math.floor((this / 1000) % 60)
    const minutes = Math.floor((this / (60 * 1000)) % 60)
    const hours = Math.floor((this / (60 * 60 * 1000)) % 24)
    const days = Math.floor((this / (24 * 60 * 60 * 1000)))
    return (
      (days ? `${days} day(s) ` : '') +
      (hours ? `${hours} hour(s) ` : '') +
      (minutes ? `${minutes} minute(s) ` : '') +
      (seconds ? `${seconds} second(s)` : '')
    ).trim()
  }
  Number.prototype.getRandom = String.prototype.getRandom = Array.prototype.getRandom = getRandom
}
function isNumber() {
  const int = parseInt(this)
  return typeof int === 'number' && !isNaN(int)
}

function getRandom() {
  if (Array.isArray(this) || this instanceof String) return this[Math.floor(Math.random() * this.length)]
  return Math.floor(Math.random() * this)
}

function nullish(args) {
  return !(args !== null && args !== undefined)
}
