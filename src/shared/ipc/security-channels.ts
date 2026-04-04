import { z } from 'zod';

export const SECURITY_CHANNELS = {
  set: 'secrets:v1:set',
  get: 'secrets:v1:get',
  delete: 'secrets:v1:delete',
  deleteScope: 'secrets:v1:deleteScope',
} as const;

export const setSecretSchema = z.object({
  scope: z.string().min(1),
  name: z.string().min(1),
  value: z.string().min(1),
});

export const getSecretSchema = z.object({
  scope: z.string().min(1),
  name: z.string().min(1),
});

export const deleteSecretSchema = z.object({
  scope: z.string().min(1),
  name: z.string().min(1),
});

export const deleteScopeSecretsSchema = z.object({
  scope: z.string().min(1),
});

export type SetSecretInput = z.infer<typeof setSecretSchema>;
export type GetSecretInput = z.infer<typeof getSecretSchema>;
export type DeleteSecretInput = z.infer<typeof deleteSecretSchema>;
export type DeleteScopeSecretsInput = z.infer<typeof deleteScopeSecretsSchema>;
