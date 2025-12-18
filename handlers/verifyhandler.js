const fs = require('fs').promises;
const path = require('path');
const AdvancedSecurityScanner = require('../lib/scanner');

module.exports = {
    name: 'verifyHandler',
    description: 'Handle file verification automatically',
    
    async execute(sock, msg, config) {
        try {
            const from = msg.key.remoteJid;
            const userJid = msg.key.participant || from;
            const isGroup = from.endsWith('@g.us');
            
            // Extract file from message
            const fileData = await this.extractFileData(sock, msg);
            if (!fileData) return;
            
            const { buffer, fileName, fileInfo } = fileData;
            
            // Send initial processing message
            const processingMsg = await sock.sendMessage(from, {
                text: `🛡️ *REAL-TIME ADVANCED SECURITY SCAN*\n\n` +
                      `🔍 Downloading and analyzing file...\n` +
                      `📁 ${fileName}\n` +
                      `📊 ${this.formatBytes(buffer.length)}\n\n` +
                      `⚡ Scanning with ${config.scanEngines.length} engines...`
            });
            
            // Initialize advanced scanner
            const scanner = new AdvancedSecurityScanner(config);
            
            // Perform deep analysis
            const scanResults = await scanner.scanFile(buffer, fileName, msg);
            
            // Generate comprehensive report
            const report = this.generateComprehensiveReport(scanResults, fileName, buffer.length);
            
            // Send to user's personal chat (always)
            await sock.sendMessage(userJid, { text: report });
            
            // Send summary to group/chat
            const summary = this.generateSummary(scanResults, fileName, isGroup);
            await sock.sendMessage(from, { text: summary });
            
            // Delete processing message
            try {
                await sock.sendMessage(from, { delete: processingMsg.key });
            } catch (e) {
                // Ignore delete errors
            }
            
            // Log scan (silent mode check)
            if (!config.silentMode) {
                console.log(`[SCAN] ${fileName} - ${scanResults.finalRiskLevel} - ${scanResults.heuristicScore}%`);
            }
            
        } catch (error) {
            console.error('Verify handler error:', error);
            // Silent error - don't notify user of failures
        }
    },
    
    async extractFileData(sock, msg) {
        try {
            const message = msg.message;
            
            // Determine message type and download
            let downloadFunction;
            let fileName = 'unknown';
            
            if (message.documentMessage) {
                downloadFunction = sock.downloadAndSaveMediaMessage;
                fileName = message.documentMessage.fileName || `document_${Date.now()}`;
            } else if (message.imageMessage) {
                downloadFunction = sock.downloadAndSaveMediaMessage;
                fileName = `image_${Date.now()}.jpg`;
            } else if (message.videoMessage) {
                downloadFunction = sock.downloadAndSaveMediaMessage;
                fileName = `video_${Date.now()}.mp4`;
            } else if (message.audioMessage) {
                downloadFunction = sock.downloadAndSaveMediaMessage;
                fileName = `audio_${Date.now()}.opus`;
            } else if (message.stickerMessage) {
                downloadFunction = sock.downloadAndSaveMediaMessage;
                fileName = `sticker_${Date.now()}.webp`;
            } else {
                return null;
            }
            
            // Download the file
            const buffer = await downloadFunction.bind(sock)(msg, 'buffer');
            if (!buffer || buffer.length === 0) {
                return null;
            }
            
            return {
                buffer: buffer,
                fileName: fileName,
                fileInfo: message
            };
            
        } catch (error) {
            console.error('File extraction error:', error);
            return null;
        }
    },
    
    generateComprehensiveReport(results, fileName, fileSize) {
        const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        const riskEmoji = results.isDangerous ? '🔴' : 
                         results.finalRiskLevel === 'HIGH' ? '🟠' :
                         results.finalRiskLevel === 'MEDIUM' ? '🟡' : 
                         results.finalRiskLevel === 'LOW' ? '🟢' : '✅';
        
        let report = `${riskEmoji} *REAL ADVANCED SECURITY ANALYSIS REPORT*\n`;
        report += `═`.repeat(50) + `\n\n`;
        
        // Executive Summary
        report += `📋 *EXECUTIVE SUMMARY*\n`;
        report += `├─ File: ${fileName}\n`;
        report += `├─ Size: ${sizeMB} MB\n`;
        report += `├─ Risk Level: ${results.finalRiskLevel}\n`;
        report += `├─ Heuristic Score: ${results.heuristicScore.toFixed(1)}%\n`;
        report += `├─ Analysis Time: ${results.scanTime}ms\n`;
        report += `└─ Verdict: ${results.isDangerous ? '🚫 DANGEROUS' : '⚠️ SUSPICIOUS'}\n\n`;
        
        // Critical Findings
        if (results.criticalThreats.length > 0) {
            report += `🔴 *CRITICAL THREATS DETECTED*\n`;
            results.criticalThreats.slice(0, 3).forEach((threat, i) => {
                report += `${i+1}. ${threat.type}\n`;
                report += `   📝 ${threat.description}\n`;
                report += `   ⚠️ Risk: ${threat.risk}\n\n`;
            });
        }
        
        // High Severity Findings
        if (results.highThreats.length > 0) {
            report += `🟠 *HIGH RISK FINDINGS*\n`;
            results.highThreats.slice(0, 3).forEach((threat, i) => {
                report += `${i+1}. ${threat.type}\n`;
                report += `   📝 ${threat.description}\n`;
                report += `   ⚠️ ${threat.risk}\n\n`;
            });
        }
        
        // File Analysis Details
        report += `📊 *FILE ANALYSIS DETAILS*\n`;
        report += `├─ Entropy: ${results.fileMetadata.entropy?.toFixed(2) || 'N/A'}/8\n`;
        report += `├─ MIME Type: ${results.fileMetadata.detectedMime || 'Unknown'}\n`;
        report += `├─ Extension: ${results.fileMetadata.fileExtension || 'None'}\n`;
        report += `├─ MD5: ${results.fileMetadata.hashes?.md5?.substring(0, 16) || 'N/A'}...\n`;
        report += `├─ SHA256: ${results.fileMetadata.hashes?.sha256?.substring(0, 16) || 'N/A'}...\n`;
        report += `└─ Structure: ${results.structureAnalysis.fileStructure || 'Unknown'}\n\n`;
        
        // System Impact Prediction
        report += `📱 *SYSTEM IMPACT PREDICTION*\n`;
        if (results.systemImpact) {
            report += `├─ Memory: ${results.systemImpact.memoryUsage}\n`;
            report += `├─ CPU: ${results.systemImpact.cpuImpact}\n`;
            report += `├─ Battery: ${results.systemImpact.batteryDrain}\n`;
            report += `├─ Storage: ${results.systemImpact.storageImpact}\n`;
            report += `├─ Stability: ${results.systemImpact.stabilityRisk}\n`;
            report += `└─ Load Time: ${results.systemImpact.startupTime}\n\n`;
        }
        
        // Behavioral Analysis
        if (results.behavioralAnalysis.sandboxScore > 0) {
            report += `🤖 *BEHAVIORAL ANALYSIS*\n`;
            report += `├─ Sandbox Score: ${results.behavioralAnalysis.sandboxScore}/100\n`;
            
            if (results.behavioralAnalysis.networkBehavior.length > 0) {
                report += `├─ Network: ${results.behavioralAnalysis.networkBehavior.slice(0, 2).join(', ')}\n`;
            }
            
            if (results.behavioralAnalysis.fileSystemBehavior.length > 0) {
                report += `├─ Filesystem: ${results.behavioralAnalysis.fileSystemBehavior.slice(0, 2).join(', ')}\n`;
            }
            
            if (results.behavioralAnalysis.persistenceMechanisms.length > 0) {
                report += `└─ Persistence: ${results.behavioralAnalysis.persistenceMechanisms.slice(0, 2).join(', ')}\n`;
            }
            report += `\n`;
        }
        
        // Content Analysis
        if (results.contentAnalysis.maliciousPatterns.length > 0) {
            report += `🔍 *CONTENT ANALYSIS*\n`;
            report += `Found ${results.contentAnalysis.maliciousPatterns.length} suspicious patterns\n\n`;
        }
        
        // Recommendations
        report += `💡 *SECURITY RECOMMENDATIONS*\n`;
        results.recommendations.forEach((rec, i) => {
            report += `${i+1}. ${rec}\n`;
        });
        
        report += `\n═`.repeat(50) + `\n`;
        report += `🛡️ *Advanced Security Scanner v4.0*\n`;
        report += `📅 ${new Date().toLocaleString()}\n`;
        report += `⚡ Real-time heuristic analysis completed\n`;
        
        return report;
    },
    
    generateSummary(results, fileName, isGroup) {
        const nameShort = fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName;
        
        if (results.isDangerous) {
            return `🚨 *SECURITY ALERT!*\n\n` +
                   `❌ *${results.finalRiskLevel} THREAT DETECTED*\n` +
                   `📁 File: ${nameShort}\n` +
                   `📊 Score: ${results.heuristicScore.toFixed(1)}%\n` +
                   `🔍 Threats: ${results.criticalThreats.length + results.highThreats.length}\n\n` +
                   `⚠️ *DO NOT OPEN THIS FILE*\n` +
                   `📨 Full report sent to your personal chat`;
        } else if (results.finalRiskLevel === 'MEDIUM' || results.finalRiskLevel === 'HIGH') {
            return `⚠️ *SUSPICIOUS FILE DETECTED*\n\n` +
                   `📁 File: ${nameShort}\n` +
                   `📊 Risk: ${results.finalRiskLevel}\n` +
                   `🔍 Issues: ${results.mediumThreats.length + results.lowThreats.length}\n\n` +
                   `🔶 Open with caution\n` +
                   `📨 Analysis report sent to your DM`;
        } else {
            return `✅ *FILE SCAN COMPLETE*\n\n` +
                   `📁 File: ${nameShort}\n` +
                   `📊 Status: ${results.finalRiskLevel}\n` +
                   `🔍 Score: ${results.heuristicScore.toFixed(1)}%\n\n` +
                   `🟢 Appears safe to open\n` +
                   `📨 Detailed report in your personal chat`;
        }
    },
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};