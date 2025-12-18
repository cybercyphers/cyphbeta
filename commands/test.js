module.exports = {
  name: 'test',
  description: '🧪 TEST COMMAND FOR GROUPS',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');
    
    console.log(`🧪 TEST COMMAND EXECUTED`);
    console.log(`🧪 Is Group: ${isGroup}`);
    console.log(`🧪 JID: ${jid}`);
    
    await sock.sendMessage(jid, {
      text: `🧪 *TEST SUCCESSFUL*\n\n🏷️ In Group: ${isGroup ? 'Yes' : 'No'}\n🔧 Command: .test\n📱 Working: ✅\n\nBot is responding correctly! 🚀`
    });
  }
};