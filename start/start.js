const path = require('path');
const fs = require('fs');

console.log('🚀 Starting WhatsApp Bot...');
console.log('=========================');

// Check if config exists
const configPath = path.join(__dirname, '..', 'config.json');
if (!fs.existsSync(configPath)) {
    console.log('❌ config.json not found!');
    console.log('Creating default config.json...');
    
    const defaultConfig = {
        "phone_number": "233539738956",
        "mode": "public"
    };
    
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('✅ Created config.json');
    console.log('💡 Please edit config.json with your phone number and restart');
    process.exit(0);
}

// Load config
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Validate config
if (!config.phone_number) {
    console.log('❌ Invalid config.json!');
    console.log('Please check phone_number field');
    process.exit(1);
}

console.log('✅ Config loaded successfully');
console.log(`📱 Phone: ${config.phone_number}`);
console.log(`🔧 Mode: ${config.mode}`);

// Start the main bot
try {
    const cyberPath = path.join(__dirname, '..', 'cyber', 'cyphers.js');
    if (!fs.existsSync(cyberPath)) {
        console.log('❌ cyphers.js not found in cyber folder!');
        process.exit(1);
    }
    
    console.log('🔗 Launching main bot...');
    require(cyberPath);
} catch (error) {
    console.log('❌ Failed to start main bot:', error.message);
    process.exit(1);
}
