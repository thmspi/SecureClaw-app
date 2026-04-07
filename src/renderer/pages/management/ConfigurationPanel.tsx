import { useEffect, useMemo, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import YAML from 'yaml';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  useConfigurationStore,
} from '@/stores/configuration-store';
import type {
  ConfigurationDocumentKind,
  ConfigurationValidationIssue,
} from '@shared/configuration/configuration-contracts';

interface MarkdownSection {
  heading: string;
  content: string;
}

interface MarkdownVisualModel {
  frontmatter: {
    name: string;
    description: string;
  };
  sections: MarkdownSection[];
}

const CONFIGURATION_CATEGORIES: Array<{
  title: string;
  kind: ConfigurationDocumentKind;
  showExplorer: boolean;
}> = [
  { title: 'NemoClaw Policy', kind: 'nemoclaw-policy', showExplorer: false },
  { title: 'Available Skills', kind: 'openclaw-skill', showExplorer: true },
  { title: 'Agent Rules', kind: 'openclaw-agent-rules', showExplorer: true },
];

const NEMOCLAW_POLICY_SCHEMA = {
  type: 'object',
  properties: {
    network_policies: {
      type: 'object',
      title: 'Network Policies',
      additionalProperties: {
        type: 'object',
        properties: {
          endpoints: {
            type: 'array',
            title: 'Endpoints',
            items: {
              type: 'object',
              properties: {
                host: { type: 'string' },
                port: { type: 'number' },
                protocol: { type: 'string' },
              },
              additionalProperties: true,
            },
          },
          binaries: {
            type: 'array',
            title: 'Binaries',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
              },
              additionalProperties: true,
            },
          },
          rules: {
            type: 'array',
            title: 'Rules',
            items: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: true,
} as const;

const MARKDOWN_SECTION_HEADER_REGEX = /^##\s+(.+)$/gm;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toPlainText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function splitSections(markdownBody: string): MarkdownSection[] {
  const matches = Array.from(markdownBody.matchAll(MARKDOWN_SECTION_HEADER_REGEX));
  if (matches.length === 0) {
    const fallback = markdownBody.trim();
    return fallback ? [{ heading: 'Overview', content: fallback }] : [];
  }

  const sections: MarkdownSection[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const heading = current[1]?.trim() ?? '';
    if (!heading) {
      continue;
    }

    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? markdownBody.length;
    sections.push({
      heading,
      content: markdownBody.slice(start, end).trim(),
    });
  }

  return sections;
}

function serializeSections(sections: MarkdownSection[]): string {
  return sections
    .map((section) => `## ${section.heading.trim()}\n${section.content.trim()}`.trimEnd())
    .join('\n\n')
    .trim();
}

function parseMarkdownFrontmatter(rawText: string): { data: Record<string, unknown>; content: string } {
  const normalizedRawText = rawText.replace(/\r\n/g, '\n');
  const match = normalizedRawText.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return {
      data: {},
      content: normalizedRawText,
    };
  }

  let data: Record<string, unknown> = {};
  try {
    const parsed = YAML.parse(match[1] ?? '');
    if (isRecord(parsed)) {
      data = parsed;
    }
  } catch {
    data = {};
  }

  return {
    data,
    content: normalizedRawText.slice(match[0].length),
  };
}

function serializeMarkdownFrontmatter(
  data: { name: string; description: string },
  body: string
): string {
  const yamlFrontmatter = YAML.stringify({
    name: data.name,
    description: data.description,
  }).trimEnd();
  const normalizedBody = body.trim();
  return `---\n${yamlFrontmatter}\n---\n\n${normalizedBody}\n`;
}

function toMarkdownVisualModel(
  kind: ConfigurationDocumentKind,
  rawText: string
): MarkdownVisualModel {
  let frontmatter = {
    name: '',
    description: '',
  };
  let body = rawText;

  if (kind === 'openclaw-skill') {
    const parsed = parseMarkdownFrontmatter(rawText);
    body = parsed.content;
    if (isRecord(parsed.data)) {
      frontmatter = {
        name: toPlainText(parsed.data.name),
        description: toPlainText(parsed.data.description),
      };
    }
  }

  return {
    frontmatter,
    sections: splitSections(body),
  };
}

function serializeMarkdownVisualModel(
  kind: ConfigurationDocumentKind,
  model: MarkdownVisualModel
): string {
  const body = serializeSections(model.sections);
  if (kind === 'openclaw-skill') {
    return serializeMarkdownFrontmatter(
      {
        name: model.frontmatter.name,
        description: model.frontmatter.description,
      },
      body
    );
  }

  return body ? `${body}\n` : '';
}

function sortIssues(issues: ConfigurationValidationIssue[]): ConfigurationValidationIssue[] {
  return [...issues].sort((left, right) => {
    const leftKey = [
      left.path ?? '',
      String(left.line ?? 0),
      String(left.column ?? 0),
      left.level,
      left.message,
    ].join('|');
    const rightKey = [
      right.path ?? '',
      String(right.line ?? 0),
      String(right.column ?? 0),
      right.level,
      right.message,
    ].join('|');
    return leftKey.localeCompare(rightKey);
  });
}

function formatIssuePath(pathValue: string | undefined): string | undefined {
  if (!pathValue) {
    return undefined;
  }
  if (pathValue.startsWith('frontmatter.')) {
    return pathValue.slice('frontmatter.'.length);
  }
  return pathValue;
}

function normalizeFileStem(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isRemovableWorkspaceDocument(documentId: string): boolean {
  return (
    documentId.startsWith('openclaw-skill:workspace:') ||
    documentId.startsWith('openclaw-agent-rules:workspace:')
  );
}

function createInitialDocumentPayload(
  kind: 'openclaw-skill' | 'openclaw-agent-rules',
  documentId: string
) {
  if (kind === 'openclaw-skill') {
    const name = documentId.split(':').pop() ?? 'new-skill';
    return {
      documentId,
      kind,
      format: 'markdown' as const,
      editorMode: 'raw' as const,
      content: ['---', `name: ${name}`, `description: ${name} description`, '---', '', '## Overview', ''].join('\n'),
    };
  }

  return {
    documentId,
    kind,
    format: 'markdown' as const,
    editorMode: 'raw' as const,
    content: ['## Rules', '', '- Add rule details here.', ''].join('\n'),
  };
}

export default function ConfigurationPanel() {
  const {
    documents,
    activeDocumentId,
    activeDocument,
    editorMode,
    rawText,
    visualModel,
    loading,
    validating,
    saving,
    applying,
    dirty,
    validationIssues,
    lastError,
    lastApplyResult,
    loadDocuments,
    openDocument,
    setEditorMode,
    setRawText,
    setVisualModel,
    validateActiveDocument,
    saveActiveDocument,
    applyActiveDocument,
  } = useConfigurationStore();

  const [selectedCategory, setSelectedCategory] =
    useState<ConfigurationDocumentKind>('nemoclaw-policy');
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [createFileError, setCreateFileError] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [markdownVisualModel, setMarkdownVisualModel] = useState<MarkdownVisualModel | null>(null);
  const [saveConfirmation, setSaveConfirmation] = useState<string | null>(null);

  const activeCategory = useMemo(
    () =>
      CONFIGURATION_CATEGORIES.find((category) => category.kind === selectedCategory) ??
      CONFIGURATION_CATEGORIES[0],
    [selectedCategory]
  );

  const categoryDocuments = useMemo(
    () => documents.filter((document) => document.kind === selectedCategory),
    [documents, selectedCategory]
  );

  const activeSummary = useMemo(
    () => documents.find((document) => document.documentId === activeDocumentId),
    [documents, activeDocumentId]
  );

  const categoryActiveDocument =
    activeDocument && activeDocument.kind === selectedCategory ? activeDocument : null;
  const categoryActiveSummary = categoryActiveDocument ? activeSummary : undefined;

  const isNemoDocument = categoryActiveDocument?.kind === 'nemoclaw-policy';
  const isMarkdownDocument = categoryActiveDocument?.format === 'markdown';

  useEffect(() => {
    if (!categoryActiveDocument || !isMarkdownDocument || editorMode !== 'visual') {
      setMarkdownVisualModel(null);
      return;
    }

    setMarkdownVisualModel(toMarkdownVisualModel(categoryActiveDocument.kind, rawText));
  }, [
    categoryActiveDocument?.documentId,
    categoryActiveDocument?.kind,
    isMarkdownDocument,
    editorMode,
  ]);

  const sortedIssues = useMemo(() => sortIssues(validationIssues), [validationIssues]);
  const hasValidationWarnings = sortedIssues.length > 0 || Boolean(lastError);

  const validationBadge = useMemo(() => {
    if (!categoryActiveDocument) {
      return null;
    }
    if (validating) {
      return { label: 'Validating', className: 'border-amber-300 bg-amber-50 text-amber-900' };
    }
    if (hasValidationWarnings) {
      return { label: 'Warnings', className: 'border-destructive/40 bg-destructive/10 text-destructive' };
    }
    return { label: 'Pass', className: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-800' };
  }, [categoryActiveDocument, dirty, validating, hasValidationWarnings]);

  useEffect(() => {
    if (activeDocument?.kind) {
      setSelectedCategory(activeDocument.kind);
    }
  }, [activeDocument?.kind]);

  useEffect(() => {
    setCreateFileError(null);
    setNewFileName('');
    setCreateFormOpen(false);
    setSaveConfirmation(null);
  }, [selectedCategory]);

  useEffect(() => {
    if (categoryDocuments.length === 0) {
      return;
    }

    if (!activeDocumentId || !categoryDocuments.some((document) => document.documentId === activeDocumentId)) {
      void openDocument(categoryDocuments[0].documentId);
    }
  }, [activeDocumentId, categoryDocuments, openDocument]);

  useEffect(() => {
    if (!saveConfirmation) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSaveConfirmation(null);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [saveConfirmation]);

  useEffect(() => {
    if (!categoryActiveDocument || !dirty || loading || saving || applying || validating) {
      return;
    }

    const timer = window.setTimeout(() => {
      void validateActiveDocument();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    categoryActiveDocument?.documentId,
    rawText,
    visualModel,
    dirty,
    loading,
    saving,
    applying,
    validateActiveDocument,
  ]);

  const handleCreateFile = async (rawName: string): Promise<void> => {
    if (!activeCategory.showExplorer || creatingFile) {
      return;
    }

    const fileStem = normalizeFileStem(rawName);
    if (!fileStem) {
      setCreateFileError('File name must contain at least one letter or number.');
      return;
    }

    const createKind = selectedCategory as 'openclaw-skill' | 'openclaw-agent-rules';
    const documentId =
      createKind === 'openclaw-skill'
        ? `openclaw-skill:workspace:${fileStem}`
        : `openclaw-agent-rules:workspace:${fileStem}`;

    if (documents.some((document) => document.documentId === documentId)) {
      setCreateFileError(`A file named "${fileStem}" already exists.`);
      return;
    }

    setCreatingFile(true);
    setCreateFileError(null);
    try {
      const response = await window.secureClaw.configuration.saveDocument({
        document: createInitialDocumentPayload(createKind, documentId),
      });

      if (!response.saved || !response.document) {
        setCreateFileError(response.error?.userMessage ?? 'Unable to create file.');
        return;
      }

      await loadDocuments();
      await openDocument(response.document.documentId);
      setNewFileName('');
      setCreateFormOpen(false);
    } catch (error) {
      setCreateFileError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingFile(false);
    }
  };

  const handleRemoveFile = async (documentId: string): Promise<void> => {
    if (deletingDocumentId || !isRemovableWorkspaceDocument(documentId)) {
      return;
    }

    setDeletingDocumentId(documentId);
    setCreateFileError(null);
    try {
      const response = await window.secureClaw.configuration.deleteDocument({ documentId });
      if (!response.deleted) {
        setCreateFileError(response.error?.userMessage ?? 'Unable to remove file.');
        return;
      }

      await loadDocuments();
    } catch (error) {
      setCreateFileError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleUpdateMarkdownVisualModel = (
    update: (current: MarkdownVisualModel) => MarkdownVisualModel
  ): void => {
    if (!categoryActiveDocument || !isMarkdownDocument) {
      return;
    }

    const baseModel = markdownVisualModel ?? toMarkdownVisualModel(categoryActiveDocument.kind, rawText);
    const nextModel = update(baseModel);
    const normalizedModel: MarkdownVisualModel = {
      frontmatter: {
        name: nextModel.frontmatter.name,
        description: nextModel.frontmatter.description,
      },
      sections: nextModel.sections.map((section) => ({
        heading: section.heading,
        content: section.content,
      })),
    };
    setMarkdownVisualModel(normalizedModel);
  };

  const handleSaveDocument = async (): Promise<void> => {
    const response = await saveActiveDocument();
    if (response?.saved) {
      const label = categoryActiveSummary?.displayName ?? 'File';
      setSaveConfirmation(`${label} saved.`);
      return;
    }
    setSaveConfirmation(null);
  };

  useEffect(() => {
    if (!categoryActiveDocument || !isMarkdownDocument || editorMode !== 'visual' || !markdownVisualModel) {
      return;
    }

    const serialized = serializeMarkdownVisualModel(categoryActiveDocument.kind, markdownVisualModel);
    if (serialized !== rawText) {
      setRawText(serialized);
    }
  }, [
    categoryActiveDocument?.documentId,
    categoryActiveDocument?.kind,
    isMarkdownDocument,
    editorMode,
    markdownVisualModel,
    rawText,
    setRawText,
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {CONFIGURATION_CATEGORIES.map((category) => (
              <Button
                key={category.kind}
                variant={selectedCategory === category.kind ? 'secondary' : 'outline'}
                onClick={() => {
                  setSelectedCategory(category.kind);
                  const nextDocument = documents.find((document) => document.kind === category.kind);
                  if (nextDocument) {
                    void openDocument(nextDocument.documentId);
                  }
                }}
              >
                {category.title}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{categoryActiveSummary?.displayName ?? activeCategory.title}</p>
              {categoryActiveSummary?.path ? (
                <p className="truncate text-xs text-muted-foreground">{categoryActiveSummary.path}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No file selected yet.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={!categoryActiveDocument || loading}
                onClick={() => setEditorMode(editorMode === 'visual' ? 'raw' : 'visual')}
              >
                <span className="mr-2">Visual</span>
                <span className="relative inline-flex h-5 w-10 items-center rounded-full border bg-background">
                  <span
                    className={cn(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-foreground transition',
                      editorMode === 'raw' ? 'translate-x-5' : 'translate-x-1'
                    )}
                  />
                </span>
                <span className="ml-2">Text</span>
              </Button>
              <Button
                variant="outline"
                disabled={!categoryActiveDocument || saving || loading}
                onClick={() => void handleSaveDocument()}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              {validationBadge ? (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium',
                    validationBadge.className
                  )}
                >
                  {validationBadge.label}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isNemoDocument ? (
              <Button
                disabled={!categoryActiveDocument || applying || loading}
                onClick={() => void applyActiveDocument('dynamic')}
              >
                {applying ? 'Applying...' : 'Apply Policy'}
              </Button>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            'grid gap-4',
            activeCategory.showExplorer ? 'lg:grid-cols-[280px,1fr]' : 'lg:grid-cols-1'
          )}
        >
          {activeCategory.showExplorer ? (
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {activeCategory.title} Files
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={creatingFile || loading}
                  onClick={() => {
                    setCreateFileError(null);
                    setCreateFormOpen((value) => !value);
                  }}
                >
                  {createFormOpen ? 'Close' : 'New File'}
                </Button>
              </div>
              {createFormOpen ? (
                <div className="mb-3 flex items-center gap-2">
                  <Input
                    value={newFileName}
                    placeholder={
                      selectedCategory === 'openclaw-skill' ? 'skill-folder-name' : 'rule-file-name'
                    }
                    onChange={(event) => setNewFileName(event.target.value)}
                    disabled={creatingFile || loading}
                  />
                  <Button
                    size="sm"
                    disabled={creatingFile || loading || newFileName.trim().length === 0}
                    onClick={() => void handleCreateFile(newFileName)}
                  >
                    {creatingFile ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              ) : null}
              <div className="space-y-2">
                {categoryDocuments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No files found for this category.</p>
                ) : null}
                {categoryDocuments.map((document) => (
                  <div
                    key={document.documentId}
                    className={cn(
                      'rounded-md border p-2 text-sm transition',
                      document.documentId === activeDocumentId
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => void openDocument(document.documentId)}
                      >
                        <p className="font-medium">{document.displayName}</p>
                        {document.path ? (
                          <p className="truncate text-xs text-muted-foreground">{document.path}</p>
                        ) : null}
                      </button>
                      {isRemovableWorkspaceDocument(document.documentId) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(deletingDocumentId) || loading}
                          onClick={() => void handleRemoveFile(document.documentId)}
                        >
                          {deletingDocumentId === document.documentId ? 'Removing...' : 'Remove'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              {createFileError ? (
                <p className="mt-3 text-xs text-destructive">{createFileError}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-4">
            {!categoryActiveDocument ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {activeCategory.showExplorer
                  ? 'Select a file from the explorer to start editing.'
                  : 'No NemoClaw policy document was found to edit.'}
              </div>
            ) : null}

            {categoryActiveDocument && editorMode === 'raw' ? (
              <div className="overflow-hidden rounded-md border">
                <MonacoEditor
                  height="460px"
                  language={isNemoDocument ? 'yaml' : 'markdown'}
                  value={rawText}
                  onChange={(value) => setRawText(value ?? '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    wordWrap: 'on',
                    lineNumbersMinChars: 3,
                  }}
                />
              </div>
            ) : null}

            {categoryActiveDocument && editorMode === 'visual' && isNemoDocument ? (
              <div className="rounded-md border p-3">
                <Form
                  schema={NEMOCLAW_POLICY_SCHEMA}
                  validator={validator}
                  formData={isRecord(visualModel) ? visualModel : {}}
                  uiSchema={{
                    'ui:submitButtonOptions': {
                      norender: true,
                    },
                  }}
                  onChange={(event) => {
                    const nextModel = isRecord(event.formData) ? event.formData : {};
                    setVisualModel(nextModel);
                  }}
                >
                  <></>
                </Form>
              </div>
            ) : null}

            {categoryActiveDocument &&
            editorMode === 'visual' &&
            isMarkdownDocument &&
            markdownVisualModel ? (
              <div className="space-y-4 rounded-md border p-3">
                {categoryActiveDocument.kind === 'openclaw-skill' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Name</span>
                      <Input
                        value={markdownVisualModel.frontmatter.name}
                        onChange={(event) => {
                          const value = event.target.value;
                          handleUpdateMarkdownVisualModel((current) => ({
                            ...current,
                            frontmatter: {
                              ...current.frontmatter,
                              name: value,
                            },
                          }));
                        }}
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Description</span>
                      <Input
                        value={markdownVisualModel.frontmatter.description}
                        onChange={(event) => {
                          const value = event.target.value;
                          handleUpdateMarkdownVisualModel((current) => ({
                            ...current,
                            frontmatter: {
                              ...current.frontmatter,
                              description: value,
                            },
                          }));
                        }}
                      />
                    </label>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {markdownVisualModel.sections.map((section, index) => (
                    <div key={`section-${index}`} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Input
                          value={section.heading}
                          placeholder="Section heading"
                          onChange={(event) => {
                            const value = event.target.value;
                            handleUpdateMarkdownVisualModel((current) => ({
                              ...current,
                              sections: current.sections.map((currentSection, currentIndex) =>
                                currentIndex === index
                                  ? {
                                      ...currentSection,
                                      heading: value,
                                    }
                                  : currentSection
                              ),
                            }));
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleUpdateMarkdownVisualModel((current) => ({
                              ...current,
                              sections: current.sections.filter((_, currentIndex) => currentIndex !== index),
                            }));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                      <textarea
                        className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
                        value={section.content}
                        onChange={(event) => {
                          const value = event.target.value;
                          handleUpdateMarkdownVisualModel((current) => ({
                            ...current,
                            sections: current.sections.map((currentSection, currentIndex) =>
                              currentIndex === index
                                ? {
                                    ...currentSection,
                                    content: value,
                                  }
                                : currentSection
                            ),
                          }));
                        }}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleUpdateMarkdownVisualModel((current) => ({
                        ...current,
                        sections: [...current.sections, { heading: 'New Section', content: '' }],
                      }));
                    }}
                  >
                    Add Section
                  </Button>
                </div>
              </div>
            ) : null}

            {sortedIssues.length > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="size-4" />
                  Validation Issues
                </div>
                <ol className="space-y-1 text-sm">
                  {sortedIssues.map((issue, index) => {
                    const pathLabel = formatIssuePath(issue.path);
                    return (
                      <li key={`${issue.path ?? 'root'}-${issue.message}-${index}`}>
                        [{issue.level}] {pathLabel ? `${pathLabel}: ` : ''}
                        {issue.message}
                        {typeof issue.line === 'number'
                          ? ` (line ${issue.line}${typeof issue.column === 'number' ? `:${issue.column}` : ''})`
                          : ''}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}

            {lastError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {lastError.userMessage}
              </div>
            ) : null}

            {lastApplyResult?.applied ? (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800">
                Configuration applied successfully.
              </div>
            ) : null}

            {saveConfirmation ? (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800">
                {saveConfirmation}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
