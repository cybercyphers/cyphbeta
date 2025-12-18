const path = require('path');
const { getBotStats } = require('../menu/desc.js');

module.exports = {
  name: 'menu',
  description: 'Show bot menu with commands',
  async execute(sock, msg, args) {
    try {
      const menuText = await getBotStats(sock, msg);
      
      // Send menu image with caption
      await sock.sendMessage(msg.key.remoteJid, {
        image: { url: path.join(__dirname, '../menu/menu.jpeg') },
        caption: menuText
      });
    } catch (error) {
      console.error('Error loading menu:', error);
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Error loading menu. Please try again.'
      });
    }
  }
}