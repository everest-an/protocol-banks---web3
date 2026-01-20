/**
 * @protocolbanks/react - Theme Tests
 */

import {
  defaultTheme,
  darkTheme,
  createTheme,
  mergeTheme,
} from '../src/theme';

describe('Theme System', () => {
  describe('defaultTheme', () => {
    it('should have all required properties', () => {
      expect(defaultTheme.colors).toBeDefined();
      expect(defaultTheme.colors.primary).toBeDefined();
      expect(defaultTheme.colors.background).toBeDefined();
      expect(defaultTheme.colors.text).toBeDefined();
      expect(defaultTheme.borderRadius).toBeDefined();
      expect(defaultTheme.fontFamily).toBeDefined();
    });
  });

  describe('darkTheme', () => {
    it('should have dark mode colors', () => {
      expect(darkTheme.colors.background).not.toBe(defaultTheme.colors.background);
      expect(darkTheme.colors.text).not.toBe(defaultTheme.colors.text);
    });
  });

  describe('createTheme()', () => {
    it('should create theme with custom colors', () => {
      const customTheme = createTheme({
        colors: {
          primary: '#FF0000',
        },
      });

      expect(customTheme.colors.primary).toBe('#FF0000');
      // Should preserve other default values
      expect(customTheme.colors.background).toBe(defaultTheme.colors.background);
    });

    it('should create theme with custom border radius', () => {
      const customTheme = createTheme({
        borderRadius: '16px',
      });

      expect(customTheme.borderRadius).toBe('16px');
    });

    it('should create theme with custom font', () => {
      const customTheme = createTheme({
        fontFamily: 'Arial, sans-serif',
      });

      expect(customTheme.fontFamily).toBe('Arial, sans-serif');
    });
  });

  describe('mergeTheme()', () => {
    it('should merge two themes', () => {
      const theme1 = createTheme({ colors: { primary: '#FF0000' } });
      const theme2 = createTheme({ borderRadius: '20px' });

      const merged = mergeTheme(theme1, theme2);

      expect(merged.colors.primary).toBe('#FF0000');
      expect(merged.borderRadius).toBe('20px');
    });

    it('should override with second theme values', () => {
      const theme1 = createTheme({ colors: { primary: '#FF0000' } });
      const theme2 = createTheme({ colors: { primary: '#00FF00' } });

      const merged = mergeTheme(theme1, theme2);

      expect(merged.colors.primary).toBe('#00FF00');
    });
  });
});
