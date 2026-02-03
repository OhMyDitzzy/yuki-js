const handler = {
  cmd: ["settings", "setting"],
  onlyRealOwner: true,
  exec: async (m, { conn, usedPrefix, command, args }) => {
    const chat = global.db.data.chats[m.chat];
    const set = global.db.data.settings[conn.user.jid];
    
    if (args[0]) {
      const type = args[0].toLowerCase();
      const isEnable = /enable|on|1/i.test(args[1] || '');

      const settingsConfig = {
        'welcome': { key: 'welcome', scope: 'chat' },
        'detect': { key: 'detect', scope: 'chat' },
        'delete': { key: 'delete', scope: 'chat' },
        'autojpm': { key: 'autoJpm', scope: 'chat' },
        'ngetik': { key: 'ngetik', scope: 'chat' },
        'captcha': { key: 'captcha', scope: 'chat' },
        'antibadword': { key: 'antiBadword', scope: 'chat' },
        'antiporn': { key: 'antiPorn', scope: 'chat' },
        'autosticker': { key: 'stiker', scope: 'chat' },
        'autodelvn': { key: 'autodelvn', scope: 'chat' },
        'autodownload': { key: 'autoDownload', scope: 'chat' },
        'simi': { key: 'simi', scope: 'chat' },
        'ai': { key: 'ai', scope: 'chat' },
        'antilink': { key: 'antiLink', scope: 'chat' },
        'antilinkbitly': { key: 'antiLinkBitly', scope: 'chat' },
        'antilinktik': { key: 'antiLinkTik', scope: 'chat' },
        'antilinkyt': { key: 'antiLinkYt', scope: 'chat' },
        'antilinktel': { key: 'antiLinkTel', scope: 'chat' },
        'antilinkfb': { key: 'antiLinkFb', scope: 'chat' },
        'antilinkig': { key: 'antiLinkIg', scope: 'chat' },
        'antilinkwa': { key: 'antiLinkWa', scope: 'chat' },
        'antihatetepe': { key: 'antiLinkHttp', scope: 'chat' },
        'nsfw': { key: 'nsfw', scope: 'chat' },
        'antisticker': { key: 'antiSticker', scope: 'chat' },
        'antifoto': { key: 'antiFoto', scope: 'chat' },
        'antividio': { key: 'antiVideo', scope: 'chat' },
        'autovn': { key: 'autoVn', scope: 'chat' },
        'autopresence': { key: 'autoPesence', scope: 'chat' },
        'freply': { key: 'freply', scope: 'chat' },
        'antitoxic': { key: 'antiToxic', scope: 'chat' },
        'antivirtex': { key: 'antiVirtex', scope: 'chat' },
        'viewonce': { key: 'viewonce', scope: 'chat' },
        'public': { key: 'self', scope: 'bot' },
        'autoread': { key: 'autoread', scope: 'bot' },
      };
      
      if (settingsConfig[type]) {
        const config = settingsConfig[type];
        if (config.scope === 'chat') {
          chat[config.key] = isEnable;
        } else if (config.scope === 'bot') {
          if (config.key === 'self') {
            global.opts['self'] = !isEnable;
          } else {
            global.opts[config.key] = isEnable;
          }
        }
        
        return m.reply(`✅ Feature *${type}* successfully ${isEnable ? 'enabled' : 'disabled'}`);
      } else {
        return m.reply(`❌ Setting *${type}* not found!`);
      }
    }
    
    const getStatus = (key, scope = 'chat') => {
      if (scope === 'chat') {
        return chat[key] || false;
      } else {
        if (key === 'self') {
          return !global.opts['self'];
        }
        return global.opts[key] || false;
      }
    };

    const settingsList = [
      { name: 'Welcome', id: 'welcome', scope: 'chat' },
      { name: 'Detect', id: 'detect', scope: 'chat' },
      { name: 'Delete', id: 'delete', scope: 'chat' },
      { name: 'Auto JPM', id: 'autojpm', scope: 'chat' },
      { name: 'Ngetik', id: 'ngetik', scope: 'chat' },
      { name: 'Captcha', id: 'captcha', scope: 'chat' },
      { name: 'Anti Badword', id: 'antibadword', scope: 'chat' },
      { name: 'Anti Porn', id: 'antiporn', scope: 'chat' },
      { name: 'Auto Sticker', id: 'autosticker', scope: 'chat' },
      { name: 'Auto Del VN', id: 'autodelvn', scope: 'chat' },
      { name: 'Auto Download', id: 'autodownload', scope: 'chat' },
      { name: 'Simi', id: 'simi', scope: 'chat' },
      { name: 'AI', id: 'ai', scope: 'chat' },
      { name: 'Anti Link', id: 'antilink', scope: 'chat' },
      { name: 'Anti Link Bitly', id: 'antilinkbitly', scope: 'chat' },
      { name: 'Anti Link TikTok', id: 'antilinktik', scope: 'chat' },
      { name: 'Anti Link YouTube', id: 'antilinkyt', scope: 'chat' },
      { name: 'Anti Link Telegram', id: 'antilinktel', scope: 'chat' },
      { name: 'Anti Link Facebook', id: 'antilinkfb', scope: 'chat' },
      { name: 'Anti Link Instagram', id: 'antilinkig', scope: 'chat' },
      { name: 'Anti Link WhatsApp', id: 'antilinkwa', scope: 'chat' },
      { name: 'Anti Link HTTP', id: 'antihatetepe', scope: 'chat' },
      { name: 'NSFW', id: 'nsfw', scope: 'chat' },
      { name: 'Anti Sticker', id: 'antisticker', scope: 'chat' },
      { name: 'Anti Foto', id: 'antifoto', scope: 'chat' },
      { name: 'Anti Video', id: 'antividio', scope: 'chat' },
      { name: 'Auto VN', id: 'autovn', scope: 'chat' },
      { name: 'Auto Presence', id: 'autopresence', scope: 'chat' },
      { name: 'Fake Reply', id: 'freply', scope: 'chat' },
      { name: 'Anti Toxic', id: 'antitoxic', scope: 'chat' },
      { name: 'Anti Virtex', id: 'antivirtex', scope: 'chat' },
      { name: 'View Once', id: 'viewonce', scope: 'chat' },
      
      // Bot Settings
      { name: 'Public Mode', id: 'public', scope: 'bot' },
      { name: 'Auto Read', id: 'autoread', scope: 'bot' },
    ];
  
    const sections = settingsList.map((setting) => {
      const keyMap = {
        'welcome': 'welcome',
        'detect': 'detect',
        'delete': 'delete',
        'autojpm': 'autoJpm',
        'ngetik': 'ngetik',
        'captcha': 'captcha',
        'antibadword': 'antiBadword',
        'antiporn': 'antiPorn',
        'autosticker': 'stiker',
        'autodelvn': 'autodelvn',
        'autodownload': 'autoDownload',
        'simi': 'simi',
        'ai': 'ai',
        'antilink': 'antiLink',
        'antilinkbitly': 'antiLinkBitly',
        'antilinktik': 'antiLinkTik',
        'antilinkyt': 'antiLinkYt',
        'antilinktel': 'antiLinkTel',
        'antilinkfb': 'antiLinkFb',
        'antilinkig': 'antiLinkIg',
        'antilinkwa': 'antiLinkWa',
        'antihatetepe': 'antiLinkHttp',
        'nsfw': 'nsfw',
        'antisticker': 'antiSticker',
        'antifoto': 'antiFoto',
        'antividio': 'antiVideo',
        'autovn': 'autoVn',
        'autopresence': 'autoPesence',
        'freply': 'freply',
        'antitoxic': 'antiToxic',
        'antivirtex': 'antiVirtex',
        'viewonce': 'viewonce',
        'public': 'self',
        'autoread': 'autoread',
      };
      
      const dbKey = keyMap[setting.id];
      const status = getStatus(dbKey, setting.scope);
      const statusText = status ? '✅ Enabled' : '❌ Disabled';
      const action = status ? 'disable' : 'enable';
      
      return {
        title: `${setting.name} - ${statusText}`,
        rows: [
          {
            title: `${status ? '❌ Disable' : '✅ Enable'} ${setting.name}`,
            id: `${usedPrefix}${command} ${setting.id} ${action}`
          }
        ]
      };
    });

    await conn?.sendList(m.chat, {
      body: {
        text: `⚙️ *PANEL SETTINGS BOT*\n\nSelect the settings you want to change from the list below.`
      },
      footer: {
        text: `Total ${settingsList.length} settings available`
      },
    }, {
      title: "⚙️ Bot Settings",
      sections: sections
    }, { quoted: m });
  }
};

export default handler;