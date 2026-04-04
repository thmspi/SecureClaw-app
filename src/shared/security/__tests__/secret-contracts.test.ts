import {
  DeleteScopeSecretsRequest,
  DeleteScopeSecretsResponse,
  GetSecretRequest,
  GetSecretResponse,
  SecretStoreError,
  SetSecretRequest,
  SetSecretResponse,
} from '../secret-contracts';

describe('Secret Contracts', () => {
  it('models scoped key lifecycle request and success response payloads', () => {
    const setRequest: SetSecretRequest = {
      scope: 'runtime',
      name: 'api-token',
      value: 'secret-value',
    };
    const getRequest: GetSecretRequest = {
      scope: 'runtime',
      name: 'api-token',
    };
    const setResponse: SetSecretResponse = {
      success: true,
      secureStorageAvailable: true,
      scopedKey: 'secureclaw:runtime:api-token',
    };
    const getResponse: GetSecretResponse = {
      success: true,
      secureStorageAvailable: true,
      scopedKey: 'secureclaw:runtime:api-token',
      value: 'secret-value',
    };

    expect(setRequest.scope).toBe('runtime');
    expect(getRequest.name).toBe('api-token');
    expect(setResponse.scopedKey).toContain('secureclaw:runtime:');
    expect(getResponse.value).toBe('secret-value');
  });

  it('models secure-storage-unavailable remediation with diagnostics guidance', () => {
    const deleteScopeRequest: DeleteScopeSecretsRequest = {
      scope: 'support',
    };
    const unavailableError: SecretStoreError = {
      userMessage: 'Secure storage is unavailable.',
      nextSteps: [
        'Unlock your Keychain and retry.',
        'Open Settings > Health and export diagnostics if the issue persists.',
      ],
      retryable: false,
      errorCode: 'SECURE_STORAGE_UNAVAILABLE',
      technicalDetails: 'safeStorage.isEncryptionAvailable() returned false',
    };
    const deleteScopeResponse: DeleteScopeSecretsResponse = {
      success: false,
      secureStorageAvailable: false,
      deletedCount: 0,
      error: unavailableError,
    };

    expect(deleteScopeRequest.scope).toBe('support');
    expect(deleteScopeResponse.error?.nextSteps.join(' ')).toContain('diagnostics');
    expect(deleteScopeResponse.secureStorageAvailable).toBe(false);
  });
});
