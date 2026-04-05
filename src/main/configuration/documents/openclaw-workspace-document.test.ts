import type { Dirent } from 'node:fs';

import type { ConfigurationDocumentPayload } from '../../../shared/configuration/configuration-contracts';
import { createOpenClawWorkspaceAdapter } from './openclaw-workspace-document';

type AdapterFsDeps = {
  existsSync: jest.MockedFunction<(path: string) => boolean>;
  readdirSync: jest.MockedFunction<(path: string, options: { withFileTypes: true }) => Dirent[]>;
  readFile: jest.MockedFunction<(path: string, encoding: BufferEncoding) => Promise<string>>;
  writeFile: jest.MockedFunction<(path: string, content: string, encoding: BufferEncoding) => Promise<void>>;
};

const AGENT_RULES_WORKSPACE_DOCUMENT_ID = 'openclaw-agent-rules:workspace';
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
});
