module.exports = {
  name: 'listusers',
  description: 'List all allowed users',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    
    const fs = require('fs');
    const path = require('path');
    
    const usersFile = path.join(__dirname, '..', 'allowed_users.json');
    let allowedUsers = [];
    
    if (fs.existsSync(usersFile)) {
      allowedUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    }
    
    if (allowedUsers.length === 0) {
      await sock.sendMessage(from, { 
        text: '📝 No users in allowed list! 🗒️' 
      });
      return;
    }
    
    let userList = '👥 *Allowed Users List* 👥\n\n';
    allowedUsers.forEach((user, index) => {
      userList += `${index + 1}. ${user}\n`;
    });
    
    userList += `\nTotal: ${allowedUsers.length} user(s)`;
    
    await sock.sendMessage(from, { text: userList });
  }
}