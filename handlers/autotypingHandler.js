const fs = require('fs-extra');
const path = require('path');

class AutoTypingHandler {
    constructor() {
        this.name = 'autotypingHandler';
        this.enabled = true; // Enable by default
        this.typingSessions = new Map();
        console.log(`🎯 AutoTyping Handler INITIALIZED - Enabled: ${this.enabled}`);
    }

    async execute(sock, m, state, commands) {
        try {
            const msg = m.messages[0];
            
            // IMMEDIATE RETURN if disabled - no logs, no processing
            if (!this.enabled) {
                return; // Stop at once without any detection or logging
            }

            // Only run the rest if enabled
            if (!msg) {
                return;
            }

            // Skip if message is from the bot itself
            if (msg.key.fromMe) {
                return;
            }

            const from = msg.key.remoteJid;
            
            // Show typing for EVERY message when enabled
            await this.startTyping(sock, from);

        } catch (error) {
            console.log('❌ AutoTyping execute error:', error.message);
        }
    }

    async startTyping(sock, jid) {
        try {
            // Double check enabled state before starting typing
            if (!this.enabled) {
                return;
            }
            
            // Stop any existing typing first
            if (this.typingSessions.has(jid)) {
                await this.stopTyping(sock, jid);
            }
            
            // Start typing indicator
            await sock.sendPresenceUpdate('composing', jid);

            // Store session and set timeout to stop after 50 seconds
            const timeout = setTimeout(async () => {
                await this.stopTyping(sock, jid);
            }, 50000); // 50 seconds

            this.typingSessions.set(jid, { 
                timeout: timeout, 
                jid: jid,
                startTime: Date.now()
            });

        } catch (error) {
            console.log('❌ AutoTyping startTyping error:', error.message);
        }
    }

    async stopTyping(sock, jid) {
        try {
            const session = this.typingSessions.get(jid);
            if (session) {
                clearTimeout(session.timeout);
                this.typingSessions.delete(jid);
            }
            
            await sock.sendPresenceUpdate('paused', jid);
            
        } catch (error) {
            console.log('❌ AutoTyping stopTyping error:', error.message);
        }
    }

    async stopAllTyping(sock) {
        for (const [jid, session] of this.typingSessions) {
            if (session.timeout) {
                clearTimeout(session.timeout);
            }
            if (sock) {
                await sock.sendPresenceUpdate('paused', jid);
            }
            this.typingSessions.delete(jid);
        }
    }

    // Control methods
    enable() {
        this.enabled = true;
        console.log('🟢 AutoTyping: ENABLED');
        return '🟢 AutoTyping ENABLED';
    }

    disable() {
        this.enabled = false;
        console.log('🔴 AutoTyping: DISABLED');
        this.stopAllTyping();
        return '🔴 AutoTyping DISABLED';
    }

    status() {
        return this.enabled ? '🟢 ENABLED' : '🔴 DISABLED';
    }

    getStats() {
        return {
            enabled: this.enabled,
            activeSessions: this.typingSessions.size,
            sessions: Array.from(this.typingSessions.keys())
        };
    }
}

module.exports = new AutoTypingHandler();