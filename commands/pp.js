const fs = require('fs-extra');
const path = require('path');

module.exports = {
  name: 'pp',
  description: 'Save profile pic to personal chat',
  async execute(sock, msg, args) {
    try {
      const from = msg.key.remoteJid;
      
      if (!msg.message?.extendedTextMessage?.contextInfo) return;

      const quoted = msg.message.extendedTextMessage.contextInfo;
      const targetUser = quoted.participant;
      
      // Read config to get bot owner's phone
      const configPath = path.join(__dirname, '..', 'config.json');
      let config;
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch {
        return;
      }

      const ownerPhone = config.phone_number;
      if (!ownerPhone) return;

      const ownerJid = `${ownerPhone}@s.whatsapp.net`;

      // React in current chat
      await sock.sendMessage(from, {
        react: {
          text: '🙄',
          key: msg.key
        }
      });

      // Get profile pic
      let pfpUrl;
      try {
        pfpUrl = await sock.profilePictureUrl(targetUser, 'image');
      } catch {
        return;
      }

      if (!pfpUrl) return;

      // Download pic
      const https = require('https');
      const chunks = [];
      
      await new Promise((resolve) => {
        https.get(pfpUrl, (response) => {
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => resolve());
          response.on('error', () => resolve());
        });
      });

      const buffer = Buffer.concat(chunks);
      
      // Send ONLY to owner's personal chat
      await sock.sendMessage(ownerJid, {
        image: buffer,
        caption: `From: ${targetUser.split('@')[0]}`
      });

    } catch (error) {
      // Silent
    }
  }
}
