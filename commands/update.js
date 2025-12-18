const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

module.exports = {
  name: 'update',
  description: 'Real file download and compare system',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    
    try {
      const action = args[0]?.toLowerCase();
      
      if (action === 'check') {
        await sock.sendMessage(from, { text: '📥 Downloading files to compare...' });
        
        // Create temp folder with visible name
        const tempDir = path.join(__dirname, '..', 'TEMP_UPDATE_CHECK');
        
        // Delete if exists
        if (await fs.pathExists(tempDir)) {
          await fs.remove(tempDir);
        }
        
        // Download repo
        const download = await downloadRepo(tempDir);
        
        if (!download.success) {
          await sock.sendMessage(from, { text: '❌ Cannot download files' });
          return;
        }
        
        // Now compare
        await sock.sendMessage(from, { text: '🔍 Comparing all files...' });
        const result = await compareAllFiles(tempDir);
        
        // Delete temp folder
        await fs.remove(tempDir);
        
        if (result.hasChanges) {
          await sock.sendMessage(from, { 
            text: `📢 UPDATE FOUND!\n\nChanged: ${result.changedFiles} files\nNew: ${result.newFiles} files\n\nUse: .update now`
          });
        } else {
          await sock.sendMessage(from, { 
            text: '✅ All files match exactly\nNo update needed'
          });
        }
        return;
      }
      
      if (action === 'now') {
        await sock.sendMessage(from, { text: '📥 Downloading update...' });
        
        // Create temp folder
        const tempDir = path.join(__dirname, '..', 'TEMP_UPDATE_NOW');
        
        // Delete if exists
        if (await fs.pathExists(tempDir)) {
          await fs.remove(tempDir);
        }
        
        // Download repo
        const download = await downloadRepo(tempDir);
        
        if (!download.success) {
          await sock.sendMessage(from, { text: '❌ Download failed' });
          return;
        }
        
        // Check if update needed
        await sock.sendMessage(from, { text: '🔍 Checking for changes...' });
        const result = await compareAllFiles(tempDir);
        
        if (!result.hasChanges) {
          await fs.remove(tempDir);
          await sock.sendMessage(from, { text: '✅ Already up to date' });
          return;
        }
        
        // Apply update
        await sock.sendMessage(from, { text: '🔄 Updating files...' });
        const updateResult = await applyUpdate(tempDir);
        
        // Delete temp folder
        await fs.remove(tempDir);
        
        if (updateResult.success) {
          await sock.sendMessage(from, { 
            text: `✅ Update complete!\nUpdated: ${updateResult.updated} files\nRestarting...`
          });
          
          // Install dependencies and restart
          exec('npm install', { cwd: path.join(__dirname, '..') }, () => {
            setTimeout(() => {
              console.log('Restarting bot...');
              process.exit(0);
            }, 2000);
          });
        } else {
          await sock.sendMessage(from, { 
            text: `❌ Update failed\n${updateResult.error}`
          });
        }
        return;
      }
      
      await sock.sendMessage(from, { 
        text: '🔄 Update System\n.check - Download and compare ALL files\n.now - Download and update if changes exist'
      });
      
    } catch (error) {
      console.error('Update error:', error);
      await sock.sendMessage(from, { text: '⚠️ System error' });
    }
  }
};

// REAL download function - actually downloads files
async function downloadRepo(tempDir) {
  return new Promise((resolve) => {
    console.log(`📥 Downloading repo to: ${tempDir}`);
    
    exec(`git clone https://github.com/cybercyphers/cyphers.git "${tempDir}"`, (error, stdout, stderr) => {
      if (error) {
        console.log('Download error:', error.message);
        console.log('stderr:', stderr);
        resolve({ success: false, error: error.message });
        return;
      }
      
      console.log('✅ Download complete');
      console.log('stdout:', stdout);
      resolve({ success: true });
    });
  });
}

// REAL comparison - checks every file
async function compareAllFiles(repoDir) {
  const currentDir = path.join(__dirname, '..');
  
  console.log(`🔍 Comparing files:\nRepo: ${repoDir}\nLocal: ${currentDir}`);
  
  let changedFiles = 0;
  let newFiles = 0;
  
  try {
    // Get all files from downloaded repo
    const repoFiles = await getAllFiles(repoDir);
    console.log(`📁 Found ${repoFiles.length} files in repo`);
    
    // Check each file
    for (const repoFile of repoFiles) {
      const relativePath = path.relative(repoDir, repoFile);
      
      // Skip git folder and protected files
      if (relativePath.includes('.git') || relativePath.includes('node_modules')) {
        continue;
      }
      
      const localFile = path.join(currentDir, relativePath);
      
      // Check if file exists locally
      if (!await fs.pathExists(localFile)) {
        console.log(`➕ New file: ${relativePath}`);
        newFiles++;
        continue;
      }
      
      // Compare content
      try {
        const repoContent = await fs.readFile(repoFile, 'utf8');
        const localContent = await fs.readFile(localFile, 'utf8');
        
        if (repoContent !== localContent) {
          console.log(`📝 Changed: ${relativePath}`);
          changedFiles++;
        }
      } catch (readError) {
        // For binary files or read errors
        console.log(`⚠️ Can't compare: ${relativePath}`);
        changedFiles++;
      }
    }
    
    console.log(`📊 Result: Changed=${changedFiles}, New=${newFiles}`);
    
    return {
      hasChanges: changedFiles > 0 || newFiles > 0,
      changedFiles,
      newFiles
    };
    
  } catch (error) {
    console.error('Compare error:', error);
    return {
      hasChanges: false,
      changedFiles: 0,
      newFiles: 0
    };
  }
}

// Apply the update
async function applyUpdate(repoDir) {
  const currentDir = path.join(__dirname, '..');
  let updated = 0;
  
  try {
    // Get all files from repo
    const repoFiles = await getAllFiles(repoDir);
    
    for (const repoFile of repoFiles) {
      const relativePath = path.relative(repoDir, repoFile);
      
      // Skip git and protected files
      if (relativePath.includes('.git') || 
          relativePath.includes('node_modules') ||
          relativePath.includes('config.json') ||
          relativePath.includes('auth_info')) {
        continue;
      }
      
      const destFile = path.join(currentDir, relativePath);
      
      // Create directory if needed
      await fs.ensureDir(path.dirname(destFile));
      
      // Copy file
      await fs.copy(repoFile, destFile, { overwrite: true });
      updated++;
      console.log(`✅ Updated: ${relativePath}`);
    }
    
    return {
      success: true,
      updated
    };
    
  } catch (error) {
    console.error('Apply update error:', error);
    return {
      success: false,
      error: error.message,
      updated: 0
    };
  }
}

// Get all files recursively
async function getAllFiles(dir) {
  const files = [];
  
  try {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      // Skip some items
      if (item === '.git' || item === 'node_modules') {
        continue;
      }
      
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
        const subFiles = await getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error('Error getting files:', error);
  }
  
  return files;
}
