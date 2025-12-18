const fs = require('fs').promises;
const path = require('path');

module.exports = {
    name: 'commandHandler',
    description: 'Handle bot commands',
    
    async execute(sock, m, state, commands) {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        
        // Load config
        const configPath = path.join(__dirname, '..', 'config.json');
        let config = {
            phone_number: "233539738956",
            mode: "public",
            autoVerifyFiles: true,
            securityLevel: "maximum",
            silentMode: true
        };
        
        try {
            const data = await fs.readFile(configPath, 'utf8');
            config = JSON.parse(data);
            
            // Auto-set owner JID from phone number
            if (!config.ownerJid && config.phone_number) {
                const cleanNumber = config.phone_number.replace('+', '').replace(/\D/g, '');
                config.ownerJid = `${cleanNumber}@s.whatsapp.net`;
            }
        } catch (e) {
            // Use defaults
        }
        
        // REAL FILE SCANNING - No simulations
        if (config.autoVerifyFiles) {
            const hasMedia = this.detectAnyMedia(msg);
            if (hasMedia) {
                try {
                    const verifyHandler = require('./verifyHandler.js');
                    await verifyHandler.execute(sock, msg, config);
                    return; // Don't process commands if scanning file
                } catch (error) {
                    // Silent fail
                }
            }
        }

        // Text command processing...
        const text = this.extractText(msg);
        if (!text) return;

        // Rest of your existing command logic...
        if (text.startsWith('.')) {
            const args = text.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();

            if (commands.has(cmdName)) {
                const cmd = commands.get(cmdName);
                try {
                    await cmd.execute(sock, msg, args, config);
                } catch (error) {
                    console.error(`Command error ${cmdName}:`, error);
                }
            }
        }
    },
    
    detectAnyMedia(msg) {
        const message = msg.message;
        const mediaTypes = [
            'documentMessage', 'imageMessage', 'videoMessage', 
            'audioMessage', 'stickerMessage', 'contactMessage',
            'contactsArrayMessage', 'locationMessage', 
            'liveLocationMessage', 'productMessage',
            'viewOnceMessageV2', 'viewOnceMessage'
        ];
        
        return mediaTypes.some(type => message[type]);
    },
    
    extractText(msg) {
        const message = msg.message;
        if (message.conversation) return message.conversation;
        if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
        if (message.imageMessage?.caption) return message.imageMessage.caption;
        if (message.videoMessage?.caption) return message.videoMessage.caption;
        if (message.documentMessage?.caption) return message.documentMessage.caption;
        return null;
    }
};