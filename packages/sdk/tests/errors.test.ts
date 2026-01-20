/**
 * @protocolbanks/sdk - Error Handling Tests
 */

import {
  SDKError,
  ValidationError,
  AuthenticationError,
  NetworkError,
  PaymentError,
  RateLimitError,
  ErrorCode,
  getErrorMessage,
} from '../src/utils/errors';

describe('SDKError', () => {
  it('should create error with code and message', () => {
    const error = new SDKError(ErrorCode.INVALID_ADDRESS, 'Invalid address format');
    expect(error.code).toBe(ErrorCode.INVALID_ADDRESS);
    expect(error.message).toBe('Invalid address format');
    expect(error.name).toBe('SDKError');
  });

  it('should include details when provided', () => {
    const error = new SDKError(ErrorCode.INVALID_ADDRESS, 'Invalid', { address: '0x123' });
    expect(error.details).toEqual({ address: '0x123' });
  });

  it('should be instanceof Error', () => {
    const error = new SDKError(ErrorCode.INVALID_ADDRESS, 'Invalid');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof SDKError).toBe(true);
  });
});

describe('Specialized Errors', () => {
  it('should create ValidationError', () => {
    const error = new ValidationError('Invalid amount');
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.name).toBe('ValidationError');
  });

  it('should create AuthenticationError', () => {
    const error = new AuthenticationError('Invalid API key');
    expect(error.code).toBe(ErrorCode.INVALID_API_KEY);
    expect(error.name).toBe('AuthenticationError');
  });

  it('should create NetworkError', () => {
    const error = new NetworkError('Connection failed');
    expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(error.name).toBe('NetworkError');
  });

  it('should create PaymentError', () => {
    const error = new PaymentError('Payment failed');
    expect(error.code).toBe(ErrorCode.PAYMENT_FAILED);
    expect(error.name).toBe('PaymentError');
  });

  it('should create RateLimitError', () => {
    const error = new RateLimitError(60);
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
    expect(error.retryAfter).toBe(60);
    expect(error.name).toBe('RateLimitError');
  });
});

describe('Error Messages', () => {
  it('should return English messages by default', () => {
    const message = getErrorMessage(ErrorCode.INVALID_ADDRESS, 'en');
    expect(message).toContain('address');
  });

  it('should return Chinese messages when requested', () => {
    const message = getErrorMessage(ErrorCode.INVALID_ADDRESS, 'zh');
    expect(message).toContain('地址');
  });

  it('should fallback to English for unknown locale', () => {
    const message = getErrorMessage(ErrorCode.INVALID_ADDRESS, 'fr' as any);
    expect(message).toContain('address');
  });
});

describe('Error Code Format', () => {
  it('should follow PB_XXX_NNN format', () => {
    const codePattern = /^PB_[A-Z]+_\d{3}$/;
    Object.values(ErrorCode).forEach((code) => {
      expect(code).toMatch(codePattern);
    });
  });
});
