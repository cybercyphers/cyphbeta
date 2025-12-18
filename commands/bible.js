const axios = require('axios');

module.exports = {
  name: 'bible',
  description: '📖 GET BIBLE VERSES',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    
    if (!args[0]) {
      await sock.sendMessage(jid, { 
        text: '📖 *BIBLE VERSE LOOKUP*\n\nUsage: .bible <book chapter:verse>\nExample: .bible John 3:16\nExample: .bible Psalm 23:1\nExample: .bible Genesis 1:1\n\n⚡ Get any Bible verse instantly' 
      });
      return;
    }

    const query = args.join(' ');
    
    await sock.sendMessage(jid, { react: { text: '📖', key: msg.key } });
    const statusMsg = await sock.sendMessage(jid, { text: '🔍 Searching for Bible verse...' });

    try {
        await sock.sendMessage(jid, { 
            text: '🌐 Connecting to Bible API...',
            edit: statusMsg.key
        });

        const url = `https://apis.davidcyriltech.my.id/bible?reference=${encodeURIComponent(query)}`;
        const res = await axios.get(url, { timeout: 30000 });

        if (!res.data.success) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, { 
                text: '❌ Could not find the verse.\n\n💡 Please check the reference format:\n• .bible John 3:16\n• .bible Psalm 23:1-4\n• .bible Genesis 1:1' 
            });
            return;
        }

        await sock.sendMessage(jid, { 
            text: '📝 Formatting verse...',
            edit: statusMsg.key
        });

        const { reference, translation, text } = res.data;

        const reply = `📖 *${reference}* (${translation})\n\n${text}\n\n✨ _Powered by Bible API_`;
        
        await sock.sendMessage(jid, { text: reply });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

    } catch (err) {
        console.error("Bible command error:", err.message);
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        
        if (err.code === 'ECONNREFUSED') {
            await sock.sendMessage(jid, { 
                text: '❌ Bible service is currently unavailable.\n\n💡 Please try again later.' 
            });
        } else if (err.response?.status === 404) {
            await sock.sendMessage(jid, { 
                text: '❌ Verse not found.\n\n💡 Check the reference format:\n• .bible John 3:16\n• .bible Matthew 5:1-12' 
            });
        } else {
            await sock.sendMessage(jid, { 
                text: '❌ Error fetching verse. Please try again later.' 
            });
        }
    }
  }
};