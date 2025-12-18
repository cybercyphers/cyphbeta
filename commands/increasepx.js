const sharp = require('sharp');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'increasepx',
    description: 'Enhance image quality',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        
        try {
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            let imageMessage = null;
            
            if (quotedMsg?.imageMessage) {
                imageMessage = quotedMsg.imageMessage;
            } else if (msg.message?.imageMessage) {
                imageMessage = msg.message.imageMessage;
            }

            if (!imageMessage) {
                await sock.sendMessage(from, { 
                    text: '❌ Reply to an image\n💡 Use: .increasepx <mode>\n\n✨ Modes:\n• quality • sharp • color • ultra\n• clean • bright • 1 • 2 • 3 • max' 
                }, { quoted: msg });
                return;
            }

            const enhanceOption = args[0]?.toLowerCase() || 'quality';
            
            await sock.sendMessage(from, { 
                text: '🔄 Enhancing image quality...' 
            }, { quoted: msg });

            const imageBuffer = await downloadImage(imageMessage);
            
            if (!imageBuffer) {
                await sock.sendMessage(from, { 
                    text: '❌ Download failed' 
                }, { quoted: msg });
                return;
            }

            const { processedBuffer, enhancementInfo } = await enhanceImageQuality(imageBuffer, enhanceOption);
            
            if (!processedBuffer) {
                await sock.sendMessage(from, { 
                    text: '❌ Processing failed' 
                }, { quoted: msg });
                return;
            }

            await sock.sendMessage(from, { 
                image: processedBuffer,
                caption: enhancementInfo
            }, { quoted: msg });

            console.log(`✅ Enhanced: ${enhanceOption}`);

        } catch (error) {
            console.error('Enhance error:', error);
            await sock.sendMessage(from, { 
                text: `❌ Error: ${error.message}` 
            }, { quoted: msg });
        }
    }
};

async function downloadImage(imageMessage) {
    try {
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        const buffer = await streamToBuffer(stream);
        return buffer;
    } catch (error) {
        throw new Error('Download failed');
    }
}

async function enhanceImageQuality(buffer, enhanceOption) {
    try {
        let sharpInstance = sharp(buffer);
        const metadata = await sharpInstance.metadata();
        const originalWidth = metadata.width;
        const originalHeight = metadata.height;

        const enhancementMatrix = {
            'quality': { level: 3, sharp: 1.4, color: 1.2, contrast: 1.15, quality: 96 },
            'sharp': { level: 4, sharp: 2.2, color: 1.0, contrast: 1.1, quality: 94, detail: true },
            'color': { level: 3, sharp: 1.2, color: 1.6, contrast: 1.2, quality: 95, vibrance: true },
            'ultra': { level: 5, sharp: 1.8, color: 1.3, contrast: 1.25, quality: 98, detail: true, clarity: true },
            'clean': { level: 3, sharp: 1.3, color: 1.1, contrast: 1.1, quality: 97, denoise: true, clarity: true },
            'bright': { level: 3, sharp: 1.1, color: 1.2, contrast: 1.3, quality: 92, brightness: 1.25, exposure: true },
            '1': { level: 1, sharp: 1.0, color: 1.1, contrast: 1.05, quality: 88 },
            '2': { level: 2, sharp: 1.3, color: 1.15, contrast: 1.1, quality: 92 },
            '3': { level: 3, sharp: 1.6, color: 1.2, contrast: 1.15, quality: 95 },
            'max': { level: 5, sharp: 2.5, color: 1.4, contrast: 1.3, quality: 100, detail: true, clarity: true, vibrance: true }
        };

        const config = enhancementMatrix[enhanceOption] || enhancementMatrix.quality;

        sharpInstance = sharpInstance
            .resize(originalWidth, originalHeight, {
                fit: 'fill',
                withoutEnlargement: true,
                kernel: sharp.kernel.lanczos3
            });

        if (config.denoise) {
            sharpInstance = sharpInstance.median(3).blur(0.3);
        }

        sharpInstance = sharpInstance.sharpen({
            sigma: config.sharp,
            m1: 2.0,
            m2: 0.8,
            x1: 3.0
        });

        if (config.detail) {
            sharpInstance = sharpInstance.convolve({
                width: 3,
                height: 3,
                kernel: [-0.5, -0.5, -0.5, -0.5, 5, -0.5, -0.5, -0.5, -0.5]
            });
        }

        sharpInstance = sharpInstance
            .linear(config.contrast, -(config.contrast - 1) * 10)
            .modulate({
                brightness: config.brightness || 1.05,
                saturation: config.color
            });

        if (config.vibrance) {
            sharpInstance = sharpInstance.modulate({
                saturation: config.color * 1.1
            });
        }

        if (config.clarity) {
            sharpInstance = sharpInstance.gamma(1.1).normalise({ lower: 2, upper: 98 });
        }

        if (config.exposure) {
            sharpInstance = sharpInstance.linear(1.1, 15);
        }

        const processedBuffer = await sharpInstance
            .jpeg({ 
                quality: config.quality,
                mozjpeg: true,
                chromaSubsampling: '4:4:4',
                optimiseScans: true,
                trellisQuantisation: true,
                overshootDeringing: true,
                optimiseCoding: true
            })
            .toBuffer();

        const enhancements = [];
        if (config.level >= 4) enhancements.push('Ultra');
        else if (config.level >= 3) enhancements.push('Pro');
        else if (config.level >= 2) enhancements.push('Enhanced');
        else enhancements.push('Optimized');

        if (config.detail) enhancements.push('Detail Boost');
        if (config.clarity) enhancements.push('Clarity+');
        if (config.vibrance) enhancements.push('Vibrant');

        const enhancementInfo = `✅ Enhanced | ${originalWidth}×${originalHeight}\n${enhancements.join(' • ')} | ${config.quality}% Quality`;

        return {
            processedBuffer,
            enhancementInfo
        };

    } catch (error) {
        console.error('Processing error:', error);
        throw new Error('Enhancement failed');
    }
}

function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}