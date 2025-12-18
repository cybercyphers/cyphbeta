require('dotenv').config();
const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require('baileys')
const pino = require('pino')
const fs = require('fs-extra')
const path = require('path')

// === Global Variables ===
const GLOBAL_OWNER = "cybercyphers";
const OWNER_PHONE = "+233539738956";
const TELEGRAM_USERNAME = "h4ck3r2008";

// === Bot Mode and User Management ===
let botMode = 'public';
let allowedUsers = new Set();
let onlineMode = false;

// === Load Config ===
function loadConfig() {
    const configPath = path.join(__dirname, '..', 'config.json');
    if (!fs.existsSync(configPath)) {
        console.log('❌ config.json not found!');
        process.exit(1);
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (config.mode) {
        botMode = config.mode;
    }
    
    onlineMode = config.online_status || false;
    
    return config;
}

// === Utility functions ===
function validatePhoneNumber(phone) {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
}

function formatPhoneNumber(phone) {
    return phone.replace(/\D/g, '');
}

// === Load/Save Bot Settings ===
function loadBotSettings() {
    try {
        const config = loadConfig();
        botMode = config.mode || 'public';
        onlineMode = config.online_status || false;

        const usersFile = path.join(__dirname, '..', 'allowed_users.json');
        if (fs.existsSync(usersFile)) {
            const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            allowedUsers = new Set(users);
        } else {
            fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
        }
    } catch (error) {
        console.log('❌ Error loading bot settings');
    }
}

// === Phone Number Setup ===
function setupPhoneNumber() {
    const config = loadConfig();
    const phoneNumber = config.phone_number;
    
    if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
        console.log('❌ Invalid phone number in config.json!');
        process.exit(1);
    }
    
    return formatPhoneNumber(phoneNumber);
}

// === Load Commands ===
const commands = new Map();
const commandsPath = path.join(__dirname, '..', 'commands');

function loadCommands() {
    try {
        if (!fs.existsSync(commandsPath)) {
            fs.mkdirSync(commandsPath, { recursive: true });
            return;
        }

        const files = fs.readdirSync(commandsPath);
        files.forEach(file => {
            if (file.endsWith('.js')) {
                try {
                    const command = require(path.join(commandsPath, file));
                    commands.set(command.name, command);
                } catch (error) {
                    // Silent fail for command loading
                }
            }
        });
    } catch (error) {
        // Silent fail
    }
}

// === Load Handlers ===
const handlers = new Map();
const handlersPath = path.join(__dirname, '..', 'handlers');

function loadHandlers() {
    try {
        if (!fs.existsSync(handlersPath)) {
            fs.mkdirSync(handlersPath, { recursive: true });
            return;
        }

        const files = fs.readdirSync(handlersPath);
        files.forEach(file => {
            if (file.endsWith('.js')) {
                try {
                    const handler = require(path.join(handlersPath, file));
                    handlers.set(handler.name, handler);
                } catch (error) {
                    // Silent fail for handler loading
                }
            }
        });
    } catch (error) {
        // Silent fail
    }
}

// === Visit Creator Command (Embedded) ===
function setupVisitCreatorCommand() {
    commands.set('creator', {
        name: 'creator',
        description: 'Contact the bot creator',
        async execute(sock, msg, args) {
            const from = msg.key.remoteJid;
            const platform = args[0]?.toLowerCase();

            if (platform === '-wa') {
                await sock.sendMessage(from, { 
                    text: `📱 *Contact Creator on WhatsApp*\n\nPhone: ${OWNER_PHONE}\n\n*Click the number to chat!*` 
                });
            } else if (platform === '-tg') {
                await sock.sendMessage(from, { 
                    text: `📱 *Contact Creator on Telegram*\n\nUsername: @${TELEGRAM_USERNAME}\n\n*Search for this username on Telegram!*` 
                });
            } else {
                await sock.sendMessage(from, { 
                    text: `🤖 *Bot Creator Information*\n\n*Name:* ${GLOBAL_OWNER}\n*WhatsApp:* ${OWNER_PHONE}\n*Telegram:* @${TELEGRAM_USERNAME}\n\n*Use these commands:*\n• .creater -wa\n• .creater -tg` 
                });
            }
        }
    });
}

// === Online Command (Embedded) ===
function setupOnlineCommand() {
    commands.set('online', {
        name: 'online',
        description: 'Toggle online status on/off',
        async execute(sock, msg, args) {
            const from = msg.key.remoteJid;
            const action = args[0]?.toLowerCase();

            if (!action) {
                await sock.sendMessage(from, {
                    text: `🟢 *ONLINE STATUS*\n\nCurrent: ${onlineMode ? '🟢 ONLINE' : '🔴 OFFLINE'}\n\n*Usage:*\n• .online on - Show as online\n• .online off - Show as offline\n\n💡 This updates both current session and config.json`
                });
                return;
            }

            if (action === 'on') {
                onlineMode = true;
                await sock.sendPresenceUpdate('available', from);
                await updateConfigOnlineStatus(true);
                await sock.sendMessage(from, {
                    text: '🟢 *ONLINE MODE ACTIVATED*\n\nYou will now appear online to others.\n\nUse `.online off` to go back offline.'
                });
            } else if (action === 'off') {
                onlineMode = false;
                await sock.sendPresenceUpdate('unavailable', from);
                await updateConfigOnlineStatus(false);
                await sock.sendMessage(from, {
                    text: '🔴 *OFFLINE MODE ACTIVATED*\n\nYou will now appear offline to others.\n\nUse `.online on` to go online.'
                });
            } else {
                await sock.sendMessage(from, {
                    text: '❌ *Invalid option!*\n\nUse: .online on/off'
                });
            }
        }
    });
}

// === Update online status in config.json ===
async function updateConfigOnlineStatus(status) {
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config.online_status = status;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        // Silent fail
    }
}

// === Check if user is allowed (Private Mode) ===
function isUserAllowed(msg, state) {
    if (botMode === 'public') return true;
    
    const from = msg.key.remoteJid;
    const userJid = msg.key.participant || from;
    const userNumber = userJid.split('@')[0];
    const botOwnerNumber = state.creds?.me?.id?.split(':')[0]?.split('@')[0];
    
    if (userNumber === botOwnerNumber) {
        return true;
    }
    
    if (allowedUsers.has(userNumber)) {
        return true;
    }
    
    return false;
}

// === Connection Handler ===
let reconnectAttempts = 0;
const maxReconnectAttempts = 20;

function handleConnection(sock, startBot, phoneNumber) {
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log('✅ Bot Connected');
            reconnectAttempts = 0;
            
            setTimeout(async () => {
                try {
                    if (onlineMode) {
                        await sock.sendPresenceUpdate('available');
                    } else {
                        await sock.sendPresenceUpdate('unavailable');
                    }
                } catch (error) {
                    // Silent fail
                }
            }, 1000);
        } 
        else if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            if (statusCode === 401) {
                setTimeout(() => {
                    startFreshSession(phoneNumber);
                }, 3000);
                return;
            }
            else if (statusCode === 403 || statusCode === 419) {
                process.exit(1);
            }
            
            reconnectAttempts++;
            const delay = Math.min(2000 + (reconnectAttempts * 1000), 15000);
            
            if (reconnectAttempts <= maxReconnectAttempts) {
                setTimeout(() => {
                    startBot();
                }, delay);
            } else {
                setTimeout(startBot, 5000);
            }
        }
    });
}

// === Start Fresh Session ===
async function startFreshSession(phoneNumber) {
    try {
        const authDir = './auth_info';
        if (fs.existsSync(authDir)) {
            await fs.remove(authDir);
        }
        
        setTimeout(() => {
            startBot();
        }, 2000);
        
    } catch (error) {
        setTimeout(startBot, 5000);
    }
}

// === Authentication Check ===
function shouldRequestNewSession(state) {
    if (!state.creds?.me) return true;
    
    const hasValidAuth = state.creds.registered && state.creds.me.id;
    
    if (!hasValidAuth) {
        return true;
    }
    
    return false;
}

// === Execute Handlers ===
async function executeHandlers(sock, m, state) {
    const msg = m.messages[0];
    
    if (isCommandMessage(msg) && botMode === 'private' && !isUserAllowed(msg, state)) {
        const from = msg.key.remoteJid;
        await sock.sendMessage(from, {
            text: '❌ *ACCESS DENIED*\n\nThis bot is in private mode. You are not authorized to use commands.'
        });
        return;
    }

    for (const [name, handler] of handlers) {
        try {
            await handler.execute(sock, m, state, commands);
        } catch (error) {
            // Silent fail
        }
    }
}

// === Check if message is a command ===
function isCommandMessage(msg) {
    if (!msg || !msg.message) return false;

    let text = '';
    if (msg.message.conversation) {
        text = msg.message.conversation;
    } else if (msg.message.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
    } else if (msg.message.imageMessage?.caption) {
        text = msg.message.imageMessage.caption;
    } else if (msg.message.videoMessage?.caption) {
        text = msg.message.videoMessage.caption;
    } else if (msg.message.documentMessage?.caption) {
        text = msg.message.documentMessage.caption;
    }

    return text && text.startsWith('.');
}

// === Main Bot Function ===
async function startBot() {
    let sock;

    try {
        const phoneNumber = setupPhoneNumber();
        const authDir = './auth_info';
        await fs.ensureDir(authDir);
        
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version } = await fetchLatestBaileysVersion();

        const needsNewSession = shouldRequestNewSession(state);

        if (needsNewSession) {
            sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                auth: state,
                printQRInTerminal: true,
                markOnlineOnConnect: false,
                syncFullHistory: false,
                linkPreviewImageThumbnailWidth: 0,
                generateHighQualityLinkPreview: false,
                emitOwnEvents: false,
                retryRequestDelayMs: 4000,
                maxRetries: 10,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                browser: ['Ubuntu', 'Chrome', '122.0.0.0'],
                fireInitQueries: true,
                transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
                mobile: false,
                shouldIgnoreJid: jid => false
            });

            let pairingCodeRequested = false;
            
            sock.ev.on('connection.update', async (update) => {
                if (update.connection === 'connecting' && !pairingCodeRequested) {
                    pairingCodeRequested = true;
                    setTimeout(async () => {
                        try {
                            const code = await sock.requestPairingCode(phoneNumber);
                            console.log(`✅ Pairing Code: ${code}`);
                        } catch (err) {
                            setTimeout(() => startBot(), 15000);
                        }
                    }, 3000);
                }
            });

        } else {
            sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                auth: state,
                markOnlineOnConnect: false,
                syncFullHistory: false,
                linkPreviewImageThumbnailWidth: 0,
                generateHighQualityLinkPreview: false,
                emitOwnEvents: false,
                retryRequestDelayMs: 4000,
                maxRetries: 10,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                browser: ['Ubuntu', 'Chrome', '122.0.0.0'],
                fireInitQueries: true,
                transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
                mobile: false,
                shouldIgnoreJid: jid => false
            });
        }

        loadBotSettings();
        loadCommands();
        loadHandlers();
        setupVisitCreatorCommand();
        setupOnlineCommand();

        sock.ev.on('creds.update', saveCreds);
        handleConnection(sock, startBot, phoneNumber);

        sock.ev.on('messages.upsert', async m => {
            await executeHandlers(sock, m, state);
            
            const msg = m.messages[0];
            if (isCommandMessage(msg)) {
                // Command processing logic here
            }
        });

    } catch (error) {
        const delay = error.message.includes('timeout') ? 10000 : 8000;
        
        setTimeout(() => {
            startBot();
        }, delay);
    }
}

// Start the bot
console.log('🚀 Starting Cyphers WhatsApp Bot...');
startBot();
