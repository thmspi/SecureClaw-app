import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ZodError } from 'zod';
import {
  deleteScopeSecretsSchema,
  deleteSecretSchema,
  getSecretSchema,
  setSecretSchema,
} from '../../shared/ipc/security-channels';
import type {
  DeleteScopeSecretsRequest,
  DeleteScopeSecretsResponse,
  DeleteSecretRequest,
  DeleteSecretResponse,
  GetSecretRequest,
  GetSecretResponse,
  SecretScope,
  SecretScopedKey,
  SecretStoreError,
  SetSecretRequest,
  SetSecretResponse,
} from '../../shared/security/secret-contracts';
import * as secretStore from '../security/secret-store-service';

const FALLBACK_SCOPED_KEY: SecretScopedKey = 'secureclaw:runtime:unknown';
const VALID_SCOPES: SecretScope[] = ['runtime', 'install', 'plugin', 'support'];
const SECRET_SET_CHANNEL = 'secrets:v1:set';
const SECRET_GET_CHANNEL = 'secrets:v1:get';
const SECRET_DELETE_CHANNEL = 'secrets:v1:delete';
const SECRET_DELETE_SCOPE_CHANNEL = 'secrets:v1:deleteScope';

function isSecretStoreError(value: unknown): value is SecretStoreError {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SecretStoreError>;
  return (
    typeof candidate.userMessage === 'string' &&
    Array.isArray(candidate.nextSteps) &&
    typeof candidate.retryable === 'boolean' &&
    typeof candidate.errorCode === 'string'
  );
}

function getScopedKey(request: unknown): SecretScopedKey {
  if (!request || typeof request !== 'object') {
    return FALLBACK_SCOPED_KEY;
  }

  const maybeRequest = request as { scope?: unknown; name?: unknown };
  if (
    typeof maybeRequest.scope === 'string' &&
    VALID_SCOPES.includes(maybeRequest.scope as SecretScope) &&
    typeof maybeRequest.name === 'string' &&
    maybeRequest.name.length > 0
  ) {
    return `secureclaw:${maybeRequest.scope as SecretScope}:${maybeRequest.name}`;
  }

  return FALLBACK_SCOPED_KEY;
}

function mapSecretError(
  error: unknown,
  fallbackMessage: string,
  options?: { retryable?: boolean; errorCode?: string }
): SecretStoreError {
  if (isSecretStoreError(error)) {
    return {
      ...error,
      technicalDetails: error.technicalDetails,
    };
  }

  if (error instanceof ZodError) {
    return {
      userMessage: 'Secret request validation failed. Please review the input and retry.',
      nextSteps: [
        'Retry the action from the same screen.',
        'If the issue persists, export diagnostics from Settings > Health and share with IT.',
      ],
      retryable: false,
      errorCode: 'SECRET_REQUEST_VALIDATION_FAILED',
      technicalDetails: error.issues.map((issue) => issue.message).join('; '),
    };
  }

  return {
    userMessage: fallbackMessage,
    nextSteps: [
      'Retry the action once.',
      'If the issue persists, export diagnostics from Settings > Health and share with IT.',
    ],
    retryable: options?.retryable ?? true,
    errorCode: options?.errorCode ?? 'SECRET_IPC_OPERATION_FAILED',
    technicalDetails: error instanceof Error ? error.message : String(error),
  };
}

export function registerSecurityHandlers(ipc: typeof ipcMain): void {
  ipc.handle(
    SECRET_SET_CHANNEL,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<SetSecretResponse> => {
      const scopedKey = getScopedKey(request);
      try {
        const validatedRequest = setSecretSchema.parse(request) as SetSecretRequest;
        return secretStore.setSecret(validatedRequest);
      } catch (error) {
        return {
          success: false,
          secureStorageAvailable: true,
          scopedKey,
          error: mapSecretError(error, 'Unable to update secure secret storage.'),
        };
      }
    }
  );

  ipc.handle(
    SECRET_GET_CHANNEL,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<GetSecretResponse> => {
      const scopedKey = getScopedKey(request);
      try {
        const validatedRequest = getSecretSchema.parse(request) as GetSecretRequest;
        return secretStore.getSecret(validatedRequest);
      } catch (error) {
        return {
          success: false,
          secureStorageAvailable: true,
          scopedKey,
          error: mapSecretError(error, 'Unable to read secure secret storage.'),
        };
      }
    }
  );

  ipc.handle(
    SECRET_DELETE_CHANNEL,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<DeleteSecretResponse> => {
      const scopedKey = getScopedKey(request);
      try {
        const validatedRequest = deleteSecretSchema.parse(request) as DeleteSecretRequest;
        return secretStore.deleteSecret(validatedRequest);
      } catch (error) {
        return {
          success: false,
          secureStorageAvailable: true,
          scopedKey,
          deleted: false,
          error: mapSecretError(error, 'Unable to delete secure secret storage entry.'),
        };
      }
    }
  );

  ipc.handle(
    SECRET_DELETE_SCOPE_CHANNEL,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<DeleteScopeSecretsResponse> => {
      try {
        const validatedRequest = deleteScopeSecretsSchema.parse(request) as DeleteScopeSecretsRequest;
        return secretStore.deleteScope(validatedRequest);
      } catch (error) {
        return {
          success: false,
          secureStorageAvailable: true,
          deletedCount: 0,
          error: mapSecretError(error, 'Unable to delete scoped secure storage entries.'),
        };
      }
    }
  );
}
