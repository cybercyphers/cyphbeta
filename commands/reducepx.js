const sharp = require('sharp');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'reducepx',
    description: 'Reduce image size',
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
                    text: '❌ Reply to an image\n💡 Use: .reducepx <size>\n\n📐 Sizes:\n• 25% • 50% • 75%\n• min • small • medium • large\n• 800x600 • 1024 • webp • compress' 
                }, { quoted: msg });
                return;
            }

            const reduceOptions = args.map(arg => arg.toLowerCase());
            
            await sock.sendMessage(from, { 
                text: '🔄 Optimizing image size...' 
            }, { quoted: msg });

            const imageBuffer = await downloadImage(imageMessage);
            
            if (!imageBuffer) {
                await sock.sendMessage(from, { 
                    text: '❌ Download failed' 
                }, { quoted: msg });
                return;
            }

            const { processedBuffer, reductionInfo } = await reduceImageSize(imageBuffer, reduceOptions);
            
            if (!processedBuffer) {
                await sock.sendMessage(from, { 
                    text: '❌ Processing failed' 
                }, { quoted: msg });
                return;
            }

            await sock.sendMessage(from, { 
                image: processedBuffer,
                caption: reductionInfo
            }, { quoted: msg });

            console.log(`✅ Reduced: ${reduceOptions.join(' ')}`);

        } catch (error) {
            console.error('Reduce error:', error);
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

async function reduceImageSize(buffer, reduceOptions) {
    try {
        let sharpInstance = sharp(buffer);
        const metadata = await sharpInstance.metadata();
        const originalSize = buffer.length;
        const originalWidth = metadata.width;
        const originalHeight = metadata.height;

        let targetWidth, targetHeight, quality = 80;
        let format = 'jpeg';
        let advancedCompress = false;
        let optimizeMode = 'balanced';

        for (const option of reduceOptions) {
            if (option.includes('%')) {
                const percent = parseInt(option);
                if (percent > 0 && percent <= 100) {
                    const scale = percent / 100;
                    targetWidth = Math.round(originalWidth * scale);
                    targetHeight = Math.round(originalHeight * scale);
                    quality = Math.max(30, 50 + (percent * 0.3));
                    if (percent <= 25) optimizeMode = 'aggressive';
                }
            }
            else if (option.includes('x')) {
                const [width, height] = option.split('x').map(Number);
                if (width && height) {
                    targetWidth = Math.min(width, originalWidth);
                    targetHeight = Math.min(height, originalHeight);
                }
            }
            else if (!isNaN(option)) {
                targetWidth = Math.min(parseInt(option), originalWidth);
            }
            else if (option === 'min') {
                targetWidth = Math.max(320, Math.round(originalWidth * 0.1));
                targetHeight = Math.round(originalHeight * 0.1);
                quality = 35;
                advancedCompress = true;
                optimizeMode = 'minimum';
            }
            else if (option === 'small') {
                targetWidth = Math.round(originalWidth * 0.25);
                targetHeight = Math.round(originalHeight * 0.25);
                quality = 50;
                optimizeMode = 'small';
            }
            else if (option === 'medium') {
                targetWidth = Math.round(originalWidth * 0.5);
                targetHeight = Math.round(originalHeight * 0.5);
                quality = 70;
            }
            else if (option === 'large') {
                targetWidth = Math.round(originalWidth * 0.75);
                targetHeight = Math.round(originalHeight * 0.75);
                quality = 80;
            }
            else if (option === 'compress') {
                advancedCompress = true;
                quality = Math.max(20, quality - 15);
                optimizeMode = 'compressed';
            }
            else if (option === 'webp') {
                format = 'webp';
            }
        }

        if (!targetWidth && !targetHeight) {
            targetWidth = Math.round(originalWidth * 0.5);
            targetHeight = Math.round(originalHeight * 0.5);
        }

        targetWidth = Math.max(200, targetWidth);
        targetHeight = Math.max(200, targetHeight);

        sharpInstance = sharpInstance.resize(targetWidth, targetHeight, {
            fit: 'inside',
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos3
        });

        if (advancedCompress) {
            sharpInstance = sharpInstance.withMetadata({
                exif: {},
                iptc: {},
                xmp: {},
                tifftagPhotoshop: {}
            });
        }

        let outputBuffer;
        if (format === 'webp') {
            outputBuffer = await sharpInstance
                .webp({ 
                    quality: quality,
                    lossless: false,
                    nearLossless: true,
                    smartSubsample: true,
                    effort: 6
                })
                .toBuffer();
        } else {
            const jpegOptions = {
                quality: quality,
                mozjpeg: true,
                optimiseScans: true,
                trellisQuantisation: advancedCompress,
                overshootDeringing: advancedCompress
            };
            
            if (advancedCompress) {
                jpegOptions.chromaSubsampling = '4:2:0';
            }
            
            outputBuffer = await sharpInstance
                .jpeg(jpegOptions)
                .toBuffer();
        }

        const finalSize = outputBuffer.length;
        const sizeReduction = Math.round(((originalSize - finalSize) / originalSize) * 100);
        const pixelReduction = Math.round(((originalWidth * originalHeight - targetWidth * targetHeight) / (originalWidth * originalHeight)) * 100);

        const reductionInfo = `✅ Reduced | ${targetWidth}×${targetHeight}\n${sizeReduction}% Smaller | ${pixelReduction}% Pixels | ${optimizeMode}`;

        return {
            processedBuffer: outputBuffer,
            reductionInfo
        };

    } catch (error) {
        console.error('Reduction error:', error);
        throw new Error('Reduction failed');
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