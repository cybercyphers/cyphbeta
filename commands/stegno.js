// commands/stegno.js
const stegno = require('../lib/cyber-stegno');
const fileHandler = require('../lib/file-handler');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// Store operations
const pendingOps = new Map();

// PERFECT download
async function perfectDownload(msg) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            let content = null;
            let type = '';
            
            if (msg.imageMessage) {
                content = msg.imageMessage;
                type = 'image';
            } else if (msg.videoMessage) {
                content = msg.videoMessage;
                type = 'video';
            } else if (msg.audioMessage) {
                content = msg.audioMessage;
                type = 'audio';
            } else if (msg.documentMessage) {
                content = msg.documentMessage;
                type = 'document';
            } else {
                return null;
            }
            
            const stream = await downloadContentFromMessage(content, type);
            const chunks = [];
            
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            
            const buffer = Buffer.concat(chunks);
            
            if (buffer && buffer.length > 0) {
                return buffer;
            }
            
        } catch (error) {
            if (attempt === 3) throw error;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    throw new Error('DOWNLOAD_FAILED');
}

module.exports = {
    name: 'stegno',
    description: 'ADVANCED Steganography - Preserves Office files, images, everything!',
    async execute(sock, msg, args) {
        const jid = msg.key.remoteJid;
        const user = msg.key.participant || jid;
        
        try {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const cmd = args[0]?.toLowerCase() || 'help';
            
            switch(cmd) {
                case 'text':
                    await hideText(sock, jid, user, args.slice(1).join(' '), quoted);
                    break;
                    
                case 'docx':
                case 'pptx':
                case 'xlsx':
                case 'odt':
                case 'zip':
                case 'rar':
                case '7z':
                    await hideComplexFile(sock, jid, user, cmd, quoted);
                    break;
                    
                case 'audio':
                case 'file':
                case 'apk':
                case 'video':
                case 'image':
                case 'pdf':
                case 'doc':
                case 'ppt':
                case 'xls':
                    await hideMedia(sock, jid, user, cmd, quoted);
                    break;
                    
                case 'bulk':
                    await hideBulk(sock, jid, user, quoted);
                    break;
                    
                case 'check':
                    await checkImage(sock, jid, quoted);
                    break;
                    
                case 'get':
                    await extractData(sock, jid, quoted);
                    break;
                    
                case 'hide':
                    await hidePending(sock, jid, user, quoted);
                    break;
                    
                case 'test':
                    await testFile(sock, jid, quoted);
                    break;
                    
                case 'help':
                default:
                    await sock.sendMessage(jid, {
                        text: `🔧 *ULTIMATE STEGNO*\n\n*For Office/Complex files:*\n• \`.stegno docx\` + reply Word file\n• \`.stegno pptx\` + reply PowerPoint\n• \`.stegno xlsx\` + reply Excel\n• Then \`.stegno hide\` on image\n\n*For simple files:*\n• \`.stegno audio/pdf/etc\` + reply file\n• Then \`.stegno hide\` on image\n\n*Extract:*\n• \`.stegno get\` + reply stego image\n\n✅ GUARANTEED: Files work EXACTLY like original!`
                    });
            }
            
        } catch (error) {
            console.error('Stegno error:', error);
            await sock.sendMessage(jid, {
                text: `❌ Error: ${error.message}`
            });
        }
    }
};

// Hide text
async function hideText(sock, jid, user, text, quoted) {
    if (!quoted?.imageMessage) {
        return await sock.sendMessage(jid, {
            text: '❌ Reply to an image\n`.stegno text Your message` + reply image'
        });
    }
    
    if (!text?.trim()) {
        return await sock.sendMessage(jid, {
            text: '📝 Enter text to hide\nExample: `.stegno text Secret message`'
        });
    }
    
    await sock.sendMessage(jid, { text: '🔐 Processing...' });
    
    try {
        const imageBuffer = await perfectDownload(quoted);
        const textBuffer = Buffer.from(text, 'utf8');
        
        const stegoImage = await stegno.hidePerfectly(
            imageBuffer, 
            textBuffer, 
            'text', 
            'text.txt'
        );
        
        await sock.sendMessage(jid, {
            image: stegoImage,
            caption: '✅ Text hidden!'
        });
        
    } catch (error) {
        await sock.sendMessage(jid, {
            text: `❌ Failed: ${error.message}`
        });
    }
}

// Hide complex files (DOCX, PPTX, ZIP, etc.)
async function hideComplexFile(sock, jid, user, type, quoted) {
    if (!quoted?.documentMessage) {
        return await sock.sendMessage(jid, {
            text: `❌ Reply to ${type} file\n\`.stegno ${type}\` + reply ${type} file`
        });
    }
    
    await sock.sendMessage(jid, { text: `📥 Processing ${type.toUpperCase()}...` });
    
    try {
        const originalBuffer = await perfectDownload(quoted);
        if (!originalBuffer || originalBuffer.length === 0) {
            throw new Error('Empty file');
        }
        
        const originalName = quoted.documentMessage.fileName || `${type}_${Date.now()}.${type}`;
        
        // Process file with file handler
        const processed = await fileHandler.processForHiding(originalBuffer, originalName);
        
        // Store with metadata
        pendingOps.set(user, {
            type: processed.type,
            data: processed.processed,
            filename: originalName,
            metadata: processed.metadata, // Store metadata
            timestamp: Date.now(),
            isComplex: true
        });
        
        await sock.sendMessage(jid, {
            text: `✅ *${type.toUpperCase()} PROCESSED!*\n\nFile: ${originalName}\nSize: ${formatSize(originalBuffer.length)}\nStructure: ${processed.metadata.isSpecial ? 'PRESERVED' : 'Normal'}\n\nReply to image with:\n\`.stegno hide\``
        });
        
    } catch (error) {
        await sock.sendMessage(jid, {
            text: `❌ Failed: ${error.message}`
        });
    }
}

// Hide regular media
async function hideMedia(sock, jid, user, type, quoted) {
    if (!quoted) {
        return await sock.sendMessage(jid, {
            text: `❌ Reply to file\n\`.stegno ${type}\` + reply file`
        });
    }
    
    await sock.sendMessage(jid, { text: `📥 Downloading...` });
    
    try {
        const originalBuffer = await perfectDownload(quoted);
        if (!originalBuffer || originalBuffer.length === 0) {
            throw new Error('Empty file');
        }
        
        let originalName = 'file.bin';
        if (quoted.documentMessage?.fileName) {
            originalName = quoted.documentMessage.fileName;
        } else if (quoted.audioMessage) {
            originalName = `audio_${Date.now()}.mp3`;
        } else if (quoted.videoMessage) {
            originalName = `video_${Date.now()}.mp4`;
        } else if (quoted.imageMessage) {
            originalName = `image_${Date.now()}.jpg`;
        }
        
        // Process file with file handler
        const processed = await fileHandler.processForHiding(originalBuffer, originalName);
        
        pendingOps.set(user, {
            type: type,
            data: processed.processed,
            filename: originalName,
            metadata: processed.metadata, // Store metadata
            timestamp: Date.now(),
            isComplex: false
        });
        
        await sock.sendMessage(jid, {
            text: `✅ File ready!\n\nName: ${originalName}\nSize: ${formatSize(originalBuffer.length)}\n\nReply to image:\n\`.stegno hide\``
        });
        
    } catch (error) {
        await sock.sendMessage(jid, {
            text: `❌ Failed: ${error.message}`
        });
    }
}

// Hide bulk
async function hideBulk(sock, jid, user, quoted) {
    if (!quoted?.documentMessage) {
        return await sock.sendMessage(jid, {
            text: '❌ Reply to large file\n`.stegno bulk` + reply file'
        });
    }
    
    await sock.sendMessage(jid, { text: '📦 Processing...' });
    
    try {
        const originalBuffer = await perfectDownload(quoted);
        const originalName = quoted.documentMessage.fileName || 'large_file.bin';
        
        pendingOps.set(user, {
            type: 'bulk',
            data: originalBuffer,
            filename: originalName,
            timestamp: Date.now(),
            bulkMode: true
        });
        
        await sock.sendMessage(jid, {
            text: `📊 Bulk mode!\n\nFile: ${originalName}\nSize: ${formatSize(originalBuffer.length)}\n\nReply to images:\n\`.stegno hide\``
        });
        
    } catch (error) {
        await sock.sendMessage(jid, {
            text: `❌ Failed: ${error.message}`
        });
    }
}

// Check image
async function checkImage(sock, jid, quoted) {
    if (!quoted?.imageMessage) {
        return await sock.sendMessage(jid, {
            text: '❌ Reply to image\n`.stegno check`'
        });
    }
    
    await sock.sendMessage(jid, { text: '🔍 Checking...' });
    
    try {
        const imageBuffer = await perfectDownload(quoted);
        const hasData = await stegno.hasHiddenData(imageBuffer);
        
        if (hasData) {
            const info = await stegno.getHiddenInfo(imageBuffer);
            await sock.sendMessage(jid, {
                text: `🔐 DATA FOUND!\n\n📁 Type: ${info.type}\n📦 Size: ${formatSize(info.size)}\n📝 Name: ${info.name}\n📅 Date: ${info.timestamp}\n\nUse \`.stegno get\``
            });
        } else {
            await sock.sendMessage(jid, {
                text: '❌ No hidden data'
            });
        }
        
    } catch (error) {
        await sock.sendMessage(jid, {
            text: `❌ Check failed: ${error.message}`
        });
    }
}

// EXTRACT DATA - WITH FILE HANDLER
async function extractData(sock, jid, quoted) {
    if (!quoted?.imageMessage) {
        return await sock.sendMessage(jid, {
            text: '❌ Reply to stego image\n`.stegno get`'
        });
    }
    
    await sock.sendMessage(jid, { text: '🎯 EXTRACTING PERFECT COPY...' });
    
    try {
        const imageBuffer = await perfectDownload(quoted);
        const extracted = await stegno.extractPerfectly(imageBuffer);
        
        if (!extracted || !extracted.data) {
            throw new Error('NO_DATA');
        }
        
        const { header, data } = extracted;
        
        // Process with file handler to restore file
        const restored = await fileHandler.processAfterExtraction(data, header);
        
        // Send the restored file
        await sendRestoredFile(sock, jid, restored);
        
    } catch (error) {
        console.error('Extract error:', error);
        
        if (error.message === 'NO_DATA') {
            await sock.sendMessage(jid, {
                text: '❌ No data found!'
            });
        } else if (error.message === 'DATA_CORRUPTED') {
            await sock.sendMessage(jid, {
                text: '⚠️ Data corrupted!\nImage was modified after hiding.'
            });
        } else {
            await sock.sendMessage(jid, {
                text: `❌ Extract failed: ${error.message}`
            });
        }
    }
}

// Send restored file PROPERLY
async function sendRestoredFile(sock, jid, restored) {
    const { buffer, filename, mimeType } = restored;
    
    // Clean filename
    const cleanName = filename.replace(/[<>:"/\\|?*]/g, '_');
    
    console.log(`Sending: ${cleanName}, MIME: ${mimeType}, Size: ${buffer.length}`);
    
    // Determine how to send based on file type
    if (mimeType.startsWith('audio/')) {
        // Send as audio
        await sock.sendMessage(jid, {
            audio: buffer,
            mimetype: mimeType,
            ptt: false
        });
        
        await sock.sendMessage(jid, {
            text: `🎵 AUDIO EXTRACTED!\n\n✅ Ready to play!\nSize: ${formatSize(buffer.length)}`
        });
        
    } else if (mimeType.startsWith('image/')) {
        // Send as image
        await sock.sendMessage(jid, {
            image: buffer,
            caption: `🖼️ Image extracted (${formatSize(buffer.length)})`
        });
        
    } else if (mimeType.startsWith('video/')) {
        // Send as video
        await sock.sendMessage(jid, {
            video: buffer,
            caption: `🎥 Video extracted (${formatSize(buffer.length)})`
        });
        
    } else {
        // Send as document with PROPER MIME type
        await sock.sendMessage(jid, {
            document: buffer,
            fileName: cleanName,
            mimetype: mimeType
        });
        
        // Special message for Office files
        if (mimeType.includes('openxmlformats') || mimeType.includes('officedocument')) {
            await sock.sendMessage(jid, {
                text: `📄 OFFICE FILE EXTRACTED!\n\nFile: ${cleanName}\nSize: ${formatSize(buffer.length)}\n✅ ALL structure preserved!\n✅ Images, formatting intact!\n✅ Ready to open in Word/PowerPoint/Excel!`
            });
        } else {
            await sock.sendMessage(jid, {
                text: `📁 FILE EXTRACTED!\n\nFile: ${cleanName}\nSize: ${formatSize(buffer.length)}\n✅ Perfect copy preserved!`
            });
        }
    }
}

// Hide pending
async function hidePending(sock, jid, user, quoted) {
    if (!pendingOps.has(user)) {
        return await sock.sendMessage(jid, {
            text: '❌ No file pending'
        });
    }
    
    if (!quoted?.imageMessage) {
        return await sock.sendMessage(jid, {
            text: '❌ Reply to image\n`.stegno hide`'
        });
    }
    
    const pending = pendingOps.get(user);
    
    if (Date.now() - pending.timestamp > 900000) {
        pendingOps.delete(user);
        return await sock.sendMessage(jid, {
            text: '⏰ Expired'
        });
    }
    
    await sock.sendMessage(jid, { text: '🔐 Hiding with structure preservation...' });
    
    try {
        const imageBuffer = await perfectDownload(quoted);
        
        let stegoImage, caption;
        
        if (pending.bulkMode) {
            // Simple bulk
            stegoImage = await stegno.hidePerfectly(
                imageBuffer,
                pending.data,
                'file',
                pending.filename
            );
            
            caption = `✅ File hidden!\n\nExtract with: \`.stegno get\``;
            pendingOps.delete(user);
            
        } else {
            // Regular file with metadata
            const fileType = pending.isComplex ? 'office' : pending.type;
            
            stegoImage = await stegno.hidePerfectly(
                imageBuffer,
                pending.data,
                fileType,
                pending.filename,
                pending.metadata // Pass metadata for perfect restoration
            );
            
            caption = `✅ ${pending.type.toUpperCase()} HIDDEN!\n\nStructure: ${pending.metadata?.isSpecial ? 'PRESERVED' : 'Normal'}\nExtract with: \`.stegno get\``;
            pendingOps.delete(user);
        }
        
        await sock.sendMessage(jid, {
            image: stegoImage,
            caption: caption
        });
        
    } catch (error) {
        await sock.sendMessage(jid, {
            text: `❌ Hide failed: ${error.message}`
        });
    }
}

// Test file
async function testFile(sock, jid, quoted) {
    if (!quoted?.documentMessage) {
        return await sock.sendMessage(jid, {
            text: '❌ Reply to file\n`.stegno test` + reply file'
        });
    }
    
    await sock.sendMessage(jid, { text: '🧪 Analyzing file structure...' });
    
    try {
        const buffer = await perfectDownload(quoted);
        const filename = quoted.documentMessage.fileName || 'test_file';
        
        const processed = await fileHandler.processForHiding(buffer, filename);
        
        await sock.sendMessage(jid, {
            text: `🧪 FILE ANALYSIS:\n\nName: ${filename}\nSize: ${formatSize(buffer.length)}\nType: ${processed.type}\nStructure: ${processed.metadata.isSpecial ? 'Complex (ZIP-based)' : 'Simple'}\nEntries: ${processed.metadata.entryCount || 'N/A'}\nOffice File: ${processed.metadata.isOffice ? '✅ Yes' : '❌ No'}\n\n✅ Ready for perfect steganography!`
        });
        
    } catch (error) {
        await sock.sendMessage(jid, {
            text: `❌ Analysis failed: ${error.message}`
        });
    }
}

// Utility
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}