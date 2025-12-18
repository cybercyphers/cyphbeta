module.exports = {
    name: 'autostatusview',
    description: 'Auto view statuses',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const action = args[0]?.toLowerCase();

        try {
            const autostatusviewHandler = require('../handlers/autostatusviewHandler');

            if (!action) {
                await sock.sendMessage(from, {
                    text: `Status: ${autostatusviewHandler.status()}\n\n.on - Enable\n.off - Disable\n.check - Check now`
                });
                return;
            }

            if (action === 'on') {
                const result = autostatusviewHandler.enable();
                await sock.sendMessage(from, { 
                    text: `✅ ${result}` 
                });
            } 
            else if (action === 'off') {
                const result = autostatusviewHandler.disable();
                await sock.sendMessage(from, { 
                    text: `✅ ${result}` 
                });
            }
            else if (action === 'check') {
                const result = await autostatusviewHandler.forceCheck();
                await sock.sendMessage(from, { 
                    text: `✅ ${result}` 
                });
            }
            else {
                await sock.sendMessage(from, {
                    text: 'Use: .on / .off / .check'
                });
            }

        } catch (error) {
            await sock.sendMessage(from, {
                text: 'Error'
            });
        }
    }
};