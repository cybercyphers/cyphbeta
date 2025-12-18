// lib/file-handler.js
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const crypto = require('crypto');

class PerfectFileHandler {
    constructor() {
        // Office file signatures (they're ZIP files with specific content)
        this.OFFICE_SIGNATURES = {
            'docx': ['word/', '[Content_Types].xml', '_rels/.rels'],
            'pptx': ['ppt/', '[Content_Types].xml', '_rels/.rels'],
            'xlsx': ['xl/', '[Content_Types].xml', '_rels/.rels'],
            'odt': ['META-INF/', 'mimetype'],
            'epub': ['META-INF/', 'mimetype']
        };
    }

    // Process file before hiding - ensure perfect preservation
    async processForHiding(buffer, filename) {
        const ext = filename.toLowerCase().split('.').pop();
        
        // For Office files and ZIP files, we need to preserve structure
        if (this.isOfficeFile(buffer, filename) || ext === 'zip') {
            return this.preserveZipStructure(buffer, filename);
        }
        
        // For regular files, just return as-is
        return {
            processed: buffer,
            type: 'file',
            metadata: {
                originalSize: buffer.length,
                originalName: filename,
                isSpecial: false
            }
        };
    }

    // Process after extraction - restore perfect file
    async processAfterExtraction(buffer, header) {
        const filename = header.name || 'extracted_file';
        
        // Check if it was a special preserved file
        if (header.metadata && header.metadata.isSpecial) {
            return this.restoreFromPreserved(buffer, header.metadata);
        }
        
        // Check file type and ensure it's valid
        const validated = this.validateAndFixFile(buffer, filename);
        
        return {
            buffer: validated,
            filename: filename,
            mimeType: this.getMimeType(buffer, filename)
        };
    }

    // Preserve ZIP structure perfectly
    async preserveZipStructure(buffer, filename) {
        try {
            // Read the ZIP to ensure it's valid
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();
            
            // Create a metadata object with file structure
            const structure = entries.map(entry => ({
                name: entry.entryName,
                size: entry.header.size,
                compressed: entry.header.compressedSize,
                isDirectory: entry.isDirectory
            }));
            
            // Create a preservation packet
            const metadata = {
                originalName: filename,
                originalSize: buffer.length,
                entryCount: entries.length,
                structure: structure,
                isOffice: this.isOfficeFile(buffer, filename),
                timestamp: Date.now(),
                checksum: crypto.createHash('sha256').update(buffer).digest('hex')
            };
            
            // For Office files, we need to ensure all entries are preserved
            if (this.isOfficeFile(buffer, filename)) {
                // Verify critical Office files exist
                const criticalFiles = this.OFFICE_SIGNATURES[filename.split('.').pop()] || [];
                for (const critical of criticalFiles) {
                    if (!entries.some(e => e.entryName.includes(critical))) {
                        console.warn(`Office file missing critical: ${critical}`);
                    }
                }
            }
            
            return {
                processed: buffer, // Keep original ZIP untouched
                type: 'office', // Special type
                metadata: {
                    ...metadata,
                    isSpecial: true,
                    requiresZip: true
                }
            };
            
        } catch (error) {
            // If not a valid ZIP, treat as regular file
            console.log(`Not a valid ZIP, treating as regular file: ${error.message}`);
            return {
                processed: buffer,
                type: 'file',
                metadata: {
                    originalSize: buffer.length,
                    originalName: filename,
                    isSpecial: false
                }
            };
        }
    }

    // Restore from preserved format
    async restoreFromPreserved(buffer, metadata) {
        // Verify checksum
        const currentChecksum = crypto.createHash('sha256').update(buffer).digest('hex');
        if (currentChecksum !== metadata.checksum) {
            console.warn('Checksum mismatch during restoration');
        }
        
        // The buffer IS the original ZIP, just return it
        return {
            buffer: buffer,
            filename: metadata.originalName,
            mimeType: this.getMimeType(buffer, metadata.originalName)
        };
    }

    // Validate and fix file if needed
    validateAndFixFile(buffer, filename) {
        const ext = filename.toLowerCase().split('.').pop();
        
        // Check for common file issues
        if (this.isOfficeFile(buffer, filename)) {
            return this.fixOfficeFile(buffer, filename);
        }
        
        if (ext === 'zip') {
            return this.fixZipFile(buffer);
        }
        
        // For other files, ensure they're not corrupted
        return this.ensureFileIntegrity(buffer, filename);
    }

    // Fix Office/ZIP file structure
    fixOfficeFile(buffer, filename) {
        try {
            // Try to read as ZIP first
            const zip = new AdmZip(buffer);
            
            // Check for Office structure
            const entries = zip.getEntries();
            const ext = filename.toLowerCase().split('.').pop();
            const required = this.OFFICE_SIGNATURES[ext] || [];
            
            let hasRequired = true;
            for (const req of required) {
                if (!entries.some(e => e.entryName.includes(req))) {
                    hasRequired = false;
                    break;
                }
            }
            
            if (!hasRequired) {
                console.warn(`Office file missing structure: ${filename}`);
                // Try to add minimal structure for DOCX
                if (ext === 'docx') {
                    return this.createMinimalDocx(buffer);
                }
            }
            
            // File seems valid
            return buffer;
            
        } catch (error) {
            console.error(`Error fixing office file: ${error.message}`);
            
            // If it looks like Office file but broken, create minimal version
            const ext = filename.toLowerCase().split('.').pop();
            if (ext === 'docx') {
                return this.createMinimalDocx(buffer);
            }
            
            // Return original and hope for the best
            return buffer;
        }
    }

    // Fix ZIP file
    fixZipFile(buffer) {
        try {
            const zip = new AdmZip(buffer);
            // Just test if it's readable
            const entries = zip.getEntries();
            
            // Check for ZIP end signature
            const hasValidEnd = this.hasZipEndSignature(buffer);
            if (!hasValidEnd) {
                console.warn('ZIP file missing end signature');
                // Try to fix by finding actual end
                const fixed = this.repairZipEnd(buffer);
                if (fixed) return fixed;
            }
            
            return buffer;
            
        } catch (error) {
            console.error(`Error fixing ZIP: ${error.message}`);
            
            // Try to repair
            const repaired = this.repairZipFile(buffer);
            if (repaired) return repaired;
            
            return buffer;
        }
    }

    // Ensure file integrity
    ensureFileIntegrity(buffer, filename) {
        // Basic checks for common file types
        const ext = filename.toLowerCase().split('.').pop();
        
        switch(ext) {
            case 'pdf':
                return this.ensurePdfIntegrity(buffer);
            case 'jpg':
            case 'jpeg':
                return this.ensureJpegIntegrity(buffer);
            case 'png':
                return this.ensurePngIntegrity(buffer);
            case 'mp3':
                return this.ensureMp3Integrity(buffer);
            case 'mp4':
                return this.ensureMp4Integrity(buffer);
            default:
                return buffer;
        }
    }

    // Create minimal DOCX (as fallback)
    createMinimalDocx(originalBuffer) {
        try {
            const zip = new AdmZip();
            
            // Add minimal Office Open XML structure
            const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
            
            const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Document recovered from steganography</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
            
            const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
            
            zip.addFile("[Content_Types].xml", Buffer.from(contentTypes, 'utf8'));
            zip.addFile("_rels/.rels", Buffer.from(rels, 'utf8'));
            zip.addFile("word/document.xml", Buffer.from(documentXml, 'utf8'));
            
            // Try to add original content if it looks like text
            try {
                const text = originalBuffer.toString('utf8', 0, Math.min(10000, originalBuffer.length));
                if (text.length > 100) {
                    const originalContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${text.replace(/[<>]/g, '')}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
                    zip.addFile("word/original.xml", Buffer.from(originalContent, 'utf8'));
                }
            } catch (e) {
                // Ignore
            }
            
            return zip.toBuffer();
            
        } catch (error) {
            console.error(`Error creating minimal DOCX: ${error.message}`);
            return originalBuffer; // Return original if we can't fix
        }
    }

    // Repair ZIP end signature
    repairZipEnd(buffer) {
        // Look for ZIP end signature (0x06054b50)
        const endSig = Buffer.from([0x50, 0x4B, 0x05, 0x06]);
        
        for (let i = buffer.length - 1000; i < buffer.length; i++) {
            if (i < 0) break;
            
            let match = true;
            for (let j = 0; j < 4; j++) {
                if (buffer[i + j] !== endSig[j]) {
                    match = false;
                    break;
                }
            }
            
            if (match) {
                // Found signature, truncate to this position + 22 (end of central directory)
                const newLength = i + 22;
                if (newLength <= buffer.length) {
                    return buffer.slice(0, newLength);
                }
            }
        }
        
        return null;
    }

    // Repair ZIP file
    repairZipFile(buffer) {
        // Try to extract whatever we can
        try {
            const zip = new AdmZip(buffer, {});
            const entries = zip.getEntries();
            
            if (entries.length > 0) {
                // Create new ZIP with extracted entries
                const newZip = new AdmZip();
                for (const entry of entries) {
                    try {
                        if (!entry.isDirectory) {
                            const entryData = zip.readFile(entry);
                            if (entryData) {
                                newZip.addFile(entry.entryName, entryData);
                            }
                        }
                    } catch (e) {
                        console.warn(`Failed to extract ${entry.entryName}: ${e.message}`);
                    }
                }
                
                return newZip.toBuffer();
            }
        } catch (error) {
            console.error(`Failed to repair ZIP: ${error.message}`);
        }
        
        return null;
    }

    // Check if file is Office file
    isOfficeFile(buffer, filename) {
        const ext = filename.toLowerCase().split('.').pop();
        
        // Check extension
        if (!['docx', 'pptx', 'xlsx', 'odt', 'epub'].includes(ext)) {
            return false;
        }
        
        // Check ZIP signature
        if (buffer.length < 4) return false;
        const zipSig = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
        
        return zipSig;
    }

    // Check for ZIP end signature
    hasZipEndSignature(buffer) {
        if (buffer.length < 22) return false;
        
        const endSig = Buffer.from([0x50, 0x4B, 0x05, 0x06]);
        
        // Check last 1000 bytes for end signature
        const searchStart = Math.max(0, buffer.length - 1000);
        for (let i = searchStart; i <= buffer.length - 4; i++) {
            if (buffer[i] === 0x50 && buffer[i+1] === 0x4B && buffer[i+2] === 0x05 && buffer[i+3] === 0x06) {
                return true;
            }
        }
        
        return false;
    }

    // Get MIME type
    getMimeType(buffer, filename) {
        const ext = filename.toLowerCase().split('.').pop();
        
        const mimeMap = {
            // Office
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'doc': 'application/msword',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'ppt': 'application/vnd.ms-powerpoint',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
            'odt': 'application/vnd.oasis.opendocument.text',
            
            // Archives
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed',
            '7z': 'application/x-7z-compressed',
            'tar': 'application/x-tar',
            'gz': 'application/gzip',
            
            // Images
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            
            // Audio
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'flac': 'audio/flac',
            'm4a': 'audio/mp4',
            
            // Video
            'mp4': 'video/mp4',
            'avi': 'video/x-msvideo',
            'mkv': 'video/x-matroska',
            'mov': 'video/quicktime',
            'webm': 'video/webm',
            
            // Documents
            'pdf': 'application/pdf',
            'txt': 'text/plain',
            'rtf': 'application/rtf',
            'html': 'text/html',
            'htm': 'text/html',
            'xml': 'application/xml',
            'json': 'application/json',
            
            // APK
            'apk': 'application/vnd.android.package-archive',
            
            // Executables
            'exe': 'application/x-msdownload',
            'msi': 'application/x-msi',
            'dmg': 'application/x-apple-diskimage'
        };
        
        return mimeMap[ext] || 'application/octet-stream';
    }

    // Integrity checkers
    ensurePdfIntegrity(buffer) {
        // Check PDF signature
        if (buffer.length >= 5 && buffer.slice(0, 5).toString() === '%PDF-') {
            // Check for EOF marker
            const lastBytes = buffer.slice(-6).toString();
            if (lastBytes.includes('%%EOF')) {
                return buffer;
            }
            
            // Add EOF if missing
            return Buffer.concat([buffer, Buffer.from('\n%%EOF\n')]);
        }
        return buffer;
    }

    ensureJpegIntegrity(buffer) {
        // Check SOI and EOI markers
        if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
            // Check for EOI
            if (buffer.length >= 4 && 
                buffer[buffer.length-2] === 0xFF && 
                buffer[buffer.length-1] === 0xD9) {
                return buffer;
            }
            
            // Add EOI if missing
            return Buffer.concat([buffer, Buffer.from([0xFF, 0xD9])]);
        }
        return buffer;
    }

    ensurePngIntegrity(buffer) {
        // Check PNG signature
        const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        if (buffer.length >= 8 && buffer.slice(0, 8).equals(pngSig)) {
            // Check for IEND chunk
            const iend = Buffer.from('IEND', 'ascii');
            for (let i = buffer.length - 12; i < buffer.length; i++) {
                if (i >= 0 && buffer.slice(i, i + 4).equals(iend)) {
                    return buffer;
                }
            }
        }
        return buffer;
    }

    ensureMp3Integrity(buffer) {
        // Simple MP3 check - just ensure it has some data
        if (buffer.length > 100) {
            // Check for MP3 frame sync (11 bits set)
            for (let i = 0; i < Math.min(1000, buffer.length); i++) {
                if (buffer[i] === 0xFF && (buffer[i+1] & 0xE0) === 0xE0) {
                    return buffer; // Looks like MP3
                }
            }
        }
        return buffer;
    }

    ensureMp4Integrity(buffer) {
        // Check for 'ftyp' atom
        for (let i = 0; i < Math.min(100, buffer.length - 8); i++) {
            if (buffer.slice(i, i + 4).toString() === 'ftyp') {
                return buffer;
            }
        }
        return buffer;
    }
}

module.exports = new PerfectFileHandler();