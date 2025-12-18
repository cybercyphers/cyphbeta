const moment = require('moment-timezone');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'github',
  description: '🔗 GET MY GITHUB REPOSITORY INFO',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    
    await sock.sendMessage(jid, { react: { text: '🔗', key: msg.key } });
    const statusMsg = await sock.sendMessage(jid, { text: '📡 Fetching repository info...' });

    try {
        await sock.sendMessage(jid, { 
            text: '🌐 Connecting to GitHub...',
            edit: statusMsg.key
        });

        // Fetch your repo data
        const res = await fetch('https://api.github.com/repos/cybercyphers/Cyphers');
        if (!res.ok) throw new Error('Failed to fetch repository data');
        const repo = await res.json();

        await sock.sendMessage(jid, { 
            text: '📊 Formatting repository details...',
            edit: statusMsg.key
        });

        // Format caption in styled output
        let txt = `*🚀 CYPHERS BOT REPOSITORY*\n\n`;
        txt += `🔗 *URL:* ${repo.html_url}\n`;
        txt += `📝 *Description:* ${repo.description || "_No description provided_"}\n`;
        txt += `🌟 *Stars:* ${repo.stargazers_count}\n`;
        txt += `🔀 *Forks:* ${repo.forks_count}\n`;
        txt += `👀 *Watchers:* ${repo.watchers_count}\n`;
        txt += `📦 *Size:* ${(repo.size / 1024).toFixed(2)} MB\n`;
        txt += `📅 *Created:* ${moment(repo.created_at).format('DD/MM/YY')}\n`;
        txt += `🔄 *Last Updated:* ${moment(repo.updated_at).format('DD/MM/YY - HH:mm:ss')}\n\n`;
        txt += `👨‍💻 *Developer:* ${repo.owner.login}\n`;
        txt += `📄 *License:* ${repo.license?.name || "No license"}\n\n`;
        txt += `💡 *Tip:* Star ⭐ the repo if you like it!\n`;
        txt += `🔧 Feel free to fork and contribute!`;

        // Try to send with image, fallback to text if image not found
        try {
            const imgPath = path.join(__dirname, '../media/riam.jpg');
            const imgBuffer = fs.readFileSync(imgPath);
            
            await sock.sendMessage(jid, { 
                image: imgBuffer, 
                caption: txt 
            });
        } catch (imgError) {
            // If image not found, send as text message
            await sock.sendMessage(jid, { 
                text: txt 
            });
        }

        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        console.error('GitHub Command Error:', error.message);
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        
        if (error.message.includes('Failed to fetch')) {
            await sock.sendMessage(jid, { 
                text: '❌ Could not connect to GitHub. Please check your internet connection.' 
            });
        } else if (error.message.includes('Not Found')) {
            await sock.sendMessage(jid, { 
                text: '❌ Repository not found. The repo may have been moved or deleted.' 
            });
        } else {
            await sock.sendMessage(jid, { 
                text: `❌ Error fetching repository: ${error.message}` 
            });
        }
    }
  }
}