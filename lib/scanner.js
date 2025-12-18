const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { fileTypeFromBuffer } = require('file-type');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const sizeOf = require('image-size');
const exiftool = require('node-exiftool');
const exiftoolBin = require('dist-exiftool');
const textract = require('textract');

class AdvancedSecurityScanner {
    constructor(config) {
        this.config = config;
        this.threatDatabase = this.loadThreatPatterns();
    }

    async scanFile(fileBuffer, fileName, originalMessage) {
        const scanStart = Date.now();
        const results = {
            isDangerous: false,
            criticalThreats: [],
            highThreats: [],
            mediumThreats: [],
            lowThreats: [],
            fileMetadata: {},
            structureAnalysis: {},
            contentAnalysis: {},
            behavioralAnalysis: {},
            systemImpact: {},
            heuristicScore: 0,
            recommendations: [],
            scanTime: 0
        };

        try {
            // PHASE 1: FILE METADATA ANALYSIS
            await this.phase1_MetadataAnalysis(fileBuffer, fileName, results);
            
            // PHASE 2: STRUCTURAL ANALYSIS
            await this.phase2_StructuralAnalysis(fileBuffer, fileName, results);
            
            // PHASE 3: CONTENT ANALYSIS
            await this.phase3_ContentAnalysis(fileBuffer, fileName, results);
            
            // PHASE 4: BEHAVIORAL ANALYSIS
            await this.phase4_BehavioralAnalysis(fileBuffer, fileName, results);
            
            // PHASE 5: SYSTEM IMPACT PREDICTION
            await this.phase5_SystemImpactAnalysis(fileBuffer, fileName, results);
            
            // PHASE 6: ADVANCED HEURISTIC SCORING
            await this.phase6_HeuristicScoring(fileBuffer, fileName, results);
            
            // PHASE 7: FINAL VERDICT
            this.phase7_FinalVerdict(results);
            
        } catch (error) {
            console.error('Advanced scan error:', error);
            results.mediumThreats.push('Scan interrupted - partial analysis completed');
        }
        
        results.scanTime = Date.now() - scanStart;
        return results;
    }

    async phase1_MetadataAnalysis(fileBuffer, fileName, results) {
        // Get real file type using magic numbers
        const fileType = await fileTypeFromBuffer(fileBuffer);
        const extension = path.extname(fileName).toLowerCase();
        
        results.fileMetadata = {
            fileName: fileName,
            fileSize: fileBuffer.length,
            humanSize: this.formatBytes(fileBuffer.length),
            detectedMime: fileType ? fileType.mime : 'unknown',
            fileExtension: extension,
            hashes: {
                md5: crypto.createHash('md5').update(fileBuffer).digest('hex'),
                sha1: crypto.createHash('sha1').update(fileBuffer).digest('hex'),
                sha256: crypto.createHash('sha256').update(fileBuffer).digest('hex')
            },
            entropy: this.calculateEntropy(fileBuffer),
            creationTime: new Date().toISOString()
        };
        
        // Check for mismatched extensions
        if (fileType && !this.extensionMatchesMime(extension, fileType.mime)) {
            results.highThreats.push({
                type: 'MIME_EXTENSION_MISMATCH',
                description: `File extension (${extension}) doesn't match actual type (${fileType.mime})`,
                risk: 'Common malware technique to disguise files'
            });
        }
        
        // Check for double extensions
        if (fileName.includes('..') || fileName.split('.').length > 3) {
            results.highThreats.push({
                type: 'DOUBLE_EXTENSION',
                description: 'Multiple file extensions detected',
                risk: 'Malware often uses double extensions to trick users'
            });
        }
        
        // Check file size impact
        const sizeMB = fileBuffer.length / (1024 * 1024);
        if (sizeMB > 400) {
            results.criticalThreats.push({
                type: 'MASSIVE_FILE',
                description: `File is extremely large: ${sizeMB.toFixed(2)}MB`,
                risk: 'Will likely crash mobile devices, cause memory overflow, drain battery'
            });
        } else if (sizeMB > 200) {
            results.highThreats.push({
                type: 'LARGE_FILE',
                description: `Large file size: ${sizeMB.toFixed(2)}MB`,
                risk: 'May cause device lag, high memory usage'
            });
        }
    }

    async phase2_StructuralAnalysis(fileBuffer, fileName, results) {
        const extension = path.extname(fileName).toLowerCase();
        
        results.structureAnalysis = {
            fileStructure: 'unknown',
            embeddedObjects: 0,
            compressionLevel: 'none',
            encryptionDetected: false,
            obfuscationLevel: 0,
            suspiciousSections: []
        };
        
        try {
            // Analyze file header/structure
            const header = fileBuffer.slice(0, 1024).toString('hex');
            
            // Check for executable signatures
            if (this.isExecutableSignature(header)) {
                results.criticalThreats.push({
                    type: 'EXECUTABLE_SIGNATURE',
                    description: 'File contains executable machine code',
                    risk: 'Can run arbitrary code on device, high infection risk'
                });
                results.structureAnalysis.fileStructure = 'executable';
            }
            
            // Check for compressed archives
            if (this.isCompressedFile(header)) {
                results.structureAnalysis.compressionLevel = 'high';
                results.mediumThreats.push({
                    type: 'COMPRESSED_ARCHIVE',
                    description: 'File is compressed/archived',
                    risk: 'May contain hidden malicious files'
                });
                
                // Try to analyze compressed content
                await this.analyzeCompressedContent(fileBuffer, results);
            }
            
            // Check for encrypted content
            if (this.detectEncryption(fileBuffer)) {
                results.structureAnalysis.encryptionDetected = true;
                results.highThreats.push({
                    type: 'ENCRYPTED_CONTENT',
                    description: 'File appears to be encrypted',
                    risk: 'Could be ransomware or hiding malicious payload'
                });
            }
            
            // Check entropy for obfuscation
            if (results.fileMetadata.entropy > 7.5) {
                results.structureAnalysis.obfuscationLevel = 3;
                results.highThreats.push({
                    type: 'HIGH_ENTROPY',
                    description: 'File has high randomness (entropy)',
                    risk: 'Common in packed/obfuscated malware'
                });
            }
            
            // Check for embedded files
            const embeddedCount = this.countEmbeddedObjects(fileBuffer);
            if (embeddedCount > 5) {
                results.structureAnalysis.embeddedObjects = embeddedCount;
                results.mediumThreats.push({
                    type: 'MULTIPLE_EMBEDDED_OBJECTS',
                    description: `Contains ${embeddedCount} embedded objects`,
                    risk: 'Could contain hidden malicious content'
                });
            }
            
        } catch (error) {
            results.lowThreats.push('Structural analysis limited');
        }
    }

    async phase3_ContentAnalysis(fileBuffer, fileName, results) {
        results.contentAnalysis = {
            textContent: '',
            containsScripts: false,
            containsMacros: false,
            containsUrls: false,
            containsSuspiciousStrings: false,
            maliciousPatterns: [],
            documentProperties: {}
        };
        
        try {
            // Extract text content based on file type
            let extractedText = '';
            
            if (fileName.endsWith('.pdf')) {
                const pdfData = await pdf(fileBuffer);
                extractedText = pdfData.text;
                results.contentAnalysis.documentProperties = pdfData.info;
            } 
            else if (fileName.endsWith('.docx')) {
                const result = await mammoth.extractRawText({ buffer: fileBuffer });
                extractedText = result.value;
            }
            else if (fileName.match(/\.(txt|log|md|js|html|htm|php|py)$/i)) {
                extractedText = fileBuffer.toString('utf8', 0, 100000);
            }
            else if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) {
                // Check image for steganography
                extractedText = await this.checkImageMetadata(fileBuffer);
            }
            
            results.contentAnalysis.textContent = extractedText.substring(0, 5000);
            
            // Analyze extracted content
            this.analyzeTextContent(extractedText, results);
            
            // Check for specific file type threats
            if (fileName.endsWith('.js') || fileName.endsWith('.vbs')) {
                await this.analyzeScriptFile(fileBuffer, fileName, results);
            }
            else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
                await this.analyzeDocumentFile(fileBuffer, fileName, results);
            }
            else if (fileName.endsWith('.pdf')) {
                await this.analyzePDFFile(fileBuffer, results);
            }
            
        } catch (error) {
            results.lowThreats.push('Content analysis limited');
        }
    }

    async phase4_BehavioralAnalysis(fileBuffer, fileName, results) {
        results.behavioralAnalysis = {
            sandboxScore: 0,
            networkBehavior: [],
            fileSystemBehavior: [],
            registryBehavior: [],
            processBehavior: [],
            persistenceMechanisms: []
        };
        
        try {
            // Simulate behavioral analysis based on file characteristics
            const extension = path.extname(fileName).toLowerCase();
            
            // Check for persistence mechanisms
            if (extension === '.exe' || extension === '.dll' || extension === '.sys') {
                results.behavioralAnalysis.persistenceMechanisms.push(
                    'Can register as startup service',
                    'May modify registry entries',
                    'Could create scheduled tasks'
                );
                results.behavioralAnalysis.sandboxScore += 40;
            }
            
            // Check for network capabilities
            const textContent = results.contentAnalysis.textContent.toLowerCase();
            const networkKeywords = ['http://', 'https://', 'socket', 'connect', 'download', 'upload', 'server', 'client'];
            
            networkKeywords.forEach(keyword => {
                if (textContent.includes(keyword)) {
                    results.behavioralAnalysis.networkBehavior.push(`Uses ${keyword}`);
                    results.behavioralAnalysis.sandboxScore += 15;
                }
            });
            
            // Check for file system operations
            const fsKeywords = ['createfile', 'writefile', 'deletefile', 'copyfile', 'movefile', 'readfile'];
            fsKeywords.forEach(keyword => {
                if (textContent.includes(keyword)) {
                    results.behavioralAnalysis.fileSystemBehavior.push(`Performs ${keyword} operations`);
                    results.behavioralAnalysis.sandboxScore += 10;
                }
            });
            
            // Check for process manipulation
            const processKeywords = ['createprocess', 'shellexecute', 'winexec', 'terminateprocess'];
            processKeywords.forEach(keyword => {
                if (textContent.includes(keyword)) {
                    results.behavioralAnalysis.processBehavior.push(`Can ${keyword}`);
                    results.behavioralAnalysis.sandboxScore += 20;
                }
            });
            
            // High behavioral score indicates dangerous capabilities
            if (results.behavioralAnalysis.sandboxScore > 50) {
                results.highThreats.push({
                    type: 'HIGH_BEHAVIORAL_SCORE',
                    description: `Behavioral analysis score: ${results.behavioralAnalysis.sandboxScore}/100`,
                    risk: 'File exhibits dangerous capabilities like network access, file manipulation'
                });
            }
            
        } catch (error) {
            results.lowThreats.push('Behavioral analysis limited');
        }
    }

    async phase5_SystemImpactAnalysis(fileBuffer, fileName, results) {
        const sizeMB = fileBuffer.length / (1024 * 1024);
        const extension = path.extname(fileName).toLowerCase();
        
        results.systemImpact = {
            memoryUsage: this.calculateMemoryImpact(sizeMB, extension),
            cpuImpact: this.calculateCPUImpact(extension, results),
            batteryDrain: this.calculateBatteryImpact(sizeMB, extension, results),
            storageImpact: `${sizeMB.toFixed(2)}MB`,
            stabilityRisk: this.calculateStabilityRisk(sizeMB, extension, results),
            startupTime: this.calculateStartupTime(sizeMB, extension)
        };
        
        // Add threats based on system impact
        if (results.systemImpact.stabilityRisk === 'CRITICAL') {
            results.criticalThreats.push({
                type: 'DEVICE_CRASH_RISK',
                description: 'High probability of device crash/freeze',
                risk: 'Opening this file may crash your device, require restart'
            });
        }
        
        if (results.systemImpact.batteryDrain === 'VERY_HIGH') {
            results.highThreats.push({
                type: 'BATTERY_DRAIN',
                description: 'Will cause rapid battery drain',
                risk: 'May reduce battery life by 30-50% per use'
            });
        }
        
        if (results.systemImpact.memoryUsage === 'EXCESSIVE') {
            results.highThreats.push({
                type: 'HIGH_MEMORY_USAGE',
                description: 'Requires excessive memory',
                risk: 'Will slow down device, cause app crashes'
            });
        }
    }

    async phase6_HeuristicScoring(fileBuffer, fileName, results) {
        let score = 0;
        let maxScore = 200; // Higher max for more granular scoring
        
        // Critical threats add heavy weight
        results.criticalThreats.forEach(() => score += 30);
        
        // High threats add significant weight
        results.highThreats.forEach(() => score += 20);
        
        // Medium threats add moderate weight
        results.mediumThreats.forEach(() => score += 10);
        
        // Low threats add small weight
        results.lowThreats.forEach(() => score += 3);
        
        // File size penalty
        const sizeMB = fileBuffer.length / (1024 * 1024);
        if (sizeMB > 400) score += 40;
        else if (sizeMB > 200) score += 25;
        else if (sizeMB > 100) score += 15;
        else if (sizeMB > 50) score += 8;
        
        // Suspicious extension penalty
        const extension = path.extname(fileName).toLowerCase();
        const dangerousExts = ['.exe', '.bat', '.cmd', '.vbs', '.js', '.apk', '.jar', '.scr', '.pif'];
        if (dangerousExts.includes(extension)) score += 25;
        
        // Behavioral score contribution
        score += Math.min(30, results.behavioralAnalysis.sandboxScore / 3);
        
        // Entropy penalty
        if (results.fileMetadata.entropy > 7.5) score += 20;
        
        // Calculate percentage
        results.heuristicScore = Math.min(100, (score / maxScore) * 100);
        
        // Determine risk level
        if (results.heuristicScore >= 80) {
            results.finalRiskLevel = 'CRITICAL';
            results.isDangerous = true;
        } else if (results.heuristicScore >= 60) {
            results.finalRiskLevel = 'HIGH';
            results.isDangerous = true;
        } else if (results.heuristicScore >= 40) {
            results.finalRiskLevel = 'MEDIUM';
        } else if (results.heuristicScore >= 20) {
            results.finalRiskLevel = 'LOW';
        } else {
            results.finalRiskLevel = 'SAFE';
        }
    }

    phase7_FinalVerdict(results) {
        // Generate recommendations based on analysis
        if (results.isDangerous) {
            results.recommendations = [
                '🚫 DO NOT OPEN THIS FILE',
                '🗑️ Delete it immediately',
                '📱 Restart your device if opened',
                '🔒 Run full antivirus scan',
                '⚠️ Warn others about this file'
            ];
        } else if (results.finalRiskLevel === 'MEDIUM') {
            results.recommendations = [
                '⚠️ Open with extreme caution',
                '🛡️ Use in secure/sandboxed environment',
                '📊 Monitor device performance after opening',
                '🔍 Scan with antivirus before opening'
            ];
        } else if (results.finalRiskLevel === 'LOW') {
            results.recommendations = [
                '🔶 Proceed with caution',
                '📱 Ensure sufficient storage space',
                '🔋 Charge device before opening large files'
            ];
        } else {
            results.recommendations = [
                '✅ File appears safe',
                '📁 You may open normally'
            ];
        }
    }

    // Helper Methods
    calculateEntropy(buffer) {
        const len = buffer.length;
        const frequencies = new Array(256).fill(0);
        
        for (let i = 0; i < len; i++) {
            frequencies[buffer[i]]++;
        }
        
        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            const freq = frequencies[i] / len;
            if (freq > 0) {
                entropy -= freq * Math.log2(freq);
            }
        }
        
        return entropy;
    }

    isExecutableSignature(header) {
        const exeSignatures = [
            '4d5a', // MZ - DOS executable
            '5a4d', // ZM - Alternative
            '7f454c46', // ELF - Unix
            'feedface', // Mach-O
            'cefaedfe', // Mach-O LE
            'cffaedfe', // Mach-O 64
            '4c01', // COFF
            '4d5a9000' // PE executable
        ];
        
        return exeSignatures.some(sig => header.startsWith(sig));
    }

    isCompressedFile(header) {
        const compressedSignatures = [
            '504b0304', // ZIP
            '504b0506', // ZIP empty
            '504b0708', // ZIP spanned
            '1f8b', // GZIP
            '425a', // BZIP2
            '377abcaf271c', // 7ZIP
            '526172211a07', // RAR
            '526172211a0700', // RAR5
            'fd377a585a00' // XZ
        ];
        
        return compressedSignatures.some(sig => header.startsWith(sig));
    }

    detectEncryption(buffer) {
        // Simple entropy-based encryption detection
        const entropy = this.calculateEntropy(buffer.slice(0, 4096));
        return entropy > 7.8; // Encrypted data has near-maximum entropy
    }

    countEmbeddedObjects(buffer) {
        let count = 0;
        const patterns = [
            Buffer.from([0xFF, 0xD8, 0xFF]), // JPEG
            Buffer.from([0x89, 0x50, 0x4E, 0x47]), // PNG
            Buffer.from([0x47, 0x49, 0x46]), // GIF
            Buffer.from([0x25, 0x50, 0x44, 0x46]), // PDF
            Buffer.from([0x4D, 0x5A]) // EXE
        ];
        
        patterns.forEach(pattern => {
            let position = 0;
            while ((position = buffer.indexOf(pattern, position)) !== -1) {
                count++;
                position += pattern.length;
            }
        });
        
        return Math.min(count, 20);
    }

    analyzeTextContent(text, results) {
        const lowerText = text.toLowerCase();
        
        // Check for malicious patterns
        this.threatDatabase.patterns.forEach(pattern => {
            if (lowerText.includes(pattern.pattern)) {
                results.contentAnalysis.maliciousPatterns.push(pattern.description);
                
                const threat = {
                    type: 'MALICIOUS_PATTERN',
                    description: pattern.description,
                    risk: pattern.risk
                };
                
                if (pattern.severity === 'critical') results.criticalThreats.push(threat);
                else if (pattern.severity === 'high') results.highThreats.push(threat);
                else if (pattern.severity === 'medium') results.mediumThreats.push(threat);
            }
        });
        
        // Check for URLs
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
        const urls = text.match(urlRegex);
        if (urls && urls.length > 0) {
            results.contentAnalysis.containsUrls = true;
            if (urls.length > 5) {
                results.mediumThreats.push({
                    type: 'MULTIPLE_URLS',
                    description: `Contains ${urls.length} URLs/links`,
                    risk: 'Could link to malicious sites'
                });
            }
        }
        
        // Check for scripts
        const scriptPatterns = ['<script>', 'javascript:', 'eval(', 'document.write', 'window.location'];
        scriptPatterns.forEach(pattern => {
            if (lowerText.includes(pattern)) {
                results.contentAnalysis.containsScripts = true;
                results.mediumThreats.push({
                    type: 'SCRIPT_CONTENT',
                    description: 'Contains JavaScript/script code',
                    risk: 'Could execute malicious scripts'
                });
            }
        });
        
        // Check for macros
        if (lowerText.includes('sub ') || lowerText.includes('function ') || 
            lowerText.includes('macro') || lowerText.includes('vba')) {
            results.contentAnalysis.containsMacros = true;
            results.highThreats.push({
                type: 'MACRO_CODE',
                description: 'Contains macro/VBA code',
                risk: 'Macros can execute malicious code automatically'
            });
        }
    }

    async analyzeScriptFile(buffer, fileName, results) {
        const content = buffer.toString('utf8', 0, 50000);
        const lowerContent = content.toLowerCase();
        
        // Check for dangerous JavaScript/script patterns
        const dangerousPatterns = [
            { pattern: 'eval(', desc: 'Uses eval() function', risk: 'Can execute arbitrary code', severity: 'high' },
            { pattern: 'document.cookie', desc: 'Accesses cookies', risk: 'Could steal session data', severity: 'medium' },
            { pattern: 'localstorage', desc: 'Uses localStorage', risk: 'Could store malicious data', severity: 'medium' },
            { pattern: 'xmlhttprequest', desc: 'Makes HTTP requests', risk: 'Could download malware', severity: 'high' },
            { pattern: 'websocket', desc: 'Uses WebSocket', risk: 'Could establish backdoor', severity: 'high' },
            { pattern: 'setinterval', desc: 'Uses setInterval', risk: 'Could run continuously', severity: 'medium' },
            { pattern: 'decodeuricomponent', desc: 'Decodes URI', risk: 'Could hide malicious URLs', severity: 'medium' },
            { pattern: 'atob(', desc: 'Base64 decoding', risk: 'Could hide malicious code', severity: 'medium' }
        ];
        
        dangerousPatterns.forEach(pattern => {
            if (lowerContent.includes(pattern.pattern)) {
                const threat = {
                    type: 'SCRIPT_PATTERN',
                    description: pattern.desc,
                    risk: pattern.risk
                };
                
                if (pattern.severity === 'high') results.highThreats.push(threat);
                else results.mediumThreats.push(threat);
            }
        });
        
        // Check for obfuscation
        if (this.detectObfuscation(content)) {
            results.criticalThreats.push({
                type: 'OBFUSCATED_SCRIPT',
                description: 'Script is heavily obfuscated',
                risk: 'Common technique to hide malicious code'
            });
        }
    }

    detectObfuscation(content) {
        // Simple obfuscation detection
        const lines = content.split('\n');
        const avgLineLength = content.length / Math.max(lines.length, 1);
        
        // Obfuscated code often has very long lines
        if (avgLineLength > 500) return true;
        
        // Check for excessive escaping
        const escapeCount = (content.match(/\\x[0-9a-f]{2}/gi) || []).length;
        if (escapeCount > 20) return true;
        
        // Check for excessive string concatenation
        const concatCount = (content.match(/["'][^"']*["']\s*\+/gi) || []).length;
        if (concatCount > 15) return true;
        
        return false;
    }

    async analyzePDFFile(buffer, results) {
        try {
            const data = await pdf(buffer);
            
            // Check PDF for malicious features
            if (data.numPages > 100) {
                results.mediumThreats.push({
                    type: 'EXCESSIVE_PDF_PAGES',
                    description: `PDF has ${data.numPages} pages`,
                    risk: 'Could be designed to crash PDF readers'
                });
            }
            
            // Check for JavaScript in PDF
            if (data.text.includes('/JavaScript') || data.text.includes('/JS')) {
                results.criticalThreats.push({
                    type: 'PDF_JAVASCRIPT',
                    description: 'PDF contains embedded JavaScript',
                    risk: 'PDF JavaScript can execute malicious code'
                });
            }
            
            // Check for embedded files
            const embeddedCount = (data.text.match(/\/EmbeddedFile/gi) || []).length;
            if (embeddedCount > 0) {
                results.highThreats.push({
                    type: 'PDF_EMBEDDED_FILES',
                    description: `PDF contains ${embeddedCount} embedded files`,
                    risk: 'Could contain hidden malicious files'
                });
            }
            
        } catch (error) {
            // PDF parsing failed - might be malformed
            results.highThreats.push({
                type: 'MALFORMED_PDF',
                description: 'PDF structure appears corrupted',
                risk: 'Could be designed to exploit PDF reader vulnerabilities'
            });
        }
    }

    calculateMemoryImpact(sizeMB, extension) {
        if (sizeMB > 400) return 'EXCESSIVE (1.5GB+)';
        if (sizeMB > 200) return 'VERY_HIGH (800MB-1.5GB)';
        if (sizeMB > 100) return 'HIGH (400-800MB)';
        if (sizeMB > 50) return 'MODERATE (200-400MB)';
        if (sizeMB > 20) return 'LOW (50-200MB)';
        return 'MINIMAL (<50MB)';
    }

    calculateCPUImpact(extension, results) {
        if (results.behavioralAnalysis.sandboxScore > 60) return 'VERY_HIGH';
        if (results.behavioralAnalysis.sandboxScore > 40) return 'HIGH';
        if (results.behavioralAnalysis.sandboxScore > 20) return 'MODERATE';
        if (['.exe', '.apk', '.jar'].includes(extension)) return 'HIGH';
        if (['.pdf', '.docx'].includes(extension)) return 'MODERATE';
        return 'LOW';
    }

    calculateBatteryImpact(sizeMB, extension, results) {
        let impact = 0;
        
        // Size impact
        if (sizeMB > 400) impact += 40;
        else if (sizeMB > 200) impact += 25;
        else if (sizeMB > 100) impact += 15;
        else if (sizeMB > 50) impact += 8;
        
        // Type impact
        if (extension === '.mp4' || extension === '.avi' || extension === '.mkv') impact += 30;
        else if (extension === '.exe' || extension === '.apk') impact += 25;
        else if (extension === '.pdf' || extension === '.docx') impact += 10;
        
        // Behavioral impact
        impact += Math.min(30, results.behavioralAnalysis.sandboxScore / 3);
        
        if (impact > 60) return 'VERY_HIGH';
        if (impact > 40) return 'HIGH';
        if (impact > 20) return 'MODERATE';
        return 'LOW';
    }

    calculateStabilityRisk(sizeMB, extension, results) {
        let risk = 0;
        
        // Size risk
        if (sizeMB > 400) risk += 50;
        else if (sizeMB > 200) risk += 30;
        else if (sizeMB > 100) risk += 20;
        
        // Extension risk
        if (['.exe', '.apk', '.jar', '.scr'].includes(extension)) risk += 40;
        if (results.isExecutableSignature) risk += 30;
        
        // Critical threats
        risk += results.criticalThreats.length * 25;
        
        if (risk > 70) return 'CRITICAL';
        if (risk > 50) return 'HIGH';
        if (risk > 30) return 'MEDIUM';
        return 'LOW';
    }

    calculateStartupTime(sizeMB, extension) {
        if (sizeMB > 400) return '30-60 seconds (may crash)';
        if (sizeMB > 200) return '15-30 seconds';
        if (sizeMB > 100) return '8-15 seconds';
        if (sizeMB > 50) return '4-8 seconds';
        if (sizeMB > 20) return '2-4 seconds';
        return '1-2 seconds';
    }

    extensionMatchesMime(extension, mime) {
        const mapping = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.zip': 'application/zip',
            '.exe': 'application/x-msdownload',
            '.apk': 'application/vnd.android.package-archive'
        };
        
        return mapping[extension] === mime || !mapping[extension];
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    loadThreatPatterns() {
        return {
            patterns: [
                { pattern: 'exploit', description: 'Contains "exploit" keyword', risk: 'May contain exploit code', severity: 'critical' },
                { pattern: 'malware', description: 'Contains "malware" keyword', risk: 'May be malware', severity: 'critical' },
                { pattern: 'virus', description: 'Contains "virus" keyword', risk: 'May be virus', severity: 'critical' },
                { pattern: 'trojan', description: 'Contains "trojan" keyword', risk: 'May be trojan', severity: 'critical' },
                { pattern: 'ransom', description: 'Contains "ransom" keyword', risk: 'May be ransomware', severity: 'critical' },
                { pattern: 'spyware', description: 'Contains "spyware" keyword', risk: 'May be spyware', severity: 'critical' },
                { pattern: 'keylogger', description: 'Contains "keylogger" keyword', risk: 'May log keystrokes', severity: 'critical' },
                { pattern: 'backdoor', description: 'Contains "backdoor" keyword', risk: 'May create backdoor', severity: 'critical' },
                { pattern: 'rootkit', description: 'Contains "rootkit" keyword', risk: 'May be rootkit', severity: 'critical' },
                { pattern: 'botnet', description: 'Contains "botnet" keyword', risk: 'May connect to botnet', severity: 'critical' },
                { pattern: 'ddos', description: 'Contains "ddos" keyword', risk: 'May perform DDoS attacks', severity: 'high' },
                { pattern: 'crack', description: 'Contains "crack" keyword', risk: 'May be pirated software with malware', severity: 'high' },
                { pattern: 'keygen', description: 'Contains "keygen" keyword', risk: 'May be keygen with malware', severity: 'high' },
                { pattern: 'serial', description: 'Contains "serial" keyword', risk: 'May contain illegal serials', severity: 'medium' },
                { pattern: 'hack', description: 'Contains "hack" keyword', risk: 'May be hacking tool', severity: 'high' },
                { pattern: 'bypass', description: 'Contains "bypass" keyword', risk: 'May bypass security', severity: 'high' },
                { pattern: 'inject', description: 'Contains "inject" keyword', risk: 'May inject code', severity: 'critical' },
                { pattern: 'payload', description: 'Contains "payload" keyword', risk: 'May contain malicious payload', severity: 'critical' },
                { pattern: 'shellcode', description: 'Contains "shellcode" keyword', risk: 'May contain shellcode', severity: 'critical' },
                { pattern: 'metasploit', description: 'Contains "metasploit" keyword', risk: 'May be metasploit payload', severity: 'critical' },
                { pattern: 'rat', description: 'Contains "rat" keyword', risk: 'May be remote access trojan', severity: 'critical' },
                { pattern: 'stealer', description: 'Contains "stealer" keyword', risk: 'May steal data', severity: 'critical' },
                { pattern: 'logger', description: 'Contains "logger" keyword', risk: 'May log sensitive data', severity: 'high' },
                { pattern: 'miner', description: 'Contains "miner" keyword', risk: 'May be cryptocurrency miner', severity: 'high' },
                { pattern: 'cryptominer', description: 'Contains "cryptominer" keyword', risk: 'May mine cryptocurrency', severity: 'high' },
                { pattern: 'coinminer', description: 'Contains "coinminer" keyword', risk: 'May mine coins', severity: 'high' }
            ]
        };
    }
}

module.exports = AdvancedSecurityScanner;