const fs = require('fs-extra');
const path = require('path');

class NotificationHandler {
    constructor() {
        this.name = 'notificationHandler';
        this.mutedChannels = new Set();
        this.notificationSettings = {
            enabled: true,
            silentMode: true, // No terminal updates
            announcementChannels: new Set()
        };
        this.loadSettings();
    }

    async execute(sock, m, state, commands) {
        try {
            const msg = m.messages[0];
            
            if (!msg || !msg.message) return;
            if (msg.key.fromMe) return;

            // Get channel/jid info
            const jid = msg.key.remoteJid;
            
            // Skip if notifications are disabled globally
            if (!this.notificationSettings.enabled) return;

            // Check if this is a channel/group
            const isGroup = jid.endsWith('@g.us');
            const isBroadcast = jid.endsWith('@broadcast');
            
            // Handle group/channel messages
            if (isGroup || isBroadcast) {
                // Check if channel is muted
                if (this.mutedChannels.has(jid)) {
                    return; // Silent ignore
                }

                // Check if channel is announcement-only
                if (this.notificationSettings.announcementChannels.has(jid)) {
                    // Only proceed if message is an announcement
                    const isAnnouncement = await this.isAnnouncementMessage(msg);
                    if (!isAnnouncement) {
                        return; // Silent ignore
                    }
                }

                // Check message type and decide if notification should be sent
                const shouldNotify = await this.shouldSendNotification(msg);
                if (!shouldNotify) return;

                // Process notification (silently)
                await this.processNotification(sock, msg);
            }

        } catch (error) {
            // Completely silent error handling - no console logs
        }
    }

    async isAnnouncementMessage(msg) {
        try {
            const message = msg.message;
            
            // Check for announcement indicators
            if (message.extendedTextMessage) {
                const text = message.extendedTextMessage.text || '';
                // Common announcement patterns
                const announcementPatterns = [
                    /announcement/i,
                    /important/i,
                    /urgent/i,
                    /notice/i,
                    /update/i,
                    /📢/,
                    /🔔/,
                    /⚠️/
                ];
                
                return announcementPatterns.some(pattern => pattern.test(text));
            }
            
            return false;
        } catch {
            return false;
        }
    }

    async shouldSendNotification(msg) {
        try {
            const message = msg.message;
            
            // Skip certain message types
            const skipTypes = [
                'protocolMessage',
                'ephemeralMessage',
                'reactionMessage',
                'pollUpdateMessage'
            ];
            
            for (const type of skipTypes) {
                if (message[type]) return false;
            }

            // Check if message has actual content
            const hasContent = 
                message.conversation ||
                message.extendedTextMessage ||
                message.imageMessage ||
                message.videoMessage ||
                message.audioMessage ||
                message.documentMessage ||
                message.contactMessage ||
                message.locationMessage ||
                message.stickerMessage;
            
            return !!hasContent;
        } catch {
            return false;
        }
    }

    async processNotification(sock, msg) {
  
    }
    enableNotifications() {
        this.notificationSettings.enabled = true;
        this.saveSettings();
        return 'Notifications enabled';
    }

    disableNotifications() {
        this.notificationSettings.enabled = false;
        this.saveSettings();
        return 'Notifications disabled';
    }

    muteChannel(jid) {
        this.mutedChannels.add(jid);
        this.saveSettings();
        return `Channel ${jid} muted`;
    }

    unmuteChannel(jid) {
        this.mutedChannels.delete(jid);
        this.saveSettings();
        return `Channel ${jid} unmuted`;
    }

    setAnnouncementOnly(jid) {
        this.notificationSettings.announcementChannels.add(jid);
        this.saveSettings();
        return `Channel ${jid} set to announcement-only`;
    }

    removeAnnouncementOnly(jid) {
        this.notificationSettings.announcementChannels.delete(jid);
        this.saveSettings();
        return `Channel ${jid} removed from announcement-only`;
    }

    status() {
        return {
            enabled: this.notificationSettings.enabled,
            mutedChannels: Array.from(this.mutedChannels),
            announcementChannels: Array.from(this.notificationSettings.announcementChannels)
        };
    }

    // Silent settings management
    async loadSettings() {
        try {
            const settingsPath = path.join(__dirname, 'notificationSettings.json');
            if (await fs.pathExists(settingsPath)) {
                const data = await fs.readJson(settingsPath);
                this.mutedChannels = new Set(data.mutedChannels || []);
                this.notificationSettings.enabled = data.enabled !== false;
                this.notificationSettings.announcementChannels = new Set(data.announcementChannels || []);
            }
        } catch {
            // Silent fail - use defaults
        }
    }

    async saveSettings() {
        try {
            const settingsPath = path.join(__dirname, 'notificationSettings.json');
            const data = {
                mutedChannels: Array.from(this.mutedChannels),
                enabled: this.notificationSettings.enabled,
                announcementChannels: Array.from(this.notificationSettings.announcementChannels)
            };
            await fs.writeJson(settingsPath, data);
        } catch {
            // Silent fail
        }
    }
}
//by cyber cyphers (we have nt time to decrypt this enjoy 
module.exports = new NotificationHandler();
