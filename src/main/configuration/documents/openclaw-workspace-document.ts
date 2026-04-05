import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir as osHomedir } from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';

import type {
  ApplyDocumentRequest,
  ApplyDocumentResponse,
  ConfigurationDocumentSummary,
  ConfigurationDocumentPayload,
  ConfigurationValidationIssue,
  ConfigurationOperationError,
  LoadDocumentRequest,
  LoadDocumentResponse,
  SaveDocumentRequest,
  SaveDocumentResponse,
  ValidateDocumentRequest,
  ValidateDocumentResponse,
} from '../../../shared/configuration/configuration-contracts';

const OPENCLAW_SKILL_GLOBAL_PREFIX = 'openclaw-skill:global:';
const OPENCLAW_SKILL_WORKSPACE_PREFIX = 'openclaw-skill:workspace:';
const OPENCLAW_AGENT_RULES_WORKSPACE_DOCUMENT_ID = 'openclaw-agent-rules:workspace';

const CONFIG_PATH_UNAVAILABLE = 'CONFIG_PATH_UNAVAILABLE';
const CONFIG_VALIDATION_FAILED = 'CONFIG_VALIDATION_FAILED';

interface WorkspaceFsDeps {
  existsSync: (targetPath: string) => boolean;
  readdirSync: (targetPath: string, options: { withFileTypes: true }) => Array<{
    name: string;
    isDirectory: () => boolean;
  }>;
  readFile: (targetPath: string, encoding: BufferEncoding) => Promise<string>;
  writeFile: (targetPath: string, content: string, encoding: BufferEncoding) => Promise<void>;
}

interface OpenClawWorkspaceAdapterDeps {
  fs?: WorkspaceFsDeps;
  homedir?: () => string;
  env?: NodeJS.ProcessEnv;
}

interface ResolvedPaths {
  workspaceRoot: string;
  globalSkillsRoot: string;
  workspaceSkillsRoot: string;
  workspaceAgentsPath: string;
}

interface ResolvedDocumentTarget {
  kind: 'openclaw-skill' | 'openclaw-agent-rules';
  path: string;
  requiresWorkspace: boolean;
  workspaceRoot: string;
}

const DEFAULT_FS_DEPS: WorkspaceFsDeps = {
  existsSync,
  readdirSync,
  readFile,
  writeFile,
};

const createPathUnavailableError = (missingPath: string): ConfigurationOperationError => ({
  errorCode: CONFIG_PATH_UNAVAILABLE,
  userMessage: `Configuration path is unavailable: ${missingPath}`,
});

const createValidationIssue = (message: string, pathValue: string): ConfigurationValidationIssue => ({
  level: 'error',
  message,
  path: pathValue,
  code: CONFIG_VALIDATION_FAILED,
});

const readFrontmatter = (content: string): Record<string, unknown> => {
  const parsed = matter(content);
  if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
    return parsed.data as Record<string, unknown>;
  }

  return {};
};

const sectionHeader = /^##\s+(.+)$/gm;

const splitSections = (markdown: string): Array<{ heading: string; content: string }> => {
  const matches = Array.from(markdown.matchAll(sectionHeader));
  if (matches.length === 0) {
    const trimmed = markdown.trim();
    if (!trimmed) {
      return [];
    }
    return [
      {
        heading: 'Overview',
        content: trimmed,
      },
    ];
  }

  const sections: Array<{ heading: string; content: string }> = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const heading = current[1]?.trim() ?? '';
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? markdown.length;
    const content = markdown.slice(start, end).trim();
    sections.push({
      heading,
      content,
    });
  }

  return sections;
};

const serializeSections = (sections: unknown): string => {
  if (!Array.isArray(sections)) {
    return '';
  }

  const serialized = sections
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const section = entry as Record<string, unknown>;
      const heading = typeof section.heading === 'string' ? section.heading.trim() : '';
      const content = typeof section.content === 'string' ? section.content.trim() : '';
      if (!heading) {
        return null;
      }

      return `## ${heading}\n${content}`.trimEnd();
    })
    .filter((entry): entry is string => Boolean(entry));

  return serialized.join('\n\n').trim();
};

const resolvePaths = (homedirFn: () => string, env: NodeJS.ProcessEnv): ResolvedPaths => {
  const homeDirectory = homedirFn();
  const workspaceRoot = env.OPENCLAW_WORKSPACE_DIR?.trim() || path.join(homeDirectory, '.openclaw', 'workspace');
  return {
    workspaceRoot,
    globalSkillsRoot: path.join(homeDirectory, '.openclaw', 'skills'),
    workspaceSkillsRoot: path.join(workspaceRoot, 'skills'),
    workspaceAgentsPath: path.join(workspaceRoot, 'AGENTS.md'),
  };
};

const resolveDocumentTarget = (documentId: string, paths: ResolvedPaths): ResolvedDocumentTarget | undefined => {
  if (documentId === OPENCLAW_AGENT_RULES_WORKSPACE_DOCUMENT_ID) {
    return {
      kind: 'openclaw-agent-rules',
      path: paths.workspaceAgentsPath,
      requiresWorkspace: true,
      workspaceRoot: paths.workspaceRoot,
    };
  }

  if (documentId.startsWith(OPENCLAW_SKILL_GLOBAL_PREFIX)) {
    const skillName = documentId.slice(OPENCLAW_SKILL_GLOBAL_PREFIX.length);
    if (!skillName) {
      return undefined;
    }

    return {
      kind: 'openclaw-skill',
      path: path.join(paths.globalSkillsRoot, skillName, 'SKILL.md'),
      requiresWorkspace: false,
      workspaceRoot: paths.workspaceRoot,
    };
  }

  if (documentId.startsWith(OPENCLAW_SKILL_WORKSPACE_PREFIX)) {
    const skillName = documentId.slice(OPENCLAW_SKILL_WORKSPACE_PREFIX.length);
    if (!skillName) {
      return undefined;
    }

    return {
      kind: 'openclaw-skill',
      path: path.join(paths.workspaceSkillsRoot, skillName, 'SKILL.md'),
      requiresWorkspace: true,
      workspaceRoot: paths.workspaceRoot,
    };
  }

  return undefined;
};

const discoverSkills = (rootPath: string, prefix: string, fsDeps: WorkspaceFsDeps): ConfigurationDocumentSummary[] => {
  if (!fsDeps.existsSync(rootPath)) {
    return [];
  }

  try {
    const directories = fsDeps
      .readdirSync(rootPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((entry) => fsDeps.existsSync(path.join(rootPath, entry, 'SKILL.md')))
      .sort((left, right) => left.localeCompare(right));

    return directories.map((skillFolder) => ({
      documentId: `${prefix}${skillFolder}`,
      displayName: skillFolder,
      kind: 'openclaw-skill' as const,
      format: 'markdown' as const,
      editorModes: ['visual', 'raw'] as const,
      description: 'Edit OpenClaw skill metadata and markdown instructions.',
      path: path.join(rootPath, skillFolder, 'SKILL.md'),
    }));
  } catch {
    return [];
  }
};

const validateSkillPayload = (document: ConfigurationDocumentPayload): ValidateDocumentResponse => {
  const frontmatter = readFrontmatter(document.content);
  const issues: ConfigurationValidationIssue[] = [];

  const name = frontmatter.name;
  if (typeof name !== 'string' || !name.trim()) {
    issues.push(createValidationIssue('Skill frontmatter field "name" is required.', 'frontmatter.name'));
  }

  const description = frontmatter.description;
  if (typeof description !== 'string' || !description.trim()) {
    issues.push(createValidationIssue('Skill frontmatter field "description" is required.', 'frontmatter.description'));
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};

const validateAgentRulesPayload = (document: ConfigurationDocumentPayload): ValidateDocumentResponse => {
  if (!document.content.trim()) {
    return {
      valid: false,
      issues: [createValidationIssue('Agent rules markdown body must not be empty.', 'content')],
    };
  }

  return {
    valid: true,
    issues: [],
  };
};

const createStructuredContent = (rawText: string, frontmatterInput: Record<string, unknown>, body: string) => ({
  rawText,
  visualModel: {
    frontmatter: frontmatterInput,
    sections: splitSections(body),
  },
  format: 'markdown',
});

const createNotFoundError = (documentId: string): ConfigurationOperationError => ({
  errorCode: 'CONFIG_DOCUMENT_NOT_FOUND',
  userMessage: `Configuration document "${documentId}" was not found.`,
});

const ensurePathAvailability = (
  target: ResolvedDocumentTarget,
  fsDeps: WorkspaceFsDeps
): ConfigurationOperationError | undefined => {
  if (target.requiresWorkspace && !fsDeps.existsSync(target.workspaceRoot)) {
    return createPathUnavailableError(target.workspaceRoot);
  }

  if (!fsDeps.existsSync(target.path)) {
    return createPathUnavailableError(target.path);
  }

  return undefined;
};

const serializeSkillContent = (document: ConfigurationDocumentPayload): string => {
  if (
    document.editorMode === 'visual' &&
    document.structuredContent &&
    typeof document.structuredContent === 'object' &&
    !Array.isArray(document.structuredContent)
  ) {
    const visualModel = (document.structuredContent as Record<string, unknown>).visualModel;
    if (visualModel && typeof visualModel === 'object' && !Array.isArray(visualModel)) {
      const model = visualModel as Record<string, unknown>;
      const frontmatterData = model.frontmatter;
      const sections = model.sections;
      const parsedFrontmatter =
        frontmatterData && typeof frontmatterData === 'object' && !Array.isArray(frontmatterData)
          ? (frontmatterData as Record<string, unknown>)
          : {};

      return matter.stringify(serializeSections(sections), parsedFrontmatter);
    }
  }

  const parsed = matter(document.content);
  return matter.stringify(parsed.content, parsed.data);
};

export const createOpenClawWorkspaceAdapter = (deps: OpenClawWorkspaceAdapterDeps = {}) => {
  const fsDeps = deps.fs ?? DEFAULT_FS_DEPS;
  const homedirFn = deps.homedir ?? osHomedir;
  const env = deps.env ?? process.env;

  return {
    listDocuments(): ConfigurationDocumentSummary[] {
      const paths = resolvePaths(homedirFn, env);
      const workspaceAvailable = fsDeps.existsSync(paths.workspaceRoot);
      const workspaceDescription = workspaceAvailable
        ? 'Edit OpenClaw agent rules and standing orders.'
        : `Unavailable: workspace path ${paths.workspaceRoot} does not exist. Create it or set OPENCLAW_WORKSPACE_DIR.`;

      return [
        {
          documentId: OPENCLAW_AGENT_RULES_WORKSPACE_DOCUMENT_ID,
          displayName: 'OpenClaw Agent Rules',
          kind: 'openclaw-agent-rules',
          format: 'markdown',
          editorModes: ['visual', 'raw'],
          description: workspaceDescription,
          path: paths.workspaceAgentsPath,
        },
        ...discoverSkills(paths.globalSkillsRoot, OPENCLAW_SKILL_GLOBAL_PREFIX, fsDeps),
        ...discoverSkills(paths.workspaceSkillsRoot, OPENCLAW_SKILL_WORKSPACE_PREFIX, fsDeps),
      ];
    },

    async loadDocument(request: LoadDocumentRequest): Promise<LoadDocumentResponse> {
      const paths = resolvePaths(homedirFn, env);
      const target = resolveDocumentTarget(request.documentId, paths);
      if (!target) {
        return {
          error: createNotFoundError(request.documentId),
        };
      }

      const pathError = ensurePathAvailability(target, fsDeps);
      if (pathError) {
        return {
          error: pathError,
        };
      }

      const rawText = await fsDeps.readFile(target.path, 'utf8');
      if (target.kind === 'openclaw-skill') {
        const parsed = matter(rawText);
        return {
          document: {
            documentId: request.documentId,
            kind: 'openclaw-skill',
            format: 'markdown',
            content: rawText,
            editorMode: 'raw',
            structuredContent: createStructuredContent(rawText, readFrontmatter(rawText), parsed.content),
          },
        };
      }

      return {
        document: {
          documentId: request.documentId,
          kind: 'openclaw-agent-rules',
          format: 'markdown',
          content: rawText,
          editorMode: 'raw',
          structuredContent: createStructuredContent(rawText, {}, rawText),
        },
      };
    },

    async validateDocument(request: ValidateDocumentRequest): Promise<ValidateDocumentResponse> {
      if (request.document.kind === 'openclaw-skill') {
        return validateSkillPayload(request.document);
      }

      return validateAgentRulesPayload(request.document);
    },

    async saveDocument(request: SaveDocumentRequest): Promise<SaveDocumentResponse> {
      const validation = await this.validateDocument({ document: request.document });
      if (!validation.valid) {
        return {
          saved: false,
          error: {
            errorCode: CONFIG_VALIDATION_FAILED,
            userMessage: 'Document validation failed.',
          },
        };
      }

      const paths = resolvePaths(homedirFn, env);
      const target = resolveDocumentTarget(request.document.documentId, paths);
      if (!target) {
        return {
          saved: false,
          error: createNotFoundError(request.document.documentId),
        };
      }

      const pathError = ensurePathAvailability(target, fsDeps);
      if (pathError) {
        return {
          saved: false,
          error: pathError,
        };
      }

      const contentToWrite =
        request.document.kind === 'openclaw-skill' ? serializeSkillContent(request.document) : request.document.content;
      await fsDeps.writeFile(target.path, contentToWrite, 'utf8');

      return {
        saved: true,
        document: {
          ...request.document,
          content: contentToWrite,
          structuredContent:
            request.document.kind === 'openclaw-skill'
              ? createStructuredContent(contentToWrite, readFrontmatter(contentToWrite), matter(contentToWrite).content)
              : createStructuredContent(contentToWrite, {}, contentToWrite),
        },
      };
    },

    async applyDocument(request: ApplyDocumentRequest): Promise<ApplyDocumentResponse> {
      const paths = resolvePaths(homedirFn, env);
      const target = resolveDocumentTarget(request.documentId, paths);
      if (!target) {
        return {
          applied: false,
          issues: [],
          error: createNotFoundError(request.documentId),
        };
      }

      const pathError = ensurePathAvailability(target, fsDeps);
      if (pathError) {
        return {
          applied: false,
          issues: [],
          error: pathError,
        };
      }

      return {
        applied: true,
        issues: [],
      };
    },
  };
};

export const openclawWorkspaceDocumentAdapter = createOpenClawWorkspaceAdapter();
