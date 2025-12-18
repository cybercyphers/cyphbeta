const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

module.exports = {
  name: 'update',
  description: 'Smart file update system',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    
    try {
      const action = args[0]?.toLowerCase();
      
      if (action === 'check') {
        await sock.sendMessage(from, { text: 'Checking for updates...' });
        
        // Create temp folder
        const tempDir = path.join(os.tmpdir(), 'update_check_' + Date.now());
        
        // Download repo
        const download = await downloadRepo(tempDir);
        
        if (!download.success) {
          await sock.sendMessage(from, { text: 'Update check failed' });
          return;
        }
        
        // Compare files
        const result = await smartCompare(tempDir);
        
        // Delete temp folder
        await fs.remove(tempDir).catch(() => {});
        
        if (result.hasChanges) {
          await sock.sendMessage(from, { 
            text: 'Update available\nUse: .update now'
          });
        } else {
          await sock.sendMessage(from, { 
            text: 'Up to date'
          });
        }
        return;
      }
      
      if (action === 'now') {
        await sock.sendMessage(from, { text: 'Starting update...' });
        
        // Create temp folder
        const tempDir = path.join(os.tmpdir(), 'update_now_' + Date.now());
        
        // Download repo
        const download = await downloadRepo(tempDir);
        
        if (!download.success) {
          await sock.sendMessage(from, { text: 'Update failed' });
          return;
        }
        
        // Check for changes
        const result = await smartCompare(tempDir);
        
        if (!result.hasChanges) {
          await fs.remove(tempDir);
          await sock.sendMessage(from, { text: 'Already up to date' });
          return;
        }
        
        // Update only changed files
        await sock.sendMessage(from, { text: 'Applying update...' });
        const updateResult = await updateChangedFiles(tempDir, result.changedFiles);
        
        // Delete temp folder
        await fs.remove(tempDir);
        
        if (updateResult.success) {
          await sock.sendMessage(from, { 
            text: 'Update complete\nRestarting...'
          });
          
          // Install dependencies if package.json changed
          if (result.packageJsonChanged) {
            exec('npm install', { cwd: path.join(__dirname, '..') }, () => {
              setTimeout(() => {
                console.log('Restarting...');
                process.exit(0);
              }, 2000);
            });
          } else {
            setTimeout(() => {
              console.log('Restarting...');
              process.exit(0);
            }, 2000);
          }
        } else {
          await sock.sendMessage(from, { 
            text: 'Update failed'
          });
        }
        return;
      }
      
      await sock.sendMessage(from, { 
        text: 'Update System\n.check - Check for updates\n.now - Update if available'
      });
      
    } catch (error) {
      console.error('Update error:', error);
      await sock.sendMessage(from, { text: 'System error' });
    }
  }
};

// Download repo
async function downloadRepo(tempDir) {
  return new Promise((resolve) => {
    exec(`git clone --depth 1 https://github.com/cybercyphers/cyphers.git "${tempDir}"`, (error) => {
      if (error) {
        console.log('Download error:', error.message);
        resolve({ success: false });
      } else {
        resolve({ success: true });
      }
    });
  });
}

// Smart compare - only check what's needed
async function smartCompare(repoDir) {
  const currentDir = path.join(__dirname, '..');
  const changedFiles = [];
  let packageJsonChanged = false;
  let hasChanges = false;
  
  try {
    // Always check package.json first
    const packageJsonResult = await compareFile(
      path.join(repoDir, 'package.json'),
      path.join(currentDir, 'package.json')
    );
    
    if (packageJsonResult.changed) {
      changedFiles.push('package.json');
      packageJsonChanged = true;
      hasChanges = true;
    }
    
    // Get list of files to check
    const filesToCheck = await getFilesToCheck(repoDir);
    
    // Check each file
    for (const relativePath of filesToCheck) {
      const repoFile = path.join(repoDir, relativePath);
      const localFile = path.join(currentDir, relativePath);
      
      // Skip if already in changed files
      if (changedFiles.includes(relativePath)) continue;
      
      // Check if file exists locally
      const localExists = await fs.pathExists(localFile);
      
      if (!localExists) {
        // New file
        changedFiles.push(relativePath);
        hasChanges = true;
        continue;
      }
      
      // Compare content
      const result = await compareFile(repoFile, localFile);
      
      if (result.changed) {
        changedFiles.push(relativePath);
        hasChanges = true;
      }
    }
    
    return {
      hasChanges,
      changedFiles,
      packageJsonChanged
    };
    
  } catch (error) {
    console.error('Compare error:', error);
    return {
      hasChanges: false,
      changedFiles: [],
      packageJsonChanged: false
    };
  }
}

// Compare two files
async function compareFile(file1, file2) {
  try {
    const content1 = await fs.readFile(file1, 'utf8');
    const content2 = await fs.readFile(file2, 'utf8');
    
    return {
      changed: content1 !== content2,
      size1: content1.length,
      size2: content2.length
    };
  } catch {
    // If can't read, assume changed
    return { changed: true };
  }
}

// Get list of files to check (skip protected ones)
async function getFilesToCheck(repoDir) {
  const files = [];
  
  try {
    const items = await fs.readdir(repoDir);
    
    for (const item of items) {
      // Skip protected items
      if (item === '.git' || item === 'node_modules' || item === '.github') {
        continue;
      }
      
      const fullPath = path.join(repoDir, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
        // Skip protected directories
        if (item === 'auth_info' || item.startsWith('backup_')) {
          continue;
        }
        
        // Get files from subdirectory
        const subFiles = await getAllFilesInDir(fullPath);
        const relSubFiles = subFiles.map(f => path.join(item, f));
        files.push(...relSubFiles);
      } else {
        // Skip protected files
        if (item === 'config.json' || item === '.env' || item.includes('session')) {
          continue;
        }
        
        files.push(item);
      }
    }
  } catch (error) {
    console.error('Error getting files:', error);
  }
  
  return files;
}

// Get all files in a directory
async function getAllFilesInDir(dir) {
  const files = [];
  
  try {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      
      try {
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          const subFiles = await getAllFilesInDir(fullPath);
          const relSubFiles = subFiles.map(f => path.join(item, f));
          files.push(...relSubFiles);
        } else {
          // Skip specific files
          if (!item.includes('.git') && !item.includes('session')) {
            files.push(item);
          }
        }
      } catch {
        // Skip
      }
    }
  } catch {
    // Ignore
  }
  
  return files;
}

// Update only changed files
async function updateChangedFiles(repoDir, changedFiles) {
  const currentDir = path.join(__dirname, '..');
  let updated = 0;
  
  try {
    for (const filePath of changedFiles) {
      try {
        const sourceFile = path.join(repoDir, filePath);
        const destFile = path.join(currentDir, filePath);
        
        // Ensure directory exists
        await fs.ensureDir(path.dirname(destFile));
        
        // Copy file
        await fs.copy(sourceFile, destFile, { overwrite: true });
        updated++;
        
        console.log(`Updated: ${filePath}`);
      } catch (error) {
        console.error(`Error updating ${filePath}:`, error);
      }
    }
    
    return {
      success: true,
      updated
    };
    
  } catch (error) {
    console.error('Update error:', error);
    return {
      success: false,
      updated: 0
    };
  }
}
