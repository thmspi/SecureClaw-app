import { createWriteStream } from 'fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import archiver from 'archiver';
import log from 'electron-log';
import { app } from 'electron';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import type {
  DiagnosticsExportResult,
  HealthSnapshot,
  SupportErrorEnvelope,
  VersionKey,
} from '../../shared/diagnostics/diagnostics-contracts';
import { loadInstallState } from '../install/install-state-service';
import { getHistory } from '../runtime/runtime-history-service';
import {
  combineRedactionSummaries,
  redactJsonValue,
  redactText,
  type RedactionMatcherSummary,
} from './redaction';

export interface ExportDiagnosticsBundleInput {
  includeDays?: number;
  outputDir?: string;
  healthSnapshot?: HealthSnapshot;
}

const ZERO_SUMMARY: RedactionMatcherSummary = {
  tokenMatches: 0,
  secretMatches: 0,
  pathMatches: 0,
  emailMatches: 0,
};

function toEnvelope(error: unknown): SupportErrorEnvelope {
  return {
    userMessage: 'Could not generate diagnostics bundle.',
    nextSteps: [
      'Retry export from Settings > Health.',
      'If the issue persists, share technical details with IT support.',
    ],
    retryable: true,
    errorCode: 'DIAG_EXPORT_FAILED',
    technicalDetails: error instanceof Error ? error.message : String(error),
  };
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function toAggregateSummary(summary: RedactionMatcherSummary): DiagnosticsExportResult['redactionSummary'] {
  const values = Object.values(summary);
  return {
    redactedFields: values.reduce((total, count) => total + count, 0),
    redactionRulesMatched: values.filter((count) => count > 0).length,
  };
}

function buildFallbackHealthSnapshot(): HealthSnapshot {
  const installState = loadInstallState();
  const installSeverity = installState?.status === 'failed' ? 'Critical' : installState ? 'Warning' : 'Healthy';

  return {
    overallSeverity: installSeverity,
    components: {
      install: installSeverity,
      runtime: 'Warning',
      plugins: 'Warning',
    },
    versions: {
      app: app.getVersion(),
      openclaw: null,
      nemoclaw: null,
      docker: null,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function readLogSnapshot(): Promise<string | null> {
  try {
    const path = log.transports.file.getFile().path;
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function createZipFromDirectory(sourceDir: string, outZipPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });
}

async function writeJsonArtifact(path: string, data: unknown): Promise<RedactionMatcherSummary> {
  const redacted = redactJsonValue(data);
  await writeFile(path, JSON.stringify(redacted.redacted, null, 2), 'utf8');
  return redacted.summary;
}

async function writeTextArtifact(path: string, contents: string): Promise<RedactionMatcherSummary> {
  const redacted = redactText(contents);
  await writeFile(path, redacted.redacted, 'utf8');
  return redacted.summary;
}

function normalizeVersions(versions: Record<VersionKey, string | null>): Record<VersionKey, string | null> {
  return {
    app: versions.app,
    openclaw: versions.openclaw,
    nemoclaw: versions.nemoclaw,
    docker: versions.docker,
  };
}

export async function exportDiagnosticsBundle(
  input: ExportDiagnosticsBundleInput = {}
): Promise<DiagnosticsExportResult> {
  const includeDays = input.includeDays ?? 7;
  const generatedAt = new Date().toISOString();
  const tmpRoot = await mkdtemp(join(tmpdir(), 'secureclaw-diagnostics-'));
  const workspaceDir = join(tmpRoot, 'bundle');
  const outputDir = input.outputDir ?? app.getPath('downloads');
  const bundlePath = join(outputDir, `secureclaw-diagnostics-${Date.now()}.zip`);

  try {
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    const healthSnapshot = input.healthSnapshot ?? buildFallbackHealthSnapshot();
    const versions = normalizeVersions(healthSnapshot.versions);
    const history = getHistory({ fromDate: daysAgoIso(includeDays), limit: 500 });
    const installState = loadInstallState();
    const logSnapshot = await readLogSnapshot();

    const summaries: RedactionMatcherSummary[] = [];
    summaries.push(await writeJsonArtifact(join(workspaceDir, 'health-snapshot.json'), healthSnapshot));
    summaries.push(await writeJsonArtifact(join(workspaceDir, 'component-versions.json'), versions));
    summaries.push(await writeJsonArtifact(join(workspaceDir, 'operation-history.json'), history.records));
    summaries.push(await writeJsonArtifact(join(workspaceDir, 'install-snapshot.json'), installState));

    if (logSnapshot && logSnapshot.length > 0) {
      summaries.push(await writeTextArtifact(join(workspaceDir, 'app.log'), logSnapshot));
    }

    const redactionSummary = combineRedactionSummaries(summaries);
    await writeFile(join(workspaceDir, 'redaction-summary.json'), JSON.stringify(redactionSummary, null, 2), 'utf8');
    await writeFile(
      join(workspaceDir, 'manifest.json'),
      JSON.stringify(
        {
          generatedAt,
          includeDays,
          files: [
            'health-snapshot.json',
            'component-versions.json',
            'operation-history.json',
            'install-snapshot.json',
            'redaction-summary.json',
            logSnapshot ? 'app.log' : null,
          ].filter((value): value is string => Boolean(value)),
        },
        null,
        2
      ),
      'utf8'
    );

    await createZipFromDirectory(workspaceDir, bundlePath);

    return {
      bundlePath,
      generatedAt,
      redactionSummary: toAggregateSummary(redactionSummary),
    };
  } catch (error) {
    return {
      bundlePath: '',
      generatedAt,
      redactionSummary: toAggregateSummary(ZERO_SUMMARY),
      error: toEnvelope(error),
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

export function diagnosticsBundleFileName(bundlePath: string): string {
  return basename(bundlePath);
}
