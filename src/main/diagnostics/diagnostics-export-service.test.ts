import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => tmpdir()),
    getVersion: jest.fn(() => '1.0.0'),
  },
}));

jest.mock('electron-log', () => ({
  __esModule: true,
  default: {
    transports: {
      file: {
        getFile: jest.fn(() => ({ path: join(tmpdir(), 'secureclaw-test.log') })),
      },
    },
  },
}));

jest.mock('../runtime/runtime-history-service', () => ({
  getHistory: jest.fn(() => ({
    records: [
      {
        id: 'h-1',
        operationType: 'session_start',
        status: 'failed',
        targetName: 'runtime',
        startedAt: '2026-04-03T10:00:00.000Z',
        errorMessage: 'Bearer abc123 for user@example.com at /Users/alice/project',
        metadata: {
          token: 'tok_2',
        },
      },
    ],
    total: 1,
  })),
}));

describe('diagnostics-export-service', () => {
  it('writes one ZIP bundle with redacted diagnostics artifacts and summary counts', async () => {
    const { exportDiagnosticsBundle } = await import('./diagnostics-export-service');
    const outputDir = mkdtempSync(join(tmpdir(), 'secureclaw-diag-test-'));
    try {
      const result = await exportDiagnosticsBundle({
        includeDays: 7,
        outputDir,
        healthSnapshot: {
          overallSeverity: 'Warning',
          components: {
            install: 'Healthy',
            runtime: 'Warning',
            plugins: 'Healthy',
          },
          versions: {
            app: '1.0.0',
            openclaw: '0.9.0',
            nemoclaw: '0.2.0',
            docker: '28.0.0',
          },
          generatedAt: '2026-04-03T10:00:00.000Z',
        },
      });

      expect(result.bundlePath).toMatch(/\.zip$/);

      const zipListing = execFileSync('unzip', ['-l', result.bundlePath], { encoding: 'utf8' });
      expect(zipListing).toContain('health-snapshot.json');
      expect(zipListing).toContain('component-versions.json');
      expect(zipListing).toContain('operation-history.json');
      expect(zipListing).toContain('redaction-summary.json');

      const redactionSummaryRaw = execFileSync('unzip', ['-p', result.bundlePath, 'redaction-summary.json'], {
        encoding: 'utf8',
      });
      const redactionSummary = JSON.parse(redactionSummaryRaw) as Record<string, number>;
      expect(redactionSummary.tokenMatches).toBeGreaterThan(0);
      expect(redactionSummary.secretMatches).toBeGreaterThan(0);
      expect(redactionSummary.pathMatches).toBeGreaterThan(0);
      expect(redactionSummary.emailMatches).toBeGreaterThan(0);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
