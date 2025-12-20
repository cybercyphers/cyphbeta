module.exports = {
  name: 'dictionary',
  description: 'Look up word definitions',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    
    try {
      if (!args[0]) {
        await sock.sendMessage(from, { 
          text: 'Ready to rumble with words? 💪📖 What word is puzzling you? 🤔 Tell me your word!' 
        });
        return;
      }

      const word = args[0];
      
      // Standard dictionary
      const response = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + word);
      const data = await response.json();
      
      if (!data.length) {
        await sock.sendMessage(from, { 
          text: `❌ No definition found for *${word}*` 
        });
        return;
      }

      const definitions = data[0].meanings[0].definitions.map((def, index) => 
        `*Definition ${index + 1}:* ${def.definition}`
      ).join("\n\n");

      await sock.sendMessage(from, { 
        text: `📖 *Definitions for:* ${word}\n\n${definitions}` 
      });

    } catch (error) {
      console.log('Dictionary error:', error);
      await sock.sendMessage(from, { 
        text: '❌ Error fetching definition' 
      });
    }
  }
};
