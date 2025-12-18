const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '..', 'data', 'messageCount.json');

function loadMessageCounts() {
    if (fs.existsSync(dataFilePath)) {
        const data = fs.readFileSync(dataFilePath);
        return JSON.parse(data);
    }
    return {};
}

function saveMessageCounts(messageCounts) {
    fs.writeFileSync(dataFilePath, JSON.stringify(messageCounts, null, 2));
}

function incrementMessageCount(groupId, userId) {
    const messageCounts = loadMessageCounts();

    if (!messageCounts[groupId]) {
        messageCounts[groupId] = {};
    }

    if (!messageCounts[groupId][userId]) {
        messageCounts[groupId][userId] = 0;
    }

    messageCounts[groupId][userId] += 1;

    saveMessageCounts(messageCounts);
}

module.exports = {
  name: 'top',
  description: '🏆 SHOW TOP ACTIVE MEMBERS IN GROUP',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');
    
    if (!isGroup) {
      await sock.sendMessage(jid, { 
        text: '❌ This command is only available in group chats.\n\n💡 Use this in a group to see the most active members!' 
      });
      return;
    }

    await sock.sendMessage(jid, { react: { text: '🏆', key: msg.key } });
    const statusMsg = await sock.sendMessage(jid, { text: '📊 Analyzing group activity...' });

    try {
        await sock.sendMessage(jid, { 
            text: '🔍 Loading message statistics...',
            edit: statusMsg.key
        });

        const messageCounts = loadMessageCounts();
        const groupCounts = messageCounts[jid] || {};

        await sock.sendMessage(jid, { 
            text: '📈 Calculating top members...',
            edit: statusMsg.key
        });

        const sortedMembers = Object.entries(groupCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5); // Get top 5 members

        if (sortedMembers.length === 0) {
            await sock.sendMessage(jid, { 
                text: '📊 *GROUP ACTIVITY STATS*\n\nNo message activity recorded yet.\n\n💡 Start chatting to see who\'s most active!' 
            });
            return;
        }

        let message = '🏆 *TOP ACTIVE MEMBERS*\n\n';
        sortedMembers.forEach(([userId, count], index) => {
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            message += `${medals[index]} @${userId.split('@')[0]} - *${count}* messages\n`;
        });

        message += `\n📊 *Total tracked messages:* ${Object.values(groupCounts).reduce((a, b) => a + b, 0)}`;
        message += `\n👥 *Active members:* ${Object.keys(groupCounts).length}`;
        message += `\n\n💡 Keep chatting to climb the ranks!`;

        await sock.sendMessage(jid, { 
            text: message, 
            mentions: sortedMembers.map(([userId]) => userId) 
        });

        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        console.error("Top Command Error:", error.message);
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(jid, { 
            text: '❌ Failed to load group statistics. Please try again later.' 
        });
    }
  }
}

// Export the increment function separately for use in message handler
module.exports.incrementMessageCount = incrementMessageCount;