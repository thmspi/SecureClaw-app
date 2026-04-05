import { z } from 'zod';

export const CONFIGURATION_CHANNELS = {
  listDocuments: 'configuration:v1:listDocuments',
  loadDocument: 'configuration:v1:loadDocument',
  validateDocument: 'configuration:v1:validateDocument',
  saveDocument: 'configuration:v1:saveDocument',
  applyDocument: 'configuration:v1:applyDocument',
} as const;

export const configurationDocumentKindSchema = z.enum([
  'nemoclaw-policy',
  'openclaw-skill',
  'openclaw-agent-rules',
]);

export const configurationDocumentFormatSchema = z.enum(['yaml', 'markdown']);

export const configurationEditorModeSchema = z.enum(['visual', 'raw']);

export const configurationDocumentPayloadSchema = z.object({
  documentId: z.string().min(1),
  kind: configurationDocumentKindSchema,
  format: configurationDocumentFormatSchema,
  content: z.string(),
  editorMode: configurationEditorModeSchema,
  structuredContent: z.record(z.string(), z.unknown()).optional(),
  updatedAt: z.string().optional(),
});

export const listDocumentsSchema = z.object({
  kinds: z.array(configurationDocumentKindSchema).optional(),
});

export const loadDocumentSchema = z.object({
  documentId: z.string().min(1),
});

export const validateDocumentSchema = z.object({
  document: configurationDocumentPayloadSchema,
});

export const saveDocumentSchema = z.object({
  document: configurationDocumentPayloadSchema,
});

export const applyDocumentSchema = z.object({
  documentId: z.string().min(1),
  dryRun: z.boolean().optional(),
});

export type ConfigurationDocumentKindInput = z.infer<typeof configurationDocumentKindSchema>;
export type ConfigurationDocumentFormatInput = z.infer<typeof configurationDocumentFormatSchema>;
export type ConfigurationEditorModeInput = z.infer<typeof configurationEditorModeSchema>;
export type ConfigurationDocumentPayloadInput = z.infer<typeof configurationDocumentPayloadSchema>;
export type ListDocumentsInput = z.infer<typeof listDocumentsSchema>;
export type LoadDocumentInput = z.infer<typeof loadDocumentSchema>;
export type ValidateDocumentInput = z.infer<typeof validateDocumentSchema>;
export type SaveDocumentInput = z.infer<typeof saveDocumentSchema>;
export type ApplyDocumentInput = z.infer<typeof applyDocumentSchema>;
