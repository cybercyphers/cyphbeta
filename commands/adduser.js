module.exports = {
  name: 'adduser',
  description: 'Add a user to allowed list (private mode only)',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const phoneNumber = args[0];
    
    if (!phoneNumber) {
      await sock.sendMessage(from, { 
        text: '❌ Please provide a phone number\nUsage: .adduser 1234567890' 
      });
      return;
    }
    
    // Validate phone number
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    if (cleanedNumber.length < 10 || cleanedNumber.length > 15) {
      await sock.sendMessage(from, { 
        text: '❌ Invalid phone number format!\nExample: .adduser 233539738956' 
      });
      return;
    }
    
    // Load current allowed users
    const fs = require('fs');
    const path = require('path');
    
    const usersFile = path.join(__dirname, '..', 'allowed_users.json');
    let allowedUsers = [];
    
    if (fs.existsSync(usersFile)) {
      allowedUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    }
    
    // Check if user already exists
    if (allowedUsers.includes(cleanedNumber)) {
      await sock.sendMessage(from, { 
        text: `❌ User ${cleanedNumber} is already in the allowed list! 🤡` 
      });
      return;
    }
    
    // Add user to allowed list
    allowedUsers.push(cleanedNumber);
    fs.writeFileSync(usersFile, JSON.stringify(allowedUsers, null, 2));
    
    await sock.sendMessage(from, { 
      text: `✅ User *${cleanedNumber}* added to allowed list! 🎉\n\nThey can now use commands in private mode! ✨` 
    });
  }
}