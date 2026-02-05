import axios from "axios";

const handler = {
  name: "Download TikTok videos",
  description: "Download TikTok videos easily",
  usage: [".tiktok <link>"],
  tags: ["downloader"],
  cmd: /^(tiktok|tt|tiktokdl|tiktoknowm)$/i,
  limit: true,
  needRegister: true,
  exec: async (m, { conn, text, usedPrefix, command }) => {
    if (!text) {
      conn.sendPresenceUpdate("composing", m.chat);
      return conn.reply(m.chat, `*Example :* ${usedPrefix + command} https://vm.tiktok.com/xxxxx`, m);
    }
  
    if (!text.match(/tiktok/gi)) {
      return conn.reply(m.chat, 'Make sure the link is from TikTok', m);
    }

    conn.sendMessage(m.chat, {
      react: {
        text: '🕒',
        key: m.key,
      }
    });
    
    try {
      let data = await fetchTikTokVideo(text);
  
      if (data.images && data.images.length > 0) {
        const imageBuffers = await Promise.all(
          data.images.map(async (url) => {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            return Buffer.from(response.data);
          })
        );

        const caption = `*TikTok Slide*\n\n` +
          `*Title:* ${data.title || 'N/A'}\n` +
          `*Author:* ${data.author?.nickname || 'Unknown'} (@${data.author?.unique_id || 'unknown'})\n` +
          `*Likes:* ${formatNumber(data.digg_count)}\n` +
          `*Comments:* ${formatNumber(data.comment_count)}\n` +
          `*Shares:* ${formatNumber(data.share_count)}\n` +
          `*Views:* ${formatNumber(data.play_count)}`;

        if (imageBuffers.length > 1) {
          const medias = imageBuffers.map((buffer, index) => ({
            image: buffer,
            caption: index === 0 ? caption : ''
          }));

          await conn.sendAlbum(m.chat, medias, { quoted: m });
        } else {
          await conn.sendMessage(m.chat, {
            image: imageBuffers[0],
            caption: caption
          }, { quoted: m });
        }

        if (data.music) {
          const audioResponse = await axios.get(data.music, { responseType: 'arraybuffer' });
          const audioBuffer = Buffer.from(audioResponse.data);
          
          await conn.sendMessage(m.chat, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${data.music_info?.title || 'tiktok-audio'}.mp3`
          }, { quoted: m });
        }

      } else {
        const videoUrl = data.hdplay || data.play;
        
        if (!videoUrl) {
          throw new Error("No video URL found");
        }
        
        const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
        const videoBuffer = Buffer.from(videoResponse.data);
        
        const caption = `*TikTok Video*\n\n` +
          `*Title:* ${data.title || 'N/A'}\n` +
          `*Author:* ${data.author?.nickname || 'Unknown'} (@${data.author?.unique_id || 'unknown'})\n` +
          `*Duration:* ${data.duration || 0}s\n` +
          `*Likes:* ${formatNumber(data.digg_count)}\n` +
          `*Comments:* ${formatNumber(data.comment_count)}\n` +
          `*Shares:* ${formatNumber(data.share_count)}\n` +
          `*Views:* ${formatNumber(data.play_count)}`;

        await conn.sendMessage(m.chat, {
          video: videoBuffer,
          caption: caption,
          mimetype: 'video/mp4'
        }, { quoted: m });
        
        if (data.music) {
          const audioResponse = await axios.get(data.music, { responseType: 'arraybuffer' });
          const audioBuffer = Buffer.from(audioResponse.data);
          
          await conn.sendMessage(m.chat, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${data.music_info?.title || 'tiktok-audio'}.mp3`
          }, { quoted: m });
        }
      }
      
      m.react("✅");
    } catch (e) {
      m.react("❌");
      console.error(e);
      conn.reply(m.chat, `Failed to download TikTok content: ${e.message}`, m);
    }
  }
};

export default handler;

async function fetchTikTokVideo(url) {
  const encodedParams = new URLSearchParams();
  encodedParams.set("url", url);
  encodedParams.set("hd", "1");

  const response = await axios({
    method: "POST",
    url: "https://tikwm.com/api/",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Cookie": "current_language=en",
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
    },
    data: encodedParams
  });

  if (!response.data || !response.data.data) {
    throw new Error("Invalid response from TikTok API");
  }

  return response.data.data;
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}