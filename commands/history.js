const fs = require('fs');
const path = require('path');

// Global message storage
const messageStore = new Map();

module.exports = {
    name: 'history',
    description: 'Collect and store chat history in real-time',
    
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        
        try {
            // Send awareness notification
            await sock.sendMessage(from, {
                text: `📝 *HISTORY COLLECTION STARTED*\n\n🔍 Collecting available chat history...\n⏰ I will store all future messages for history\n📄 Text messages only\n👁️ This action is visible to all participants\n\nScanning messages...`
            }, { quoted: msg });

            // Store current message immediately
            this.storeMessage(from, msg);

            // Collect available history
            const historyResult = await this.collectAvailableHistory(from);
            
            if (historyResult.success) {
                // Send the history file
                await sock.sendMessage(from, {
                    document: historyResult.fileBuffer,
                    fileName: historyResult.fileName,
                    caption: `📚 *CHAT HISTORY REPORT*\n\n📊 Messages Found: ${historyResult.stats.totalMessages}\n👥 Participants: ${historyResult.stats.participants}\n📅 Period: ${historyResult.stats.dateRange}\n💾 File: ${historyResult.fileName}\n\n✅ From now on, I will store all messages for future history!`
                }, { quoted: msg });

                // Cleanup
                if (fs.existsSync(historyResult.filePath)) {
                    fs.unlinkSync(historyResult.filePath);
                }
                
            } else {
                await sock.sendMessage(from, {
                    text: `📝 *HISTORY SYSTEM ACTIVATED*\n\nI found ${historyResult.stats.totalMessages} messages so far.\nFrom now on, I will store ALL messages in this chat for future history collection!\n\nUse .history again later to see more messages.`
                }, { quoted: msg });
            }
            
        } catch (error) {
            console.error('History command error:', error);
            await sock.sendMessage(from, {
                text: '📝 Starting real-time message storage...\n\nI will now store all future messages for history collection!'
            }, { quoted: msg });
        }
    },

    // Store message for future history
    storeMessage(chatJid, msg) {
        try {
            if (!messageStore.has(chatJid)) {
                messageStore.set(chatJid, []);
            }
            
            const chatMessages = messageStore.get(chatJid);
            const messageData = this.createMessageData(msg);
            
            // Avoid duplicates
            const exists = chatMessages.some(m => m.id === messageData.id);
            if (!exists) {
                chatMessages.push(messageData);
                
                // Limit storage to prevent memory issues
                if (chatMessages.length > 5000) {
                    chatMessages.splice(0, 1000); // Remove oldest 1000 messages
                }
                
                console.log(`💾 Stored message for history: ${chatJid} - ${messageData.id}`);
            }
        } catch (error) {
            console.error('Message storage error:', error);
        }
    },

    createMessageData(msg) {
        return {
            id: msg.key.id || Date.now().toString(),
            timestamp: new Date().toISOString(),
            sender: msg.key.participant || msg.key.remoteJid,
            type: this.getMessageType(msg),
            content: this.extractMessageText(msg),
            isDeleted: false,
            storedAt: new Date().toISOString()
        };
    },

    getMessageType(msg) {
        if (msg.message?.conversation) return 'text';
        if (msg.message?.extendedTextMessage) return 'text';
        if (msg.message?.imageMessage) return 'image';
        if (msg.message?.videoMessage) return 'video';
        if (msg.message?.audioMessage) return 'audio';
        if (msg.message?.documentMessage) return 'document';
        if (msg.message?.stickerMessage) return 'sticker';
        return 'unknown';
    },

    async collectAvailableHistory(chatJid) {
        try {
            // Get stored messages
            const storedMessages = messageStore.get(chatJid) || [];
            
            if (storedMessages.length === 0) {
                return {
                    success: false,
                    stats: {
                        totalMessages: 0,
                        participants: 0,
                        dateRange: 'No messages stored yet'
                    }
                };
            }

            // Format messages for readable output
            const formattedHistory = this.formatStoredMessages(storedMessages, chatJid);
            
            // Create text file
            const fileName = `Chat_History_${this.getChatName(chatJid)}_${Date.now()}.txt`;
            const filePath = path.join(__dirname, '../temp', fileName);
            
            // Ensure temp directory exists
            const tempDir = path.dirname(filePath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // Write to file
            fs.writeFileSync(filePath, formattedHistory);
            const fileBuffer = fs.readFileSync(filePath);
            
            // Calculate statistics
            const stats = this.calculateStats(storedMessages);
            
            return {
                success: true,
                fileBuffer: fileBuffer,
                filePath: filePath,
                fileName: fileName,
                stats: stats
            };
            
        } catch (error) {
            console.error('History collection error:', error);
            return {
                success: false,
                error: error.message,
                stats: {
                    totalMessages: 0,
                    participants: 0,
                    dateRange: 'Error collecting history'
                }
            };
        }
    },

    formatStoredMessages(messages, chatJid) {
        let formattedText = `REAL-TIME CHAT HISTORY REPORT\n`;
        formattedText += `Chat: ${this.getChatName(chatJid)}\n`;
        formattedText += `Generated: ${new Date().toLocaleString()}\n`;
        formattedText += `Total Messages Stored: ${messages.length}\n`;
        formattedText += `Note: Messages are stored from when bot is active\n`;
        formattedText += `="="="="="="="="="="="="="="="="="="="="="="=\n\n`;
        
        // Sort messages by timestamp
        const sortedMessages = messages.sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        // Format each message
        sortedMessages.forEach((msg, index) => {
            if (msg.content && msg.content !== '[UNSUPPORTED MESSAGE TYPE]') {
                const timestamp = new Date(msg.timestamp).toLocaleString();
                const sender = this.extractNumber(msg.sender);
                
                formattedText += `[${index + 1}] [${timestamp}] ${sender}:\n`;
                formattedText += `${msg.content}\n\n`;
                formattedText += `-"-"-"-"-"-"-"-"-"-"-"-"-"-"-"-"-"-"-\n\n`;
            }
        });
        
        // Add summary
        formattedText += `\n\n=== SUMMARY ===\n`;
        formattedText += `Total Messages: ${sortedMessages.length}\n`;
        formattedText += `Collection Date: ${new Date().toLocaleString()}\n`;
        formattedText += `Storage Started: ${sortedMessages[0] ? new Date(sortedMessages[0].timestamp).toLocaleString() : 'N/A'}\n`;
        formattedText += `Chat ID: ${chatJid}\n`;
        
        return formattedText;
    },

    extractMessageText(msg) {
        try {
            if (!msg.message) return '[SYSTEM MESSAGE]';
            
            if (msg.message.conversation) {
                return msg.message.conversation;
            }
            if (msg.message.extendedTextMessage?.text) {
                return msg.message.extendedTextMessage.text;
            }
            if (msg.message.imageMessage?.caption) {
                return `[IMAGE] ${msg.message.imageMessage.caption || ''}`;
            }
            if (msg.message.videoMessage?.caption) {
                return `[VIDEO] ${msg.message.videoMessage.caption || ''}`;
            }
            if (msg.message.documentMessage?.caption) {
                return `[DOCUMENT] ${msg.message.documentMessage.caption || ''}`;
            }
            if (msg.message.audioMessage) {
                return `[AUDIO] ${msg.message.audioMessage.ptt ? 'Voice Message' : 'Audio File'}`;
            }
            if (msg.message.stickerMessage) {
                return '[STICKER]';
            }
            if (msg.message.contactMessage) {
                return '[CONTACT]';
            }
            if (msg.message.locationMessage) {
                return '[LOCATION]';
            }
            return '[MEDIA MESSAGE]';
        } catch (error) {
            return '[MESSAGE PARSE ERROR]';
        }
    },

    extractNumber(jid) {
        return jid.split('@')[0];
    },

    getChatName(chatJid) {
        if (chatJid.includes('@g.us')) {
            return `Group_${chatJid.split('@')[0].slice(-6)}`;
        } else {
            return `Private_${chatJid.split('@')[0]}`;
        }
    },

    calculateStats(messages) {
        const stats = {
            totalMessages: messages.length,
            participants: new Set(),
            dateRange: 'Unknown',
            textMessages: 0,
            mediaMessages: 0
        };

        let earliestDate = null;
        let latestDate = null;

        messages.forEach(msg => {
            // Count participants
            stats.participants.add(msg.sender);
            
            // Count message types
            if (msg.type === 'text') {
                stats.textMessages++;
            } else {
                stats.mediaMessages++;
            }
            
            // Calculate date range
            const messageDate = new Date(msg.timestamp);
            if (!earliestDate || messageDate < earliestDate) {
                earliestDate = messageDate;
            }
            if (!latestDate || messageDate > latestDate) {
                latestDate = messageDate;
            }
        });

        stats.participants = stats.participants.size;
        
        if (earliestDate && latestDate) {
            stats.dateRange = `${earliestDate.toLocaleDateString()} - ${latestDate.toLocaleDateString()}`;
        }

        return stats;
    }
};

// MESSAGE STORAGE SYSTEM - This stores messages in real-time
function setupMessageStorage(sock) {
    // Listen to all incoming messages and store them
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            const chatJid = msg.key.remoteJid;
            
            // Get the history command
            const historyCmd = require('./history');
            if (historyCmd && historyCmd.storeMessage) {
                historyCmd.storeMessage(chatJid, msg);
            }
        } catch (error) {
            console.error('Message storage setup error:', error);
        }
    });
}

// Export the setup function
module.exports.setupMessageStorage = setupMessageStorage;