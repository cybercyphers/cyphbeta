module.exports = {
  name: 'help',
  description: 'Get help with bot usage',
  async execute(sock, msg, args) {
    const helpText = `
🤖 *BOT HELP* 🤖

*How to use:*
• Start any command with . (dot)
• Example: .ping

*Available Commands:*
• .ping - Test bot response
• .menu - Show all commands
• .help - Get this help
• .reload - Reload commands

*Need Assistance?*
Contact the bot owner for support.
`
    await sock.sendMessage(msg.key.remoteJid, { text: helpText })
  }
}