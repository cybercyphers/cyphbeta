const os = require('os');

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${secs}s`;
}

function getRAMUsage() {
  const totalRAM = os.totalmem() / (1024 * 1024 * 1024);
  const freeRAM = os.freemem() / (1024 * 1024 * 1024);
  const usedRAM = totalRAM - freeRAM;
  const usagePercent = ((usedRAM / totalRAM) * 100).toFixed(1);
  return `${usedRAM.toFixed(1)}/${totalRAM.toFixed(1)}GB (${usagePercent}%)`;
}

function getProcessMemory() {
  const usage = process.memoryUsage();
  return (usage.rss / (1024 * 1024)).toFixed(2) + ' MB';
}

async function getBotStats(sock, msg) {
  // Get current time and date
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });
  const date = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  
  // Bot statistics
  const botVersion = '2.0.0';
  const pluginsCount = '15';
  const ramUsage = getRAMUsage();
  const platform = os.platform();
  const uptime = formatUptime(process.uptime());
  const nodeVersion = process.version;
  const processMemory = getProcessMemory();
  const cpuCores = os.cpus().length;
  const cpuModel = os.cpus()[0].model;

  let menuText = `╭───「 🔮 CYPHER STATS 」───⊷
│ ┌──────────────
│ │ 👤 User : ${msg.pushName || 'User'}
│ │ 🕐 Time : ${time}
│ │ 📅 Date : ${date}
│ │ 📍 Day : ${day}
│ ├──────────────
│ │ 🔧 Version : ${botVersion}
│ │ 📦 Plugins : ${pluginsCount}
│ │ 🖥️ Platform : ${platform}
│ │ ⚡ Node.js : ${nodeVersion}
│ ├──────────────
│ │ 💾 RAM Usage : ${ramUsage}
│ │ 🧠 Process : ${processMemory}
│ │ 🔄 Uptime : ${uptime}
│ │ 🎯 CPU : ${cpuCores} cores | ${cpuModel}
│ └──────────────
╰────────────────────────────⊷\n\n`

  // User Management Commands
  menuText += '╭─「 👥 USER MANAGEMENT 」\n'
  menuText += '│ .listuser - List all allowed users\n'
  menuText += '│ .adduser <number> - Add user to whitelist\n'
  menuText += '│ .deluser <number> - Remove user from whitelist\n'
  menuText += '╰─────────────────────\n\n'
  
  // Security/Encryption Commands
  menuText += '╭─「 🔐 SECURITY & ENCRYPTION 」\n'
  menuText += '│ .cyph <reply> - Decrypt viewonce/media\n'
  menuText += '│ .cyph2 <reply> - Decrypt viewonce media only\n'
  menuText += '│ .profile <reply> - Get user profile picture\n'
  menuText += '╰─────────────────────\n\n'
  
  // F-Droid Commands
  menuText += '╭─「 📱 F-DROID & TOOLS 」\n'
  menuText += '│ .fdroid - F-Droid resources\n'
  menuText += '│ .clone <url> - Clone repository\n'
  menuText += '│ .github - GitHub information\n'
  menuText += '│ .news - Latest news\n'
  menuText += '│ .audio <yt-link> - Download audio\n'
  menuText += '│ .nmap <domain> - Network scanning\n'
  menuText += '╰─────────────────────\n\n'
  
  // Media Processing Commands
  menuText += '╭─「 🎨 MEDIA PROCESSING 」\n'
  menuText += '│ .3d - 3D media effects\n'
  menuText += '│ .increasepx <reply image> - Enhance resolution\n'
  menuText += '│ .reducepx <reply image> - Reduce resolution\n'
  menuText += '│ .vidhp <reply video> - Enhance video quality\n'
  menuText += '╰─────────────────────\n\n'
  
  // AI Commands
  menuText += '╭─「 🤖 AI COMMANDS 」\n'
  menuText += '│ .deepseek <message> - Chat with DeepSeek AI\n'
  menuText += '╰─────────────────────\n\n'
  
  // Religion Commands
  menuText += '╭─「 ✝️ RELIGION 」\n'
  menuText += '│ .bible <verse> - Get Bible verses\n'
  menuText += '╰─────────────────────\n\n'
  
  // System & Utility Commands
  menuText += '╭─「 ⚙️ SYSTEM & UTILITY 」\n'
  menuText += '│ .mode - Change bot mode\n'
  menuText += '│ .ping - Check bot response time\n'
  menuText += '│ .ngl <message> - Send anonymous message to creator\n'
  menuText += '│ .menu - Show this menu\n'
  menuText += '| .autotyping on/off \n'
  menuText += '| .online on/off  - receive announced message \n'
  menuText += '│ .help - Get help\n'
  menuText += '╰─────────────────────\n\n'
  
  // Usage Tips
  menuText += '╭─「 💡 USAGE TIPS 」\n'
  menuText += '│ • Prefix: . (dot)\n'
  menuText += '│ • Reply to messages for media commands\n'
  menuText += '│ • Use .help <command> for detailed help\n'
  menuText += '╰─────────────────────\n\n'
  
  menuText += '👑 Global Owner: Am All\n'
  menuText += '📝 Use .help <command> for detailed information DO NOT CLONE ⛔️'

  return menuText;
}

module.exports = {
  getBotStats,
  formatUptime,
  getRAMUsage,
  getProcessMemory
};
