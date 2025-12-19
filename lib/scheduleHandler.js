const fs = require('fs-extra');
const path = require('path');

class ScheduleHandler {
  constructor(sock) {
    this.sock = sock;
    this.timers = new Map();
    this.SCHEDULE_FILE = path.join(__dirname, '..', 'data', 'schedules.json');
    
    // Load existing schedules on startup
    this.loadAndSchedule();
    console.log('⏰ Schedule Handler Started');
  }
  
  // Load and schedule all pending messages
  loadAndSchedule() {
    try {
      if (!fs.existsSync(this.SCHEDULE_FILE)) return;
      
      const schedules = JSON.parse(fs.readFileSync(this.SCHEDULE_FILE, 'utf8'));
      const now = Date.now();
      
      schedules.forEach(schedule => {
        if (schedule.status === 'pending' && schedule.scheduleTime > now) {
          this.scheduleMessage(schedule);
        } else if (schedule.status === 'pending' && schedule.scheduleTime <= now) {
          // Send immediately if time has passed
          this.sendScheduledMessage(schedule);
        }
      });
      
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  }
  
  // Schedule a new message
  scheduleMessage(schedule) {
    const delay = schedule.scheduleTime - Date.now();
    
    if (delay <= 0) {
      // Send immediately
      this.sendScheduledMessage(schedule);
      return;
    }
    
    console.log(`⏰ Scheduled message ${schedule.id} for ${new Date(schedule.scheduleTime).toLocaleTimeString()}`);
    
    const timer = setTimeout(() => {
      this.sendScheduledMessage(schedule);
    }, delay);
    
    this.timers.set(schedule.id, timer);
  }
  
  // Cancel a scheduled message
  cancelSchedule(id) {
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
      console.log(`⏰ Cancelled schedule ${id}`);
    }
  }
  
  // Send the scheduled message
  async sendScheduledMessage(schedule) {
    try {
      console.log(`⏰ Sending scheduled message: ${schedule.id}`);
      
      // Send the message - THIS WORKS EVEN IF USER IS OFFLINE
      await this.sock.sendMessage(schedule.targetJid, { 
        text: `⏰ Scheduled Message (${schedule.time}):\n${schedule.message}` 
      });
      
      // Mark as sent
      this.markAsSent(schedule.id);
      this.timers.delete(schedule.id);
      
    } catch (error) {
      console.error('Error sending scheduled message:', error);
      // WhatsApp will retry automatically when user comes online
    }
  }
  
  // Mark schedule as sent in file
  markAsSent(id) {
    try {
      if (!fs.existsSync(this.SCHEDULE_FILE)) return;
      
      let schedules = JSON.parse(fs.readFileSync(this.SCHEDULE_FILE, 'utf8'));
      schedules = schedules.map(schedule => {
        if (schedule.id === id) {
          return { ...schedule, status: 'sent', sentAt: Date.now() };
        }
        return schedule;
      });
      
      fs.writeFileSync(this.SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
      
    } catch (error) {
      console.error('Error marking schedule as sent:', error);
    }
  }
  
  // Clean up old sent messages (optional)
  cleanupOldSchedules(days = 7) {
    try {
      if (!fs.existsSync(this.SCHEDULE_FILE)) return;
      
      let schedules = JSON.parse(fs.readFileSync(this.SCHEDULE_FILE, 'utf8'));
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      schedules = schedules.filter(schedule => {
        if (schedule.status === 'sent' && schedule.sentAt < cutoff) {
          return false; // Remove old sent messages
        }
        return true; // Keep pending and recent sent messages
      });
      
      fs.writeFileSync(this.SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
      
    } catch (error) {
      console.error('Error cleaning up schedules:', error);
    }
  }
}

module.exports = ScheduleHandler;
