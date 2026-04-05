import type { Dirent } from 'node:fs';

import type { ConfigurationDocumentPayload } from '../../../shared/configuration/configuration-contracts';
import { createOpenClawWorkspaceAdapter } from './openclaw-workspace-document';

type AdapterFsDeps = {
  existsSync: jest.MockedFunction<(path: string) => boolean>;
  readdirSync: jest.MockedFunction<(path: string, options: { withFileTypes: true }) => Dirent[]>;
  readFile: jest.MockedFunction<(path: string, encoding: BufferEncoding) => Promise<string>>;
  writeFile: jest.MockedFunction<(path: string, content: string, encoding: BufferEncoding) => Promise<void>>;
  mkdir: jest.MockedFunction<(path: string, options: { recursive: true }) => Promise<unknown>>;
  unlink: jest.MockedFunction<(path: string) => Promise<void>>;
};

const AGENT_RULES_WORKSPACE_DOCUMENT_ID = 'openclaw-agent-rules:workspace';
const AGENT_RULES_WORKSPACE_PREFIX = 'openclaw-agent-rules:workspace';
const GLOBAL_SKILL_PREFIX = 'openclaw-skill:global';
const WORKSPACE_SKILL_PREFIX = 'openclaw-skill:workspace';

const createDirent = (name: string, isDirectory = true): Dirent =>
  ({
    name,
    isDirectory: () => isDirectory,
  }) as Dirent;

const createFsDeps = (): AdapterFsDeps => ({
  existsSync: jest.fn((_path: string) => true),
  readdirSync: jest.fn((_path: string, _options: { withFileTypes: true }) => []),
  readFile: jest.fn(async (_path: string, _encoding: BufferEncoding) => ''),
  writeFile: jest.fn(async (_path: string, _content: string, _encoding: BufferEncoding) => undefined),
  mkdir: jest.fn(async (_path: string, _options: { recursive: true }) => undefined),
  unlink: jest.fn(async (_path: string) => undefined),
});

const createSkillPayload = (overrides: Partial<ConfigurationDocumentPayload> = {}): ConfigurationDocumentPayload => ({
  documentId: `${GLOBAL_SKILL_PREFIX}:demo-skill`,
  kind: 'openclaw-skill',
  format: 'markdown',
  editorMode: 'raw',
  content: ['---', 'name: Demo Skill', 'description: Demonstration skill', '---', '', 'Body text'].join('\n'),
  ...overrides,
});

describe('createOpenClawWorkspaceAdapter', () => {
  it('discovers global and workspace skills using deterministic document IDs', () => {
    const home = '/tmp/test-home';
    const workspaceRoot = `${home}/.openclaw/workspace`;
    const fs = createFsDeps();

    fs.readdirSync.mockImplementation((targetPath: string) => {
      if (targetPath === `${home}/.openclaw/skills`) {
        return [createDirent('global-skill'), createDirent('README.md', false)];
      }
      if (targetPath === `${workspaceRoot}/skills`) {
        return [createDirent('workspace-skill')];
      }
      return [];
    });

    const adapter = createOpenClawWorkspaceAdapter({
      homedir: () => home,
      env: {},
      fs,
    });

    const documentIds = adapter
      .listDocuments()
      .map((document: { documentId: string }) => document.documentId);

    expect(documentIds).toEqual(
      expect.arrayContaining([
        `${GLOBAL_SKILL_PREFIX}:global-skill`,
        `${WORKSPACE_SKILL_PREFIX}:workspace-skill`,
      ])
    );
  });

  it('always includes workspace agent rules mapped to default workspace AGENTS path', () => {
    const home = '/tmp/test-home';
    const fs = createFsDeps();

    const adapter = createOpenClawWorkspaceAdapter({
      homedir: () => home,
      env: {},
      fs,
    });

    const documents = adapter.listDocuments();
    const agentsDocument = documents.find((document: { documentId: string }) => document.documentId === AGENT_RULES_WORKSPACE_DOCUMENT_ID);

    expect(agentsDocument).toBeDefined();
    expect(agentsDocument?.path).toBe(`${home}/.openclaw/workspace/AGENTS.md`);
  });

  it('discovers additional workspace agent-rule files', () => {
    const home = '/tmp/test-home';
    const workspaceRoot = `${home}/.openclaw/workspace`;
    const fs = createFsDeps();

    fs.readdirSync.mockImplementation((targetPath: string) => {
      if (targetPath === `${workspaceRoot}/agents`) {
        return [createDirent('review.md', false), createDirent('README.txt', false)];
      }
      return [];
    });

    const adapter = createOpenClawWorkspaceAdapter({
      homedir: () => home,
      env: {},
      fs,
    });

    const documentIds = adapter.listDocuments().map((document) => document.documentId);
    expect(documentIds).toContain(`${AGENT_RULES_WORKSPACE_PREFIX}:review`);
  });

  it('fails skill validation when frontmatter name or description is missing', async () => {
    const fs = createFsDeps();
    const adapter = createOpenClawWorkspaceAdapter({
      homedir: () => '/tmp/test-home',
      env: {},
      fs,
    });

    const response = await adapter.validateDocument({
      document: createSkillPayload({
        content: ['---', 'name: ""', '---', '', 'Body text'].join('\n'),
      }),
    });

    expect(response.valid).toBe(false);
    expect(response.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('name') }),
        expect.objectContaining({ message: expect.stringContaining('description') }),
      ])
    );
  });

  it('returns unavailable guidance instead of crashing when workspace path is missing', () => {
    const home = '/tmp/test-home';
    const workspaceRoot = `${home}/.openclaw/workspace`;
    const fs = createFsDeps();

    fs.existsSync.mockImplementation((targetPath: string) => targetPath !== workspaceRoot && targetPath !== `${workspaceRoot}/skills`);

    const adapter = createOpenClawWorkspaceAdapter({
      homedir: () => home,
      env: {},
      fs,
    });

    const documents = adapter.listDocuments();
    const agentsDocument = documents.find(
      (document: { documentId: string }) => document.documentId === AGENT_RULES_WORKSPACE_DOCUMENT_ID
    );

    expect(agentsDocument).toBeDefined();
    expect(agentsDocument?.description).toContain(workspaceRoot);
    expect(agentsDocument?.description?.toLowerCase()).toContain('unavailable');
  });

  it('loads default editable agent rules content when workspace path is missing', async () => {
    const home = '/tmp/test-home';
    const workspaceRoot = `${home}/.openclaw/workspace`;
    const fs = createFsDeps();

    fs.existsSync.mockImplementation((targetPath: string) => targetPath !== workspaceRoot);

    const adapter = createOpenClawWorkspaceAdapter({
      homedir: () => home,
      env: {},
      fs,
    });

    const response = await adapter.loadDocument({
      documentId: AGENT_RULES_WORKSPACE_DOCUMENT_ID,
    });

    expect(response.error).toBeUndefined();
    expect(response.document?.kind).toBe('openclaw-agent-rules');
    expect(response.document?.content).toContain('## Rules');
  });

  it('creates missing workspace files on save for new skill IDs', async () => {
    const home = '/tmp/test-home';
    const workspaceRoot = `${home}/.openclaw/workspace`;
    const fs = createFsDeps();

    fs.existsSync.mockImplementation((targetPath: string) => targetPath !== workspaceRoot);

    const adapter = createOpenClawWorkspaceAdapter({
      homedir: () => home,
      env: {},
      fs,
    });

    const response = await adapter.saveDocument({
      document: createSkillPayload({
        documentId: `${WORKSPACE_SKILL_PREFIX}:new-skill`,
      }),
    });

    expect(response.saved).toBe(true);
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.mkdir).toHaveBeenCalledWith(`${workspaceRoot}/skills/new-skill`, { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(
      `${workspaceRoot}/skills/new-skill/SKILL.md`,
      expect.any(String),
      'utf8'
    );
  });

  it('removes workspace skill file for removable documents', async () => {
    const home = '/tmp/test-home';
    const workspaceRoot = `${home}/.openclaw/workspace`;
    const fs = createFsDeps();

    const adapter = createOpenClawWorkspaceAdapter({
      homedir: () => home,
      env: {},
      fs,
    });

    const response = await adapter.deleteDocument({
      documentId: `${WORKSPACE_SKILL_PREFIX}:to-remove`,
    });

    expect(response.deleted).toBe(true);
    expect(fs.unlink).toHaveBeenCalledWith(`${workspaceRoot}/skills/to-remove/SKILL.md`);
  });

  it('rejects delete for protected workspace aggregate document', async () => {
    const fs = createFsDeps();
    const adapter = createOpenClawWorkspaceAdapter({
      homedir: () => '/tmp/test-home',
      env: {},
      fs,
    });

    const response = await adapter.deleteDocument({
      documentId: AGENT_RULES_WORKSPACE_DOCUMENT_ID,
    });

    expect(response.deleted).toBe(false);
    expect(response.error?.errorCode).toBe('CONFIG_DOCUMENT_DELETE_NOT_SUPPORTED');
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});
