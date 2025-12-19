module.exports = {
  name: 'schedule',
  description: 'Schedule messages to send automatically',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    
    try {
      const action = args[0]?.toLowerCase();
      
      if (action === 'set') {
        // Format: .schedule set HH:MM:SS "message"
        if (args.length < 3) {
          await sock.sendMessage(from, { 
            text: '❌ Wrong format\nUse: .schedule set HH:MM:SS "Your message here"\nExample: .schedule set 14:30:00 "Meeting time!"' 
          });
          return;
        }
        
        const timeStr = args[1];
        const message = args.slice(2).join(' ').replace(/["']/g, '');
        
        // Validate time format
        if (!isValidTime(timeStr)) {
          await sock.sendMessage(from, { 
            text: '❌ Invalid time format\nUse HH:MM:SS (24-hour format)\nExample: 14:30:00 or 09:15:30' 
          });
          return;
        }
        
        // Calculate delay
        const delay = calculateDelay(timeStr);
        
        if (delay < 0) {
          await sock.sendMessage(from, { 
            text: '❌ That time has already passed for today\nSchedule for tomorrow or later time' 
          });
          return;
        }
        
        // Create schedule
        const scheduleId = Date.now().toString();
        const scheduledMessage = {
          id: scheduleId,
          time: timeStr,
          message: message,
          targetJid: from,
          scheduleTime: Date.now() + delay,
          status: 'pending'
        };
        
        // Save to storage
        saveSchedule(scheduledMessage);
        
        // Start the timer
        global.scheduleHandler.scheduleMessage(scheduledMessage);
        
        await sock.sendMessage(from, { 
          text: `✅ Message scheduled!\n\n📅 Time: ${timeStr}\n💬 Message: ${message}\n\nID: ${scheduleId}` 
        });
        return;
      }
      
      if (action === 'list') {
        const schedules = getSchedulesForJid(from);
        
        if (schedules.length === 0) {
          await sock.sendMessage(from, { 
            text: '📭 No scheduled messages' 
          });
          return;
        }
        
        let response = '📅 Your Scheduled Messages:\n\n';
        schedules.forEach((sched, index) => {
          response += `${index + 1}. ${sched.time} - "${sched.message}"\n   ID: ${sched.id}\n\n`;
        });
        
        await sock.sendMessage(from, { text: response });
        return;
      }
      
      if (action === 'delete') {
        if (!args[1]) {
          await sock.sendMessage(from, { 
            text: '❌ Need schedule ID\nUse: .schedule delete [ID]\nCheck IDs with: .schedule list' 
          });
          return;
        }
        
        const scheduleId = args[1];
        const deleted = deleteSchedule(scheduleId, from);
        
        if (deleted) {
          await sock.sendMessage(from, { 
            text: `✅ Schedule ${scheduleId} deleted` 
          });
        } else {
          await sock.sendMessage(from, { 
            text: `❌ Schedule not found or not yours` 
          });
        }
        return;
      }
      
      // Help message
      await sock.sendMessage(from, { 
        text: '⏰ Schedule System\n\n.set HH:MM:SS "message" - Schedule message\n.list - View your schedules\n.delete [ID] - Delete schedule\n\nExample: .schedule set 14:30:00 "Meeting time!"' 
      });
      
    } catch (error) {
      console.error('Schedule error:', error);
      await sock.sendMessage(from, { 
        text: '❌ Schedule error' 
      });
    }
  }
};

// Helper functions
function isValidTime(timeStr) {
  const regex = /^([01]?[0-9]|2[0-3]):([0-5]?[0-9]):([0-5]?[0-9])$/;
  return regex.test(timeStr);
}

function calculateDelay(timeStr) {
  const now = new Date();
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);
  
  const targetTime = new Date();
  targetTime.setHours(hours, minutes, seconds, 0);
  
  // If target time is earlier today, schedule for tomorrow
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  return targetTime.getTime() - now.getTime();
}

// Storage functions
const SCHEDULE_FILE = path.join(__dirname, '..', 'data', 'schedules.json');

function saveSchedule(schedule) {
  let schedules = [];
  
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      schedules = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    }
  } catch {
    schedules = [];
  }
  
  schedules.push(schedule);
  fs.ensureDirSync(path.dirname(SCHEDULE_FILE));
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
}

function getSchedulesForJid(jid) {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) return [];
    const schedules = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    return schedules.filter(s => s.targetJid === jid && s.status === 'pending');
  } catch {
    return [];
  }
}

function deleteSchedule(id, jid) {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) return false;
    let schedules = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    
    const originalLength = schedules.length;
    schedules = schedules.filter(s => !(s.id === id && s.targetJid === jid));
    
    if (schedules.length < originalLength) {
      fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
      // Also cancel the timer
      if (global.scheduleHandler) {
        global.scheduleHandler.cancelSchedule(id);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Add path module at top
const path = require('path');
