const fs = require('fs-extra');
const path = require('path');

class NotificationHandler {
    constructor() {
        this.name = 'notificationHandler';
        this.allowNotifications = true; // Always allow notifications by default
        console.log(`🔔 Notification Handler INITIALIZED - Notifications: ${this.allowNotifications ? 'ALLOWED' : 'BLOCKED'}`);
    }

    async execute(sock, m, state, commands) {
        try {
            const msg = m.messages[0];
            
            if (!msg || !msg.message) return;
            if (msg.key.fromMe) return; // Skip bot's own messages

            const from = msg.key.remoteJid;
            const sender = msg.pushName || 'Unknown';
            
            console.log(`🔔 NotificationHandler: Message from ${sender} - Notifications are ${this.allowNotifications ? 'ENABLED' : 'DISABLED'}`);
            
            // This handler ensures notifications work by not blocking the message flow
            // The actual notification delivery is handled by WhatsApp itself

        } catch (error) {
            console.log('❌ Notification error:', error.message);
        }
    }

    // Control methods
    enableNotifications() {
        this.allowNotifications = true;
        console.log('🔔 Notifications: ENABLED - User will receive normal WhatsApp alerts');
        return '🔔 Notifications ENABLED';
    }

    disableNotifications() {
        this.allowNotifications = false;
        console.log('🔕 Notifications: DISABLED - User may not receive alerts');
        return '🔕 Notifications DISABLED';
    }

    status() {
        return this.allowNotifications ? '🔔 ENABLED' : '🔕 DISABLED';
    }
}

module.exports = new NotificationHandler();
