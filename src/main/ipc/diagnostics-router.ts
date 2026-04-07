import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ZodError } from 'zod';
import {
  exportBundleSchema,
  getHealthSchema,
} from '../../shared/ipc/diagnostics-channels';
import type {
  DiagnosticsExportResult,
  HealthSnapshot,
  SupportErrorEnvelope,
} from '../../shared/diagnostics/diagnostics-contracts';
import type { ExportBundleInput, GetHealthInput } from '../../shared/ipc/diagnostics-channels';
import { exportDiagnosticsBundle } from '../diagnostics/diagnostics-export-service';
import { getHealthSnapshot } from '../diagnostics/health-service';

interface GetHealthResponse {
  snapshot?: HealthSnapshot;
  error?: SupportErrorEnvelope;
}

type ExportBundleResponse = DiagnosticsExportResult;
const GET_HEALTH_CHANNEL = 'diagnostics:v1:getHealth';
const EXPORT_BUNDLE_CHANNEL = 'diagnostics:v1:exportBundle';

function mapDiagnosticsError(
  error: unknown,
  fallbackMessage: string,
  options?: { retryable?: boolean; errorCode?: string }
): SupportErrorEnvelope {
  if (error instanceof ZodError) {
    return {
      userMessage: 'Diagnostics request validation failed. Please review the input and retry.',
      nextSteps: [
        'Retry the diagnostics action from Settings > Health.',
        'If this keeps failing, share diagnostics technical details with IT.',
      ],
      retryable: false,
      errorCode: 'DIAG_REQUEST_VALIDATION_FAILED',
      technicalDetails: error.issues.map((issue) => issue.message).join('; '),
    };
  }

  const maybeSupportError = error as Partial<SupportErrorEnvelope>;
  if (
    maybeSupportError &&
    typeof maybeSupportError.userMessage === 'string' &&
    Array.isArray(maybeSupportError.nextSteps) &&
    typeof maybeSupportError.retryable === 'boolean' &&
    typeof maybeSupportError.errorCode === 'string'
  ) {
    return maybeSupportError as SupportErrorEnvelope;
  }

  return {
    userMessage: fallbackMessage,
    nextSteps: [
      'Retry once from Settings > Health.',
      'If the issue persists, export diagnostics and share with IT support.',
    ],
    retryable: options?.retryable ?? true,
    errorCode: options?.errorCode ?? 'DIAGNOSTICS_IPC_OPERATION_FAILED',
    technicalDetails: error instanceof Error ? error.message : String(error),
  };
}

function failedExportResult(error: SupportErrorEnvelope): ExportBundleResponse {
  return {
    bundlePath: '',
    generatedAt: new Date().toISOString(),
    redactionSummary: {
      redactedFields: 0,
      redactionRulesMatched: 0,
    },
    error,
  };
}

export function registerDiagnosticsHandlers(ipc: typeof ipcMain): void {
  ipc.handle(
    GET_HEALTH_CHANNEL,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<GetHealthResponse> => {
      try {
        const validatedRequest = getHealthSchema.parse(request) as GetHealthInput;
        const snapshot = await getHealthSnapshot(validatedRequest);
        return { snapshot };
      } catch (error) {
        return {
          error: mapDiagnosticsError(
            error,
            'Unable to retrieve health snapshot right now.',
            error instanceof ZodError
              ? { retryable: false, errorCode: 'DIAG_REQUEST_VALIDATION_FAILED' }
              : { retryable: true, errorCode: 'DIAG_GET_HEALTH_FAILED' }
          ),
        };
      }
    }
  );

  ipc.handle(
    EXPORT_BUNDLE_CHANNEL,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<ExportBundleResponse> => {
      try {
        const validatedRequest = exportBundleSchema.parse(request) as ExportBundleInput;
        return await exportDiagnosticsBundle(validatedRequest);
      } catch (error) {
        return failedExportResult(
          mapDiagnosticsError(
            error,
            'Unable to generate diagnostics export bundle.',
            error instanceof ZodError
              ? { retryable: false, errorCode: 'DIAG_REQUEST_VALIDATION_FAILED' }
              : { retryable: true, errorCode: 'DIAG_EXPORT_FAILED' }
          )
        );
      }
    }
  );
}
