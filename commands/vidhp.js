const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
  name: 'vidhp',
  description: 'Enhance video quality with smart capacity checking',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    
    try {
      // Check if it's a reply to a video
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      
      let videoMessage = null;
      
      if (quotedMsg?.videoMessage) {
        videoMessage = quotedMsg.videoMessage;
      } else if (msg.message?.videoMessage) {
        videoMessage = msg.message.videoMessage;
      }

      if (!videoMessage) {
        await sock.sendMessage(from, { 
          text: '🎬 *VIDEO ENHANCER BOT*\n\nReply to a video with:\n• .vidhp 720\n• .vidhp 1080\n• .vidhp 2k\n• .vidhp 4k\n\n💡 I\'ll check server capacity first!' 
        }, { quoted: msg });
        return;
      }

      const quality = args[0]?.toLowerCase() || '1080';
      
      // All qualities including 4K
      const allowedQualities = ['480', '720', '1080', '2k', '4k', 'hd', 'ultra'];
      if (!allowedQualities.includes(quality)) {
        await sock.sendMessage(from, { 
          text: '❌ Invalid quality. Use: 480, 720, 1080, 2k, 4k, hd, ultra' 
        }, { quoted: msg });
        return;
      }

      // Check video size (generous limit)
      const videoSize = videoMessage.fileLength;
      if (videoSize > 25 * 1024 * 1024) {
        await sock.sendMessage(from, { 
          text: '❌ Video is too large for enhancement (max 25MB)' 
        }, { quoted: msg });
        return;
      }

      // Check server capacity before processing
      const capacityCheck = await checkServerCapacity(quality);
      
      if (!capacityCheck.canProcess) {
        await sock.sendMessage(from, { 
          text: `⚠️ *SERVER CAPACITY WARNING*\n\nRequested: ${quality.toUpperCase()}\nStatus: ${capacityCheck.reason}\n\n💡 *Suggested Quality:* ${capacityCheck.suggestedQuality}\n\nTry: .vidhp ${capacityCheck.suggestedQuality}` 
        }, { quoted: msg });
        return;
      }

      // Show processing message with capacity info
      await sock.sendMessage(from, { 
        text: `🔄 *ENHANCING TO ${quality.toUpperCase()}*\n\n✅ Server Capacity: ${capacityCheck.capacityLevel}\n⏳ Estimated time: ${capacityCheck.estimatedTime}\n📊 Available RAM: ${capacityCheck.freeRAM}MB\n\n*Processing...*` 
      }, { quoted: msg });

      // Download and process video
      const videoBuffer = await downloadVideo(videoMessage);
      const tempDir = path.join(os.tmpdir(), 'vidhp');
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const inputPath = path.join(tempDir, `input_${Date.now()}.mp4`);
      const outputPath = path.join(tempDir, `enhanced_${Date.now()}.mp4`);

      // Save input video
      fs.writeFileSync(inputPath, videoBuffer);

      // Process video with capacity-aware settings
      const result = await enhanceVideoWithCapacity(inputPath, outputPath, quality, capacityCheck);
      
      if (result.success) {
        const enhancedBuffer = fs.readFileSync(outputPath);
        
        await sock.sendMessage(from, { 
          video: enhancedBuffer,
          caption: `✅ *ENHANCED TO ${quality.toUpperCase()}*\n\n📊 Quality: ${result.actualQuality}\n⚡ Bitrate: ${result.bitrate}\n🎨 Codec: ${result.codec}\n\nPowered by Smart Capacity System 🚀`
        }, { quoted: msg });

        console.log(`✅ Video enhanced to ${quality} - ${result.actualQuality}`);

      } else {
        throw new Error(result.error || 'Processing failed');
      }

      // Cleanup
      cleanupFiles([inputPath, outputPath]);

    } catch (error) {
      console.error('Video enhancement error:', error);
      await sock.sendMessage(from, { 
        text: `❌ *PROCESSING FAILED*\n\nError: ${error.message}\n\n💡 Try a lower quality like: .vidhp 720` 
      }, { quoted: msg });
    }
  }
};

// Check server capacity intelligently
async function checkServerCapacity(requestedQuality) {
  const freeMemory = os.freemem() / 1024 / 1024; // MB
  const totalMemory = os.totalmem() / 1024 / 1024; // MB
  const loadAverage = os.loadavg()[0];
  const cpus = os.cpus().length;

  // Capacity thresholds
  const capacityLevels = {
    low: { minRAM: 512, maxLoad: 2.0 },
    medium: { minRAM: 1024, maxLoad: 1.5 },
    high: { minRAM: 2048, maxLoad: 1.0 },
    ultra: { minRAM: 4096, maxLoad: 0.8 }
  };

  // Determine current capacity level
  let currentLevel = 'low';
  if (freeMemory >= capacityLevels.ultra.minRAM && loadAverage <= capacityLevels.ultra.maxLoad) {
    currentLevel = 'ultra';
  } else if (freeMemory >= capacityLevels.high.minRAM && loadAverage <= capacityLevels.high.maxLoad) {
    currentLevel = 'high';
  } else if (freeMemory >= capacityLevels.medium.minRAM && loadAverage <= capacityLevels.medium.maxLoad) {
    currentLevel = 'medium';
  }

  // Quality requirements
  const qualityRequirements = {
    '480': { level: 'low', ram: 512, time: '30s' },
    '720': { level: 'low', ram: 768, time: '45s' },
    '1080': { level: 'medium', ram: 1024, time: '1m' },
    'hd': { level: 'medium', ram: 1024, time: '1m' },
    '2k': { level: 'high', ram: 2048, time: '2m' },
    '4k': { level: 'ultra', ram: 4096, time: '3m' },
    'ultra': { level: 'ultra', ram: 4096, time: '3m' }
  };

  const req = qualityRequirements[requestedQuality];
  const canProcess = capacityLevels[currentLevel].minRAM >= capacityLevels[req.level].minRAM;

  // Find suggested quality
  let suggestedQuality = '720';
  if (currentLevel === 'ultra') suggestedQuality = '4k';
  else if (currentLevel === 'high') suggestedQuality = '2k';
  else if (currentLevel === 'medium') suggestedQuality = '1080';

  return {
    canProcess,
    capacityLevel: currentLevel.toUpperCase(),
    freeRAM: Math.round(freeMemory),
    totalRAM: Math.round(totalMemory),
    loadAverage: loadAverage.toFixed(2),
    estimatedTime: req.time,
    reason: !canProcess ? `Requires ${req.level} level, currently ${currentLevel}` : 'Good to go',
    suggestedQuality,
    settings: req
  };
}

// Enhanced video processing with capacity awareness
async function enhanceVideoWithCapacity(inputPath, outputPath, quality, capacity) {
  return new Promise((resolve, reject) => {
    try {
      // Get video info first
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        if (!videoStream) return reject(new Error("No video stream found"));

        const originalWidth = videoStream.width;
        const originalHeight = videoStream.height;

        // Determine target resolution based on quality and capacity
        let targetWidth, targetHeight, bitrate, crf, preset;
        
        switch (quality) {
          case '4k':
          case 'ultra':
            targetWidth = 3840;
            targetHeight = 2160;
            bitrate = capacity.capacityLevel === 'ULTRA' ? '12000k' : '8000k';
            crf = 20;
            preset = capacity.capacityLevel === 'ULTRA' ? 'medium' : 'fast';
            break;
          case '2k':
            targetWidth = 2560;
            targetHeight = 1440;
            bitrate = '6000k';
            crf = 20;
            preset = 'fast';
            break;
          case '1080':
          case 'hd':
            targetWidth = 1920;
            targetHeight = 1080;
            bitrate = '4000k';
            crf = 21;
            preset = 'fast';
            break;
          case '720':
            targetWidth = 1280;
            targetHeight = 720;
            bitrate = '2500k';
            crf = 22;
            preset = 'veryfast';
            break;
          case '480':
            targetWidth = 854;
            targetHeight = 480;
            bitrate = '1500k';
            crf = 23;
            preset = 'veryfast';
            break;
          default:
            targetWidth = 1920;
            targetHeight = 1080;
            bitrate = '4000k';
            crf = 21;
            preset = 'fast';
        }

        // Adjust based on server capacity
        if (capacity.capacityLevel === 'LOW') {
          bitrate = Math.round(parseInt(bitrate) * 0.7) + 'k';
          crf += 2;
        }

        // Maintain aspect ratio
        let finalWidth = targetWidth;
        let finalHeight = targetHeight;
        const aspectRatio = originalWidth / originalHeight;
        
        if (targetWidth / targetHeight > aspectRatio) {
          finalWidth = Math.round(targetHeight * aspectRatio);
        } else {
          finalHeight = Math.round(targetWidth / aspectRatio);
        }

        // Ensure even dimensions
        finalWidth = finalWidth % 2 === 0 ? finalWidth : finalWidth - 1;
        finalHeight = finalHeight % 2 === 0 ? finalHeight : finalHeight - 1;

        const command = ffmpeg(inputPath)
          .output(outputPath)
          .videoCodec('libx264')
          .size(`${finalWidth}x${finalHeight}`)
          .videoBitrate(bitrate)
          .outputOptions([
            `-crf ${crf}`,
            `-preset ${preset}`,
            '-pix_fmt yuv420p',
            '-profile:v high',
            '-level 4.1',
            '-c:a aac',
            '-b:a 192k',
            '-ac 2',
            '-movflags +faststart',
            `-maxrate ${bitrate}`,
            `-bufsize ${bitrate}`,
            '-g 60',
            '-threads 2' // Limit threads for stability
          ]);

        command
          .on('start', (cmdLine) => {
            console.log('FFmpeg started:', cmdLine);
          })
          .on('progress', (progress) => {
            console.log(`Processing: ${progress.percent}%`);
          })
          .on('end', () => {
            resolve({
              success: true,
              actualQuality: `${finalWidth}x${finalHeight}`,
              bitrate: bitrate,
              codec: 'H.264',
              preset: preset
            });
          })
          .on('error', (err) => {
            reject(err);
          })
          .run();

      });
    } catch (error) {
      reject(error);
    }
  });
}

// Download video from message
async function downloadVideo(videoMessage) {
  try {
    const stream = await downloadContentFromMessage(videoMessage, 'video');
    const buffer = await streamToBuffer(stream);
    return buffer;
  } catch (error) {
    throw new Error('Failed to download video');
  }
}

// Convert stream to buffer
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// Cleanup temporary files
function cleanupFiles(files) {
  files.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (err) {
        console.log('Cleanup error:', err.message);
      }
    }
  });
}