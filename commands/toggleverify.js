const fs = require('fs').promises;
const path = require('path');

module.exports = {
    name: 'toggleverify',
    description: 'Toggle automatic file verification',
    aliases: ['tv', 'autoscan', 'security'],
    permissions: ['owner'],
    
    async execute(sock, msg, args) {
        const configPath = path.join(__dirname, '..', 'config.json');
        const userJid = msg.key.participant || msg.key.remoteJid;
        
        try {
            let config = JSON.parse(await fs.readFile(configPath, 'utf8'));
            
            // Check if user is owner
            const ownerJid = config.ownerJid || `${config.phone_number}@s.whatsapp.net`;
            if (!userJid.includes(config.phone_number) && userJid !== ownerJid) {
                return await sock.sendMessage(msg.key.remoteJid, {
                    text: "❌ Only the bot owner can toggle security features."
                });
            }
            
            // Toggle or set specific security level
            if (args[0]) {
                const level = args[0].toLowerCase();
                if (['maximum', 'high', 'medium', 'low', 'off'].includes(level)) {
                    if (level === 'off') {
                        config.autoVerifyFiles = false;
                    } else {
                        config.autoVerifyFiles = true;
                        config.securityLevel = level;
                    }
                }
            } else {
                config.autoVerifyFiles = !config.autoVerifyFiles;
            }
            
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
            
            const status = config.autoVerifyFiles ? '✅ ENABLED' : '❌ DISABLED';
            const levelInfo = config.autoVerifyFiles ? 
                `\n🔒 Security Level: ${config.securityLevel.toUpperCase()}` : '';
            
            await sock.sendMessage(msg.key.remoteJid, {
                text: `🛡️ *SECURITY SYSTEM ${status}*${levelInfo}\n\n` +
                      `Automatic file scanning: ${config.autoVerifyFiles ? 'ACTIVE' : 'INACTIVE'}\n` +
                      `Silent mode: ${config.silentMode ? 'ON 🔇' : 'OFF 🔊'}\n` +
                      `Engines: ${config.scanEngines.length}\n` +
                      `File size limit: ${formatBytes(config.maxFileSize)}`
            });
            
        } catch (error) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Error updating security settings'
            });
        }
    }
};

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}