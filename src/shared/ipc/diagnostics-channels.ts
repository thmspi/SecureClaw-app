import { z } from 'zod';

export const DIAGNOSTICS_CHANNELS = {
  getHealth: 'diagnostics:v1:getHealth',
  exportBundle: 'diagnostics:v1:exportBundle',
} as const;

export const getHealthSchema = z.object({
  forceRefresh: z.boolean().optional(),
});

export const exportBundleSchema = z.object({
  includeDays: z.number().int().positive().max(30).default(7),
});

export type GetHealthInput = z.infer<typeof getHealthSchema>;
export type ExportBundleInput = z.infer<typeof exportBundleSchema>;
