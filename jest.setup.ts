// Jest setup file for Protocol Banks testing

// Mock winston before any imports (ESM compatibility)
jest.mock('winston', () => {
  const mockFormat: any = {
    combine: jest.fn(() => mockFormat),
    timestamp: jest.fn(() => mockFormat),
    errors: jest.fn(() => mockFormat),
    json: jest.fn(() => mockFormat),
    colorize: jest.fn(() => mockFormat),
    simple: jest.fn(() => mockFormat),
    printf: jest.fn(() => mockFormat),
    label: jest.fn(() => mockFormat),
    metadata: jest.fn(() => mockFormat),
  };
  // winston.format() is also a callable function (returns a format transform)
  const formatFn: any = jest.fn(() => jest.fn((info: any) => info));
  Object.assign(formatFn, mockFormat);
  const mockTransport = jest.fn();
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    silly: jest.fn(),
    log: jest.fn(),
    child: jest.fn().mockReturnThis(),
    add: jest.fn(),
    on: jest.fn(),
  };
  const winstonMock = {
    createLogger: jest.fn(() => mockLogger),
    format: formatFn,
    transports: {
      Console: mockTransport,
      File: mockTransport,
    },
    addColors: jest.fn(),
    config: {
      npm: { levels: { error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6 } },
    },
  };
  return {
    __esModule: true,
    default: winstonMock,
    ...winstonMock,
  };
});

// Mock tronweb (not available in test environment)
jest.mock('tronweb', () => {
  const mockTronWeb = jest.fn().mockImplementation(() => ({
    trx: {
      getTransaction: jest.fn(),
      getTransactionInfo: jest.fn(),
      getCurrentBlock: jest.fn(),
      getBalance: jest.fn(),
      getAccount: jest.fn(),
      sendRawTransaction: jest.fn(),
    },
    contract: jest.fn().mockReturnValue({
      at: jest.fn().mockResolvedValue({
        methods: {},
        balanceOf: jest.fn(),
        transfer: jest.fn(),
        approve: jest.fn(),
      }),
    }),
    address: {
      fromHex: jest.fn((addr: string) => addr),
      toHex: jest.fn((addr: string) => addr),
    },
    isAddress: jest.fn(() => true),
    toSun: jest.fn((val: number) => val * 1e6),
    fromSun: jest.fn((val: number) => val / 1e6),
    transactionBuilder: {
      triggerSmartContract: jest.fn(),
      sendTrx: jest.fn(),
    },
  }));
  mockTronWeb.utils = {
    abi: { decodeParams: jest.fn() },
  };
  return { __esModule: true, default: mockTronWeb, TronWeb: mockTronWeb };
});

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless DEBUG is set
  log: process.env.DEBUG ? console.log : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
  info: process.env.DEBUG ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Mock crypto for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = require('crypto');
  globalThis.crypto = webcrypto as Crypto;
}

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
