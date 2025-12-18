module.exports = {
  name: 'deluser',
  description: 'Remove a user from allowed list',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const phoneNumber = args[0];
    
    if (!phoneNumber) {
      await sock.sendMessage(from, { 
        text: '❌ Please provide a phone number\nUsage: .deluser 1234567890' 
      });
      return;
    }
    
    // Validate phone number
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    
    // Load current allowed users
    const fs = require('fs');
    const path = require('path');
    
    const usersFile = path.join(__dirname, '..', 'allowed_users.json');
    let allowedUsers = [];
    
    if (fs.existsSync(usersFile)) {
      allowedUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    }
    
    // Check if user exists
    const userIndex = allowedUsers.indexOf(cleanedNumber);
    if (userIndex === -1) {
      await sock.sendMessage(from, { 
        text: `❌ User ${cleanedNumber} not found in allowed list! 🙄` 
      });
      return;
    }
    
    // Remove user from allowed list
    allowedUsers.splice(userIndex, 1);
    fs.writeFileSync(usersFile, JSON.stringify(allowedUsers, null, 2));
    
    await sock.sendMessage(from, { 
      text: `🗑️ User *${cleanedNumber}* removed from allowed list! 🚮\n\nThey can no longer use commands in private mode! 😈` 
    });
  }
}