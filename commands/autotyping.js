module.exports = {
    name: 'autotyping',
    description: 'Toggle auto-typing indicator for ALL incoming messages',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const action = args[0]?.toLowerCase();

        try {
            const autotypingHandler = require('../handlers/autotypingHandler');

            if (!action) {
                const stats = autotypingHandler.getStats();
                await sock.sendMessage(from, {
                    text: `⌨️ *AutoTyping Status*\n\nCurrent: ${autotypingHandler.status()}\nActive Sessions: ${stats.activeSessions}\n\n*Usage:*\n• .autotyping on - Enable auto-typing\n• .autotyping off - Disable auto-typing\n• .autotyping stats - Show detailed statistics`
                });
                return;
            }

            if (action === 'on') {
                const result = autotypingHandler.enable();
                await sock.sendMessage(from, { 
                    text: `✅ ${result}` 
                });
            } 
            else if (action === 'off') {
                const result = autotypingHandler.disable();
                await sock.sendMessage(from, { 
                    text: `✅ ${result}` 
                });
            }
            else if (action === 'stats') {
                const stats = autotypingHandler.getStats();
                let statsText = `📊 *AutoTyping Statistics*\n\n`;
                statsText += `• Status: ${stats.enabled ? '🟢 ENABLED' : '🔴 DISABLED'}\n`;
                statsText += `• Active Sessions: ${stats.activeSessions}\n`;
                
                if (stats.sessions.length > 0) {
                    statsText += `• Active Chats:\n`;
                    stats.sessions.forEach(session => {
                        const jidShort = session.split('@')[0];
                        statsText += `  └ ${jidShort}\n`;
                    });
                }
                
                await sock.sendMessage(from, { text: statsText });
            }
            else {
                await sock.sendMessage(from, {
                    text: '❌ *Invalid option!*\n\nUse: .autotyping on/off/stats'
                });
            }

        } catch (error) {
            console.log('❌ AutoTyping command error:', error.message);
            await sock.sendMessage(from, {
                text: '❌ Error toggling auto-typing feature.'
            });
        }
    }
};