import { useMemo } from 'react';
import MonacoEditor from '@monaco-editor/react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import matter from 'gray-matter';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  useConfigurationStore,
  type ConfigurationVisualModel,
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

const DOCUMENT_GROUPS: Array<{ title: string; kind: ConfigurationDocumentKind }> = [
  { title: 'NemoClaw Policy', kind: 'nemoclaw-policy' },
  { title: 'Available Skills', kind: 'openclaw-skill' },
  { title: 'Agent Rules', kind: 'openclaw-agent-rules' },
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

function normalizeSections(value: unknown): MarkdownSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      return {
        heading: toPlainText(entry.heading).trim(),
        content: toPlainText(entry.content),
      };
    })
    .filter((entry): entry is MarkdownSection => Boolean(entry) && Boolean(entry.heading));
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

function toMarkdownVisualModel(
  kind: ConfigurationDocumentKind,
  rawText: string,
  visualModel: ConfigurationVisualModel
): MarkdownVisualModel {
  let frontmatter = {
    name: '',
    description: '',
  };
  let body = rawText;

  if (kind === 'openclaw-skill') {
    const parsed = matter(rawText);
    body = parsed.content;
    if (isRecord(parsed.data)) {
      frontmatter = {
        name: toPlainText(parsed.data.name),
        description: toPlainText(parsed.data.description),
      };
    }
  }

  let sections = splitSections(body);
  if (isRecord(visualModel)) {
    if (isRecord(visualModel.frontmatter)) {
      frontmatter = {
        name: toPlainText(visualModel.frontmatter.name),
        description: toPlainText(visualModel.frontmatter.description),
      };
    }

    const modelSections = normalizeSections(visualModel.sections);
    if (modelSections.length > 0) {
      sections = modelSections;
    }
  }

  return {
    frontmatter,
    sections,
  };
}

function serializeMarkdownVisualModel(
  kind: ConfigurationDocumentKind,
  model: MarkdownVisualModel
): string {
  const body = serializeSections(model.sections);
  if (kind === 'openclaw-skill') {
    return matter.stringify(body, {
      name: model.frontmatter.name,
      description: model.frontmatter.description,
    });
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
    openDocument,
    setEditorMode,
    setRawText,
    setVisualModel,
    validateActiveDocument,
    saveActiveDocument,
    applyActiveDocument,
    resetDraft,
  } = useConfigurationStore();

  const groupedDocuments = useMemo(
    () =>
      DOCUMENT_GROUPS.map((group) => ({
        ...group,
        items: documents.filter((document) => document.kind === group.kind),
      })),
    [documents]
  );

  const activeSummary = useMemo(
    () => documents.find((document) => document.documentId === activeDocumentId),
    [documents, activeDocumentId]
  );

  const isNemoDocument = activeDocument?.kind === 'nemoclaw-policy';
  const isMarkdownDocument = activeDocument?.format === 'markdown';
  const workspaceUnavailable =
    activeSummary?.description?.toLowerCase().includes('workspace path') ?? false;

  const markdownVisualModel = useMemo(() => {
    if (!activeDocument || !isMarkdownDocument) {
      return null;
    }
    return toMarkdownVisualModel(activeDocument.kind, rawText, visualModel);
  }, [activeDocument, isMarkdownDocument, rawText, visualModel]);

  const sortedIssues = useMemo(() => sortIssues(validationIssues), [validationIssues]);

  const handleUpdateMarkdownVisualModel = (
    update: (current: MarkdownVisualModel) => MarkdownVisualModel
  ): void => {
    if (!activeDocument || !isMarkdownDocument || !markdownVisualModel) {
      return;
    }

    const nextModel = update(markdownVisualModel);
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
    const serialized = serializeMarkdownVisualModel(activeDocument.kind, normalizedModel);

    setVisualModel({
      frontmatter: normalizedModel.frontmatter,
      sections: normalizedModel.sections,
    });
    setRawText(serialized);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={editorMode === 'visual' ? 'secondary' : 'outline'}
            disabled={!activeDocument || loading}
            onClick={() => setEditorMode('visual')}
          >
            Visual
          </Button>
          <Button
            variant={editorMode === 'raw' ? 'secondary' : 'outline'}
            disabled={!activeDocument || loading}
            onClick={() => setEditorMode('raw')}
          >
            Raw
          </Button>
          <Button
            variant="outline"
            disabled={!activeDocument || validating || loading}
            onClick={() => void validateActiveDocument()}
          >
            {validating ? 'Validating...' : 'Validate'}
          </Button>
          <Button
            variant="outline"
            disabled={!activeDocument || saving || loading}
            onClick={() => void saveActiveDocument()}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            disabled={!activeDocument || applying || loading}
            onClick={() => void applyActiveDocument('static')}
          >
            {applying && !isNemoDocument ? 'Applying...' : 'Apply Static'}
          </Button>
          {isNemoDocument ? (
            <Button
              variant="outline"
              disabled={!activeDocument || applying || loading}
              onClick={() => void applyActiveDocument('dynamic')}
            >
              {applying ? 'Applying...' : 'Apply Dynamic'}
            </Button>
          ) : null}
          <Button variant="ghost" disabled={!dirty || loading} onClick={() => resetDraft()}>
            Reset Draft
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
          <div className="rounded-lg border bg-card p-3">
            {groupedDocuments.map((group) => (
              <section key={group.kind} className="mb-4 last:mb-0">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No documents found.</p>
                  ) : null}
                  {group.items.map((document) => (
                    <button
                      key={document.documentId}
                      type="button"
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-left text-sm transition',
                        document.documentId === activeDocumentId
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                      onClick={() => void openDocument(document.documentId)}
                    >
                      <p className="font-medium">{document.displayName}</p>
                      {document.path ? (
                        <p className="truncate text-xs text-muted-foreground">{document.path}</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="space-y-4">
            {!activeDocument ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Select a document from the left panel to start editing.
              </div>
            ) : null}

            {isNemoDocument ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p>Install NemoClaw CLI to apply static sandbox policy.</p>
                <p>Install OpenShell CLI to apply dynamic sandbox policy.</p>
              </div>
            ) : null}

            {workspaceUnavailable ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p>
                  OpenClaw workspace path is unavailable. Set OPENCLAW_WORKSPACE_DIR or create
                  ~/.openclaw/workspace.
                </p>
              </div>
            ) : null}

            {activeDocument && editorMode === 'raw' ? (
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

            {activeDocument && editorMode === 'visual' && isNemoDocument ? (
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

            {activeDocument && editorMode === 'visual' && isMarkdownDocument && markdownVisualModel ? (
              <div className="space-y-4 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">frontmatter.name</span>
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
                    <span className="font-medium">frontmatter.description</span>
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

                <div className="space-y-3">
                  {markdownVisualModel.sections.map((section, index) => (
                    <div key={`${section.heading}-${index}`} className="rounded-md border p-3">
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
                  {sortedIssues.map((issue, index) => (
                    <li key={`${issue.path ?? 'root'}-${issue.message}-${index}`}>
                      [{issue.level}] {issue.path ? `${issue.path}: ` : ''}
                      {issue.message}
                      {typeof issue.line === 'number'
                        ? ` (line ${issue.line}${typeof issue.column === 'number' ? `:${issue.column}` : ''})`
                        : ''}
                    </li>
                  ))}
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
