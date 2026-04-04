export type SecretScope = 'runtime' | 'install' | 'plugin' | 'support';

// Namespaced key format rule: secureclaw:{scope}:{name}
export type SecretScopedKey = `secureclaw:${SecretScope}:${string}`;

export interface SecretStoreError {
  userMessage: string;
  nextSteps: string[];
  retryable: boolean;
  errorCode: string;
  technicalDetails?: string;
}

export interface SetSecretRequest {
  scope: SecretScope;
  name: string;
  value: string;
}

export interface SetSecretResponse {
  success: boolean;
  secureStorageAvailable: boolean;
  scopedKey: SecretScopedKey;
  error?: SecretStoreError;
}

export interface GetSecretRequest {
  scope: SecretScope;
  name: string;
}

export interface GetSecretResponse {
  success: boolean;
  secureStorageAvailable: boolean;
  scopedKey: SecretScopedKey;
  value?: string;
  error?: SecretStoreError;
}

export interface DeleteSecretRequest {
  scope: SecretScope;
  name: string;
}

export interface DeleteSecretResponse {
  success: boolean;
  secureStorageAvailable: boolean;
  scopedKey: SecretScopedKey;
  deleted: boolean;
  error?: SecretStoreError;
}

export interface DeleteScopeSecretsRequest {
  scope: SecretScope;
}

export interface DeleteScopeSecretsResponse {
  success: boolean;
  secureStorageAvailable: boolean;
  deletedCount: number;
  error?: SecretStoreError;
}
