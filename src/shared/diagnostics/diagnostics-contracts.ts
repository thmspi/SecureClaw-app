export type HealthSeverity = 'Healthy' | 'Warning' | 'Critical';

export type HealthComponentId = 'install' | 'runtime' | 'plugins';

export type VersionKey = 'app' | 'openclaw' | 'nemoclaw' | 'docker';

export interface SupportErrorEnvelope {
  userMessage: string;
  nextSteps: string[];
  retryable: boolean;
  errorCode: string;
  technicalDetails?: string;
}

export interface HealthSnapshot {
  overallSeverity: HealthSeverity;
  components: Record<HealthComponentId, HealthSeverity>;
  versions: Record<VersionKey, string | null>;
  generatedAt: string;
}

export interface RedactionSummary {
  redactedFields: number;
  redactionRulesMatched: number;
}

export interface DiagnosticsExportResult {
  bundlePath: string;
  generatedAt: string;
  redactionSummary: RedactionSummary;
  error?: SupportErrorEnvelope;
}
