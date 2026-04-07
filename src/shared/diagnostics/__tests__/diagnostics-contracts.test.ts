import {
  DiagnosticsExportResult,
  HealthSnapshot,
  SupportErrorEnvelope,
} from '../diagnostics-contracts';

describe('Diagnostics Contracts', () => {
  it('includes required health snapshot structure with components and versions', () => {
    const health: HealthSnapshot = {
      overallSeverity: 'Warning',
      components: {
        install: 'Healthy',
        runtime: 'Warning',
        plugins: 'Critical',
      },
      versions: {
        app: '1.0.0',
        openclaw: '0.9.0',
        nemoclaw: null,
        docker: '27.0.0',
      },
      generatedAt: new Date().toISOString(),
    };

    expect(health.components.plugins).toBe('Critical');
    expect(health.versions.nemoclaw).toBeNull();
  });

  it('includes export result redaction summary and plain-language error envelope fields', () => {
    const result: DiagnosticsExportResult = {
      bundlePath: '/tmp/support.zip',
      generatedAt: new Date().toISOString(),
      redactionSummary: {
        redactedFields: 8,
        redactionRulesMatched: 5,
      },
    };

    const error: SupportErrorEnvelope = {
      userMessage: 'Could not generate diagnostics bundle.',
      nextSteps: ['Retry export from Settings > Health.'],
      retryable: true,
      errorCode: 'DIAG_EXPORT_FAILED',
      technicalDetails: 'ENOENT: missing runtime log file',
    };

    expect(result.redactionSummary.redactedFields).toBeGreaterThan(0);
    expect(error.userMessage).toContain('Could not generate');
    expect(error.retryable).toBe(true);
  });
});
