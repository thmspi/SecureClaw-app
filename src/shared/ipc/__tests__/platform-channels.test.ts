import {
  PLATFORM_CHANNELS,
  runProcessSchema,
  stopProcessSchema,
  getPathsSchema,
} from '../platform-channels';

describe('Platform IPC Channels', () => {
  describe('PLATFORM_CHANNELS constants', () => {
    it('should define versioned runProcess channel', () => {
      expect(PLATFORM_CHANNELS.runProcess).toBe('platform:v1:runProcess');
    });

    it('should define versioned stopProcess channel', () => {
      expect(PLATFORM_CHANNELS.stopProcess).toBe('platform:v1:stopProcess');
    });

    it('should define versioned getPaths channel', () => {
      expect(PLATFORM_CHANNELS.getPaths).toBe('platform:v1:getPaths');
    });
  });

  describe('runProcessSchema', () => {
    it('should validate valid runProcess request', () => {
      const validRequest = {
        command: 'node',
        args: ['script.js'],
        cwd: '/path/to/dir',
        env: {},
        timeoutMs: 30000,
        correlationId: 'req-123',
      };

      const result = runProcessSchema.parse(validRequest);
      expect(result.command).toBe('node');
      expect(result.correlationId).toBe('req-123');
    });

    it('should reject invalid runProcess request missing required fields', () => {
      const invalidRequest = {
        args: ['script.js'],
      };

      expect(() => runProcessSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('stopProcessSchema', () => {
    it('should validate valid stopProcess request', () => {
      const validRequest = {
        correlationId: 'req-123',
        strategy: 'graceful',
      };

      const result = stopProcessSchema.parse(validRequest);
      expect(result.correlationId).toBe('req-123');
    });

    it('should reject invalid stopProcess request', () => {
      const invalidRequest = {};

      expect(() => stopProcessSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('getPathsSchema', () => {
    it('should validate valid getPaths request', () => {
      const validRequest = {
        paths: ['userData', 'appData'],
      };

      const result = getPathsSchema.parse(validRequest);
      expect(result.paths).toContain('userData');
    });

    it('should reject invalid getPaths request', () => {
      const invalidRequest = {
        paths: 'not-an-array',
      };

      expect(() => getPathsSchema.parse(invalidRequest)).toThrow();
    });
  });
});
