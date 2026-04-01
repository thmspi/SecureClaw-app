import {
  RunProcessRequest,
  StopProcessRequest,
  GetPathsRequest,
  ProcessEvent,
  ProcessEventType,
} from '../contracts';

describe('Platform Contracts', () => {
  describe('RunProcessRequest', () => {
    it('should have required fields for process execution', () => {
      const request: RunProcessRequest = {
        command: 'npm',
        args: ['install'],
        cwd: '/path/to/project',
        env: { NODE_ENV: 'production' },
        timeoutMs: 30000,
        correlationId: 'req-123',
      };

      expect(request.command).toBe('npm');
      expect(request.correlationId).toBeDefined();
    });
  });

  describe('StopProcessRequest', () => {
    it('should have correlationId for stopping a process', () => {
      const request: StopProcessRequest = {
        correlationId: 'req-123',
        strategy: 'graceful',
      };

      expect(request.correlationId).toBe('req-123');
      expect(request.strategy).toBe('graceful');
    });
  });

  describe('GetPathsRequest', () => {
    it('should support requesting multiple path types', () => {
      const request: GetPathsRequest = {
        paths: ['userData', 'appData', 'temp'],
      };

      expect(request.paths).toContain('userData');
    });
  });

  describe('ProcessEvent', () => {
    it('should support spawned event type', () => {
      const event: ProcessEvent = {
        type: 'spawned',
        correlationId: 'req-123',
        timestamp: new Date().toISOString(),
        data: { pid: 12345 },
      };

      expect(event.type).toBe('spawned');
      expect(event.correlationId).toBeDefined();
    });

    it('should support stdout event type', () => {
      const event: ProcessEvent = {
        type: 'stdout',
        correlationId: 'req-123',
        timestamp: new Date().toISOString(),
        data: { chunk: 'output line' },
      };

      expect(event.type).toBe('stdout');
    });

    it('should support stderr event type', () => {
      const event: ProcessEvent = {
        type: 'stderr',
        correlationId: 'req-123',
        timestamp: new Date().toISOString(),
        data: { chunk: 'error line' },
      };

      expect(event.type).toBe('stderr');
    });

    it('should support stopping event type', () => {
      const event: ProcessEvent = {
        type: 'stopping',
        correlationId: 'req-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      expect(event.type).toBe('stopping');
    });

    it('should support exited event type', () => {
      const event: ProcessEvent = {
        type: 'exited',
        correlationId: 'req-123',
        timestamp: new Date().toISOString(),
        data: { exitCode: 0 },
      };

      expect(event.type).toBe('exited');
    });

    it('should support error event type', () => {
      const event: ProcessEvent = {
        type: 'error',
        correlationId: 'req-123',
        timestamp: new Date().toISOString(),
        data: { error: 'Process failed' },
      };

      expect(event.type).toBe('error');
    });

    it('should support timeout event type', () => {
      const event: ProcessEvent = {
        type: 'timeout',
        correlationId: 'req-123',
        timestamp: new Date().toISOString(),
        data: { timeoutMs: 30000 },
      };

      expect(event.type).toBe('timeout');
    });
  });

  describe('ProcessEventType union', () => {
    it('should include all lifecycle event types', () => {
      const types: ProcessEventType[] = [
        'spawned',
        'stdout',
        'stderr',
        'stopping',
        'exited',
        'error',
        'timeout',
      ];

      types.forEach(type => {
        const event: ProcessEvent = {
          type,
          correlationId: 'test',
          timestamp: new Date().toISOString(),
          data: {},
        };
        expect(event.type).toBe(type);
      });
    });
  });
});
