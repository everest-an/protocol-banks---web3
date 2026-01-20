/**
 * ProtocolBanks SDK - QR Code Module
 * 
 * 二维码生成，支持:
 * - SVG/PNG/Base64 输出
 * - Logo 嵌入
 * - 自定义颜色和尺寸
 */

import type { QROptions, QRCode, QRFormat, QRErrorCorrection } from '../types';
import { ErrorCodes } from '../types';
import { ProtocolBanksError } from '../utils/errors';

// ============================================================================
// QR Code Generator
// ============================================================================

/**
 * QR Code error correction levels
 * L = 7%, M = 15%, Q = 25%, H = 30%
 */
const ERROR_CORRECTION_LEVELS: Record<QRErrorCorrection, number> = {
  'L': 1,
  'M': 0,
  'Q': 3,
  'H': 2,
};

/**
 * QR Code Module class
 */
export class QRCodeModule {
  
  /**
   * Generate QR code from content
   */
  async generate(content: string, options: QROptions = {}): Promise<QRCode> {
    const {
      size = 300,
      format = 'svg',
      errorCorrection = 'M',
      foreground = '#000000',
      background = '#ffffff',
      logo,
      logoSize = 0.2,
      margin = 4,
    } = options;
    
    // Validate size
    if (size < 100 || size > 1000) {
      throw new ProtocolBanksError({
        code: ErrorCodes.VALID_OUT_OF_RANGE,
        category: 'VALID',
        message: 'QR code size must be between 100 and 1000 pixels',
        retryable: false,
      });
    }
    
    // Validate logo size
    if (logoSize < 0.1 || logoSize > 0.3) {
      throw new ProtocolBanksError({
        code: ErrorCodes.VALID_OUT_OF_RANGE,
        category: 'VALID',
        message: 'Logo size must be between 0.1 and 0.3',
        retryable: false,
      });
    }
    
    // Generate QR matrix
    const matrix = this.generateMatrix(content, errorCorrection);
    
    // Generate output based on format
    let data: string;
    
    switch (format) {
      case 'svg':
        data = this.generateSVG(matrix, {
          size,
          foreground,
          background,
          margin,
          logo,
          logoSize,
        });
        break;
        
      case 'dataUrl':
        const svg = this.generateSVG(matrix, {
          size,
          foreground,
          background,
          margin,
          logo,
          logoSize,
        });
        data = `data:image/svg+xml;base64,${this.btoa(svg)}`;
        break;
        
      case 'base64':
        const svgBase64 = this.generateSVG(matrix, {
          size,
          foreground,
          background,
          margin,
          logo,
          logoSize,
        });
        data = this.btoa(svgBase64);
        break;
        
      case 'png':
        // PNG generation requires canvas - return SVG data URL for now
        const svgPng = this.generateSVG(matrix, {
          size,
          foreground,
          background,
          margin,
          logo,
          logoSize,
        });
        data = `data:image/svg+xml;base64,${this.btoa(svgPng)}`;
        break;
        
      default:
        throw new ProtocolBanksError({
          code: ErrorCodes.VALID_INVALID_FORMAT,
          category: 'VALID',
          message: `Unsupported QR format: ${format}`,
          retryable: false,
        });
    }
    
    return {
      data,
      format,
      size,
      paymentLink: content,
    };
  }
  
  // ============================================================================
  // QR Matrix Generation (Simplified)
  // ============================================================================
  
  /**
   * Generate QR code matrix
   * This is a simplified implementation - in production use 'qrcode' library
   */
  private generateMatrix(content: string, errorCorrection: QRErrorCorrection): boolean[][] {
    // Calculate version based on content length
    const version = this.calculateVersion(content.length, errorCorrection);
    const size = version * 4 + 17;
    
    // Initialize matrix
    const matrix: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
    
    // Add finder patterns (corners)
    this.addFinderPattern(matrix, 0, 0);
    this.addFinderPattern(matrix, size - 7, 0);
    this.addFinderPattern(matrix, 0, size - 7);
    
    // Add timing patterns
    this.addTimingPatterns(matrix, size);
    
    // Add alignment patterns for version > 1
    if (version > 1) {
      this.addAlignmentPatterns(matrix, version);
    }
    
    // Encode data (simplified - just fill remaining cells based on content hash)
    this.encodeData(matrix, content, size);
    
    return matrix;
  }
  
  private calculateVersion(length: number, errorCorrection: QRErrorCorrection): number {
    // Simplified version calculation
    const capacities: Record<QRErrorCorrection, number[]> = {
      'L': [17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
      'M': [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
      'Q': [11, 20, 32, 46, 60, 74, 86, 108, 130, 151],
      'H': [7, 14, 24, 34, 44, 58, 64, 84, 98, 119],
    };
    
    const caps = capacities[errorCorrection];
    for (let v = 0; v < caps.length; v++) {
      if (length <= (caps[v] ?? 0)) {
        return v + 1;
      }
    }
    return 10; // Max version for this simplified implementation
  }
  
  private addFinderPattern(matrix: boolean[][], row: number, col: number): void {
    const pattern = [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ];
    
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (matrix[row + r] && matrix[row + r]![col + c] !== undefined) {
          matrix[row + r]![col + c] = pattern[r]![c] === 1;
        }
      }
    }
  }
  
  private addTimingPatterns(matrix: boolean[][], size: number): void {
    for (let i = 8; i < size - 8; i++) {
      const value = i % 2 === 0;
      if (matrix[6]) matrix[6]![i] = value;
      if (matrix[i]) matrix[i]![6] = value;
    }
  }
  
  private addAlignmentPatterns(matrix: boolean[][], version: number): void {
    const positions = this.getAlignmentPositions(version);
    const size = version * 4 + 17;
    
    for (const row of positions) {
      for (const col of positions) {
        // Skip if overlapping with finder patterns
        if ((row < 9 && col < 9) || 
            (row < 9 && col > size - 10) || 
            (row > size - 10 && col < 9)) {
          continue;
        }
        
        this.addAlignmentPattern(matrix, row, col);
      }
    }
  }
  
  private getAlignmentPositions(version: number): number[] {
    if (version === 1) return [];
    
    const positions = [6];
    const size = version * 4 + 17;
    const step = Math.floor((size - 13) / (Math.floor(version / 7) + 1));
    
    for (let pos = size - 7; pos > 6; pos -= step) {
      positions.unshift(pos);
    }
    
    return positions;
  }
  
  private addAlignmentPattern(matrix: boolean[][], centerRow: number, centerCol: number): void {
    const pattern = [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ];
    
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const row = centerRow - 2 + r;
        const col = centerCol - 2 + c;
        if (matrix[row] && matrix[row]![col] !== undefined) {
          matrix[row]![col] = pattern[r]![c] === 1;
        }
      }
    }
  }
  
  private encodeData(matrix: boolean[][], content: string, size: number): void {
    // Simple hash-based data encoding for visualization
    // In production, use proper QR encoding algorithm
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash = hash & hash;
    }
    
    // Fill data area with pseudo-random pattern based on content
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        // Skip reserved areas
        if (this.isReservedArea(row, col, size)) continue;
        
        // Generate pseudo-random value based on position and content hash
        const seed = (row * size + col + hash) & 0xFFFFFFFF;
        matrix[row]![col] = (seed % 3) !== 0;
      }
    }
  }
  
  private isReservedArea(row: number, col: number, size: number): boolean {
    // Finder patterns + separators
    if (row < 9 && col < 9) return true;
    if (row < 9 && col > size - 9) return true;
    if (row > size - 9 && col < 9) return true;
    
    // Timing patterns
    if (row === 6 || col === 6) return true;
    
    return false;
  }
  
  // ============================================================================
  // SVG Generation
  // ============================================================================
  
  private generateSVG(
    matrix: boolean[][],
    options: {
      size: number;
      foreground: string;
      background: string;
      margin: number;
      logo?: string;
      logoSize: number;
    }
  ): string {
    const { size, foreground, background, margin, logo, logoSize } = options;
    const matrixSize = matrix.length;
    const cellSize = size / (matrixSize + margin * 2);
    const offset = margin * cellSize;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
    
    // Background
    svg += `<rect width="100%" height="100%" fill="${background}"/>`;
    
    // QR modules
    for (let row = 0; row < matrixSize; row++) {
      for (let col = 0; col < matrixSize; col++) {
        if (matrix[row]![col]) {
          const x = offset + col * cellSize;
          const y = offset + row * cellSize;
          svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${foreground}"/>`;
        }
      }
    }
    
    // Logo (if provided)
    if (logo) {
      const logoSizePixels = size * logoSize;
      const logoX = (size - logoSizePixels) / 2;
      const logoY = (size - logoSizePixels) / 2;
      
      // White background for logo
      svg += `<rect x="${logoX - 5}" y="${logoY - 5}" width="${logoSizePixels + 10}" height="${logoSizePixels + 10}" fill="${background}" rx="5"/>`;
      
      // Logo image
      svg += `<image x="${logoX}" y="${logoY}" width="${logoSizePixels}" height="${logoSizePixels}" href="${logo}"/>`;
    }
    
    svg += '</svg>';
    
    return svg;
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  private btoa(str: string): string {
    if (typeof window !== 'undefined' && window.btoa) {
      return window.btoa(str);
    }
    // Node.js
    return Buffer.from(str).toString('base64');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new QRCodeModule instance
 */
export function createQRCodeModule(): QRCodeModule {
  return new QRCodeModule();
}

/**
 * Generate QR code (convenience function)
 */
export async function generateQRCode(content: string, options?: QROptions): Promise<QRCode> {
  const module = new QRCodeModule();
  return module.generate(content, options);
}
