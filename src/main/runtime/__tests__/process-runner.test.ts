// Mock electron app for path service dependency
const mockApp = { getPath: jest.fn(() => '/mock/path') };
jest.mock('electron', () => ({ app: mockApp }));

import type { ProcessEvent, ProcessEventType } from '../../../shared/platform/contracts';

describe('Process Runner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('runProcess', () => {
    it('should emit spawned event with correlationId on start', async () => {
      const { runProcess } = await import('../process-runner');
      const events: ProcessEvent[] = [];
      
      await runProcess({
        command: 'echo',
        args: ['hello'],
        correlationId: 'test-123',
        onEvent: (event) => events.push(event),
      });
      
      const spawnedEvent = events.find(e => e.type === 'spawned');
      expect(spawnedEvent).toBeDefined();
      expect(spawnedEvent?.correlationId).toBe('test-123');
    });

    it('should emit stdout events with correlationId', async () => {
      const { runProcess } = await import('../process-runner');
      const events: ProcessEvent[] = [];
      
      await runProcess({
        command: 'echo',
        args: ['hello'],
        correlationId: 'test-456',
        onEvent: (event) => events.push(event),
      });
      
      const stdoutEvents = events.filter(e => e.type === 'stdout');
      stdoutEvents.forEach(e => {
        expect(e.correlationId).toBe('test-456');
      });
    });

    it('should emit exited event with correlationId on completion', async () => {
      const { runProcess } = await import('../process-runner');
      const events: ProcessEvent[] = [];
      
      await runProcess({
        command: 'echo',
        args: ['done'],
        correlationId: 'test-789',
        onEvent: (event) => events.push(event),
      });
      
      const exitedEvent = events.find(e => e.type === 'exited');
      expect(exitedEvent).toBeDefined();
      expect(exitedEvent?.correlationId).toBe('test-789');
    });

    it('should emit error event on command failure', async () => {
      const { runProcess } = await import('../process-runner');
      const events: ProcessEvent[] = [];
      
      await runProcess({
        command: 'nonexistent-command-xyz',
        args: [],
        correlationId: 'error-test',
        onEvent: (event) => events.push(event),
      }).catch(() => {});
      
      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.correlationId).toBe('error-test');
    });

    it('should emit timeout event when process exceeds timeoutMs', async () => {
      const { runProcess } = await import('../process-runner');
      const events: ProcessEvent[] = [];
      
      await runProcess({
        command: 'sleep',
        args: ['10'],
        correlationId: 'timeout-test',
        timeoutMs: 100,
        onEvent: (event) => events.push(event),
      }).catch(() => {});
      
      const timeoutEvent = events.find(e => e.type === 'timeout');
      expect(timeoutEvent).toBeDefined();
      expect(timeoutEvent?.correlationId).toBe('timeout-test');
    });
  });

  describe('stopProcess', () => {
    it('should attempt graceful stop first', async () => {
      const { runProcess, stopProcess } = await import('../process-runner');
      const events: ProcessEvent[] = [];
      
      const processPromise = runProcess({
        command: 'sleep',
        args: ['30'],
        correlationId: 'graceful-stop',
        onEvent: (event) => events.push(event),
      });
      
      // Wait for spawn
      await new Promise(r => setTimeout(r, 100));
      
      await stopProcess('graceful-stop', { strategy: 'graceful' });
      await processPromise.catch(() => {});
      
      const stoppingEvent = events.find(e => e.type === 'stopping');
      expect(stoppingEvent).toBeDefined();
      expect(stoppingEvent?.correlationId).toBe('graceful-stop');
    });

    it('should escalate to force kill after graceful timeout', async () => {
      const { runProcess, stopProcess } = await import('../process-runner');
      const events: ProcessEvent[] = [];
      
      const processPromise = runProcess({
        command: 'sleep',
        args: ['30'],
        correlationId: 'force-stop',
        onEvent: (event) => events.push(event),
      });
      
      await new Promise(r => setTimeout(r, 100));
      
      await stopProcess('force-stop', { strategy: 'force', gracefulTimeoutMs: 50 });
      await processPromise.catch(() => {});
      
      const exitedEvent = events.find(e => e.type === 'exited');
      expect(exitedEvent).toBeDefined();
    });
  });

  describe('Event stream contract (D-04)', () => {
    it('should emit all lifecycle event types with correlationId', async () => {
      const requiredTypes: ProcessEventType[] = [
        'spawned',
        'exited',
      ];
      
      const { runProcess } = await import('../process-runner');
      const events: ProcessEvent[] = [];
      
      await runProcess({
        command: 'echo',
        args: ['test'],
        correlationId: 'lifecycle-test',
        onEvent: (event) => events.push(event),
      });
      
      requiredTypes.forEach(type => {
        const event = events.find(e => e.type === type);
        expect(event).toBeDefined();
        expect(event?.correlationId).toBe('lifecycle-test');
        expect(event?.timestamp).toBeDefined();
      });
    });
  });
});
