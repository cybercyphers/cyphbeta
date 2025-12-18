const axios = require('axios');

module.exports = {
  name: 'fdroid',
  description: '📱 F-DROID PACKAGE DOWNLOADER',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    
    if (!args[0]) {
      await sock.sendMessage(jid, { 
        text: '📱 *F-DROID PACKAGE DOWNLOADER*\n\n.fdroid <package-name>\n\nExamples:\n.fdroid com.termux_118\n.fdroid org.videolan.vlc_13030307\n.fdroid org.telegram.messenger_30010' 
      });
      return;
    }

    const packageName = args[0];
    await sock.sendMessage(jid, { react: { text: '📦', key: msg.key } });

    try {
      // F-Droid APK URLs require version numbers
      // Format: https://f-droid.org/repo/package_name_versioncode.apk
      
      let apkUrl = `https://f-droid.org/repo/${packageName}.apk`;
      
      console.log(`Downloading: ${apkUrl}`);

      // Download APK directly
      const response = await axios.get(apkUrl, {
        responseType: 'arraybuffer',
        timeout: 45000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Android 13; Mobile) AppleWebKit/537.36'
        },
        validateStatus: function (status) {
          return status === 200; // Only accept 200 status
        }
      });

      const buffer = Buffer.from(response.data);
      
      // Verify it's actually an APK file
      if (buffer.length < 1000 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
        throw new Error('Downloaded file is not a valid APK');
      }

      // Send APK immediately
      await sock.sendMessage(jid, {
        document: buffer,
        fileName: `${packageName}.apk`,
        mimetype: 'application/vnd.android.package-archive'
      });

      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

    } catch (error) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      
      if (error.response?.status === 404) {
        await sock.sendMessage(jid, { 
          text: `❌ Package "${packageName}" not found.\n\n💡 F-Droid packages need version numbers:\n\n📱 *WORKING EXAMPLES:*\n• .fdroid com.termux_118\n• .fdroid org.videolan.vlc_13030307\n• .fdroid org.telegram.messenger_30010\n• .fdroid org.mozilla.firefox_231351423\n\n🔍 Find packages at: https://f-droid.org/en/packages/` 
        });
      } else if (error.message.includes('not a valid APK')) {
        await sock.sendMessage(jid, { 
          text: `❌ Invalid APK file downloaded.\n\n💡 Try these exact package names:\n.fdroid com.termux_118\n.fdroid org.videolan.vlc_13030307` 
        });
      } else {
        await sock.sendMessage(jid, { 
          text: `❌ Download failed: ${error.message}` 
        });
      }
    }
  }
}
