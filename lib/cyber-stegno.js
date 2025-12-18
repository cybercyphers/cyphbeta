// lib/perfect-stegno.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class PerfectStegno {
    constructor() {
        this.MAGIC = Buffer.from('PERFECTSTEG2024', 'utf8');
        this.VERSION = 5;
    }

    // Hide ANY data in ANY image PERFECTLY with metadata support
    async hidePerfectly(imageBuffer, originalBuffer, originalType, originalName, metadata = {}) {
        try {
            // Method 1: Preserve original EXACTLY with metadata
            return this.methodPreserve(imageBuffer, originalBuffer, originalType, originalName, metadata);
        } catch (error) {
            // Method 2: Backup method
            return this.methodBackup(imageBuffer, originalBuffer, originalType, originalName);
        }
    }

    // Method 1: Preserve original perfectly with metadata
    methodPreserve(imageBuffer, originalBuffer, originalType, originalName, metadata = {}) {
        // Create PERFECT header with all original info
        const header = this.createPerfectHeader(originalBuffer, originalType, originalName);
        
        // Create FULL metadata packet with passed metadata
        const fullMetadata = {
            originalSize: originalBuffer.length,
            originalType: originalType,
            originalName: originalName,
            timestamp: Date.now(),
            checksum: this.createChecksum(originalBuffer),
            mimeType: this.detectMimeType(originalBuffer),
            fileSignature: this.getFileSignature(originalBuffer),
            ...metadata // Include passed metadata
        };
        
        const metadataBuffer = Buffer.from(JSON.stringify(fullMetadata), 'utf8');
        const metadataHeader = Buffer.alloc(4);
        metadataHeader.writeUInt32BE(metadataBuffer.length);
        
        // Build perfect packet
        const packet = Buffer.concat([
            this.MAGIC,                                  // Magic bytes
            Buffer.from([this.VERSION]),                 // Version
            header,                                      // Main header
            metadataHeader,                              // Metadata size
            metadataBuffer,                              // Metadata (includes passed metadata)
            Buffer.from([0xFF, 0x00, 0xFF, 0x00]),       // Separator
            originalBuffer,                              // ORIGINAL DATA (untouched)
            Buffer.from([0xFE, 0xED, 0xFE, 0xED])        // End marker
        ]);
        
        // Append to image (doesn't modify image data)
        return Buffer.concat([imageBuffer, packet]);
    }

    // Method 2: Backup
    methodBackup(imageBuffer, originalBuffer, originalType, originalName) {
        // Simple append with minimal processing
        const simpleHeader = Buffer.from(`PERFECT_STEG|${originalType}|${originalName}|${originalBuffer.length}|`, 'utf8');
        return Buffer.concat([imageBuffer, simpleHeader, originalBuffer]);
    }

    // Extract PERFECTLY - get original EXACTLY as given
    async extractPerfectly(imageBuffer) {
        // Try ALL methods to ensure we get the data
        const methods = [
            () => this.extractMethod1(imageBuffer),
            () => this.extractMethod2(imageBuffer),
            () => this.extractMethod3(imageBuffer),
            () => this.extractMethod4(imageBuffer),
            () => this.extractBruteForce(imageBuffer)
        ];
        
        for (const method of methods) {
            try {
                const result = method();
                if (result && result.data && result.data.length > 0) {
                    // Verify we have good data
                    if (this.verifyExtractedData(result)) {
                        console.log(`Extraction successful with ${method.name}`);
                        return result;
                    }
                }
            } catch (e) {
                // Try next method
                continue;
            }
        }
        
        throw new Error('NO_DATA_FOUND');
    }

    // Method 1: Extract from perfect format with metadata
    extractMethod1(imageBuffer) {
        // Find magic
        const magicIndex = this.findBytes(imageBuffer, this.MAGIC);
        if (magicIndex === -1) return null;
        
        let position = magicIndex + this.MAGIC.length;
        
        // Read version
        const version = imageBuffer[position];
        position += 1;
        
        // Read main header
        const headerSize = 128;
        const header = imageBuffer.slice(position, position + headerSize);
        position += headerSize;
        
        // Read metadata size
        const metadataSize = imageBuffer.readUInt32BE(position);
        position += 4;
        
        // Read metadata
        const metadataBuffer = imageBuffer.slice(position, position + metadataSize);
        position += metadataSize;
        
        const metadata = JSON.parse(metadataBuffer.toString('utf8'));
        
        // Skip separator
        position += 4;
        
        // Extract ORIGINAL data
        const originalData = imageBuffer.slice(position, position + metadata.originalSize);
        
        // Verify checksum
        const calculatedChecksum = this.createChecksum(originalData);
        if (calculatedChecksum !== metadata.checksum) {
            throw new Error('DATA_CORRUPTED');
        }
        
        return {
            header: {
                type: metadata.originalType,
                size: metadata.originalSize,
                timestamp: metadata.timestamp,
                name: metadata.originalName,
                mimeType: metadata.mimeType,
                fileSignature: metadata.fileSignature,
                metadata: metadata // Include full metadata for file handler
            },
            data: originalData // EXACT original bytes
        };
    }

    // Method 2: Extract from simple format
    extractMethod2(imageBuffer) {
        const text = imageBuffer.toString('utf8');
        const patternIndex = text.lastIndexOf('PERFECT_STEG|');
        if (patternIndex === -1) return null;
        
        const parts = text.substring(patternIndex).split('|');
        if (parts.length < 5) return null;
        
        const originalType = parts[1];
        const originalName = parts[2];
        const originalSize = parseInt(parts[3]);
        
        const dataStart = patternIndex + parts.slice(0, 4).join('|').length + 4;
        const originalData = imageBuffer.slice(dataStart, dataStart + originalSize);
        
        return {
            header: {
                type: originalType,
                size: originalSize,
                timestamp: Date.now(),
                name: originalName,
                mimeType: this.detectMimeType(originalData),
                metadata: {} // Empty metadata for simple format
            },
            data: originalData
        };
    }

    // Method 3: Look for appended data
    extractMethod3(imageBuffer) {
        // Common file endings where data might be appended
        const endings = [
            Buffer.from([0xFF, 0xD9]), // JPEG
            Buffer.from('IEND', 'ascii'), // PNG
            Buffer.from('BM'), // BMP header
            Buffer.from('GIF'), // GIF
            Buffer.from([0x00, 0x00, 0x00, 0x00]) // Common padding
        ];
        
        for (const ending of endings) {
            const endIndex = this.findLastBytes(imageBuffer, ending);
            if (endIndex !== -1 && endIndex + ending.length < imageBuffer.length) {
                const appendedData = imageBuffer.slice(endIndex + ending.length);
                if (appendedData.length > 20) {
                    return {
                        header: {
                            type: 'file',
                            size: appendedData.length,
                            timestamp: Date.now(),
                            name: 'extracted_file.bin',
                            mimeType: this.detectMimeType(appendedData),
                            metadata: {}
                        },
                        data: appendedData
                    };
                }
            }
        }
        
        return null;
    }

    // Method 4: Deep scan
    extractMethod4(imageBuffer) {
        // Look for known file signatures
        const signatures = {
            'FFD8FF': { type: 'image', ext: 'jpg', mime: 'image/jpeg' },
            '89504E47': { type: 'image', ext: 'png', mime: 'image/png' },
            '47494638': { type: 'image', ext: 'gif', mime: 'image/gif' },
            '494433': { type: 'audio', ext: 'mp3', mime: 'audio/mpeg' },
            '664C6143': { type: 'audio', ext: 'flac', mime: 'audio/flac' },
            '4F676753': { type: 'audio', ext: 'ogg', mime: 'audio/ogg' },
            '52494646': { type: 'audio', ext: 'wav', mime: 'audio/wav' },
            '504B0304': { type: 'archive', ext: 'zip', mime: 'application/zip' },
            '25504446': { type: 'document', ext: 'pdf', mime: 'application/pdf' },
            '7B5C7274': { type: 'document', ext: 'rtf', mime: 'application/rtf' },
            'D0CF11E0': { type: 'document', ext: 'doc', mime: 'application/msword' }
        };
        
        const hex = imageBuffer.toString('hex').toUpperCase();
        
        for (const [sig, info] of Object.entries(signatures)) {
            const index = hex.indexOf(sig);
            if (index !== -1 && index > imageBuffer.length / 2) {
                // Likely appended data (not part of original image)
                const byteIndex = index / 2;
                const data = imageBuffer.slice(byteIndex);
                
                return {
                    header: {
                        type: info.type,
                        size: data.length,
                        timestamp: Date.now(),
                        name: `extracted.${info.ext}`,
                        mimeType: info.mime,
                        metadata: {}
                    },
                    data: data
                };
            }
        }
        
        return null;
    }

    // Method 5: Brute force - get ANYTHING after image data
    extractBruteForce(imageBuffer) {
        // Get last 5MB of file (where appended data usually is)
        const start = Math.max(0, imageBuffer.length - (5 * 1024 * 1024));
        const potentialData = imageBuffer.slice(start);
        
        if (potentialData.length > 100) {
            return {
                header: {
                    type: 'file',
                    size: potentialData.length,
                    timestamp: Date.now(),
                    name: 'recovered_data.bin',
                    mimeType: 'application/octet-stream',
                    metadata: {}
                },
                data: potentialData
            };
        }
        
        return null;
    }

    // Create perfect header
    createPerfectHeader(data, type, name) {
        const header = Buffer.alloc(128);
        
        // Store original info
        header.write(type, 0, 20, 'utf8');
        header.write(name || '', 20, 50, 'utf8');
        header.writeBigUInt64BE(BigInt(data.length), 70);
        header.writeBigUInt64BE(BigInt(Date.now()), 78);
        
        // Store file signature
        const signature = this.getFileSignature(data);
        if (signature) {
            header.write(signature, 86, 10, 'utf8');
        }
        
        // Store CRC32
        const crc = this.crc32(data);
        header.writeUInt32BE(crc, 96);
        
        return header;
    }

    // Verify extracted data is valid
    verifyExtractedData(result) {
        if (!result.data || result.data.length === 0) return false;
        
        // Check for common corruption patterns
        const zeroCount = result.data.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0);
        if (zeroCount > result.data.length * 0.9) {
            return false; // Too many zeros = likely corrupted
        }
        
        return true;
    }

    // ========== UTILITY METHODS ==========

    createChecksum(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    detectMimeType(buffer) {
        // Detect from magic bytes
        if (buffer.length < 4) return 'application/octet-stream';
        
        const hex = buffer.slice(0, 8).toString('hex').toUpperCase();
        
        const signatures = {
            'FFD8FF': 'image/jpeg',
            '89504E47': 'image/png',
            '47494638': 'image/gif',
            '424D': 'image/bmp',
            '494433': 'audio/mpeg',
            '664C6143': 'audio/flac',
            '4F676753': 'audio/ogg',
            '52494646': 'audio/wav',
            '25504446': 'application/pdf',
            '504B0304': 'application/zip',
            '504B0506': 'application/zip',
            '504B0708': 'application/zip',
            'D0CF11E0': 'application/msword',
            '504B': 'application/vnd.android.package-archive' // APK is basically ZIP
        };
        
        for (const [sig, mime] of Object.entries(signatures)) {
            if (hex.startsWith(sig)) {
                return mime;
            }
        }
        
        // Default based on common extensions
        if (hex.includes('4D546864')) return 'audio/midi'; // MThd
        if (hex.includes('66747970')) return 'video/mp4'; // ftyp
        
        return 'application/octet-stream';
    }

    getFileSignature(buffer) {
        if (buffer.length < 4) return '';
        return buffer.slice(0, 4).toString('hex').toUpperCase();
    }

    findBytes(haystack, needle) {
        for (let i = 0; i <= haystack.length - needle.length; i++) {
            let match = true;
            for (let j = 0; j < needle.length; j++) {
                if (haystack[i + j] !== needle[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
    }

    findLastBytes(haystack, needle) {
        for (let i = haystack.length - needle.length; i >= 0; i--) {
            let match = true;
            for (let j = 0; j < needle.length; j++) {
                if (haystack[i + j] !== needle[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
    }

    crc32(buffer) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < buffer.length; i++) {
            crc ^= buffer[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
            }
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // Check if has hidden data
    async hasHiddenData(imageBuffer) {
        try {
            const result = await this.extractPerfectly(imageBuffer);
            return result !== null && result.data && result.data.length > 0;
        } catch {
            return false;
        }
    }

    // Get info
    async getHiddenInfo(imageBuffer) {
        try {
            const result = await this.extractPerfectly(imageBuffer);
            if (!result) return null;
            
            return {
                type: result.header.type,
                size: result.header.size,
                timestamp: new Date(result.header.timestamp).toLocaleString(),
                name: result.header.name,
                mimeType: result.header.mimeType
            };
        } catch {
            return null;
        }
    }

    // Split for bulk
    splitForBulk(data, chunkSize = 1024 * 1024) { // 1MB chunks
        const chunks = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, i + chunkSize));
        }
        return chunks;
    }
}

module.exports = new PerfectStegno();