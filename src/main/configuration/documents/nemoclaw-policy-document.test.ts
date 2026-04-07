import type { ConfigurationDocumentPayload } from '../../../shared/configuration/configuration-contracts';
import { createNemoClawPolicyAdapter } from './nemoclaw-policy-document';

const HOME_DIR = '/Users/tester';
const DEFAULT_POLICY_PATH = `${HOME_DIR}/.openclaw/openclaw-sandbox.yaml`;

const createDocument = (content: string): ConfigurationDocumentPayload => ({
  documentId: 'nemoclaw-policy',
  kind: 'nemoclaw-policy',
  format: 'yaml',
  content,
  editorMode: 'raw',
});

const createAdapter = () => {
  const deps = {
    homedir: () => HOME_DIR,
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    commandExists: jest.fn().mockResolvedValue(true),
    runCommand: jest.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' }),
    nowIso: () => '2026-04-05T00:00:00.000Z',
    isDevInstallSimulationEnabled: jest.fn().mockReturnValue(false),
  };

  return {
    adapter: createNemoClawPolicyAdapter(deps),
    deps,
  };
};

describe('createNemoClawPolicyAdapter', () => {
  it('resolves ~/.openclaw/openclaw-sandbox.yaml as the default policy path when no override is provided', async () => {
    const { adapter, deps } = createAdapter();
    deps.readFile.mockResolvedValue('sandbox:\n  mode: strict\n');

    const response = await adapter.loadDocument({ documentId: 'nemoclaw-policy' } as any);

    expect(deps.readFile).toHaveBeenCalledWith(DEFAULT_POLICY_PATH, 'utf8');
    expect(response.document).toMatchObject({
      documentId: 'nemoclaw-policy',
      kind: 'nemoclaw-policy',
      format: 'yaml',
      content: 'sandbox:\n  mode: strict\n',
    });
    expect(adapter.listDocuments()[0]?.path).toBe(DEFAULT_POLICY_PATH);
  });

  it('returns a default editable policy document when policy file is missing', async () => {
    const { adapter, deps } = createAdapter();
    deps.readFile.mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENOENT' }));

    const response = await adapter.loadDocument({ documentId: 'nemoclaw-policy' } as any);

    expect(response.error).toBeUndefined();
    expect(response.document?.content).toContain('network_policies');
  });

  it('returns valid=false with parser issue line/column on YAML parse errors', async () => {
    const { adapter } = createAdapter();

    const response = await adapter.validateDocument({
      document: createDocument('sandbox: [\n'),
    });

    expect(response.valid).toBe(false);
    expect(response.issues[0]).toMatchObject({
      level: 'error',
      line: expect.any(Number),
      column: expect.any(Number),
    });
  });

  it('uses explicit apply commands for static and dynamic modes (nemoclaw onboard vs openshell policy set)', async () => {
    const { adapter, deps } = createAdapter();

    const staticResponse = await adapter.applyDocument({
      documentId: 'nemoclaw-policy',
      applyMode: 'static',
    } as any);
    const dynamicResponse = await adapter.applyDocument({
      documentId: 'nemoclaw-policy',
      applyMode: 'dynamic',
    } as any);

    expect(staticResponse).toMatchObject({ applied: true, issues: [] });
    expect(dynamicResponse).toMatchObject({ applied: true, issues: [] });
    expect(deps.runCommand).toHaveBeenNthCalledWith(1, ['nemoclaw', 'onboard']);
    expect(deps.runCommand).toHaveBeenNthCalledWith(2, ['openshell', 'policy', 'set', DEFAULT_POLICY_PATH]);
  });

  it('returns CONFIG_COMMAND_UNAVAILABLE guidance when nemoclaw or openshell is missing', async () => {
    const { adapter, deps } = createAdapter();
    deps.commandExists.mockResolvedValueOnce(false).mockResolvedValueOnce(false);

    const staticResponse = await adapter.applyDocument({
      documentId: 'nemoclaw-policy',
      applyMode: 'static',
    } as any);
    const dynamicResponse = await adapter.applyDocument({
      documentId: 'nemoclaw-policy',
      applyMode: 'dynamic',
    } as any);

    expect(staticResponse).toMatchObject({
      applied: false,
      error: {
        errorCode: 'CONFIG_COMMAND_UNAVAILABLE',
        userMessage: expect.stringContaining('nemoclaw'),
      },
    });
    expect((staticResponse.error as any).nextSteps[0]).toContain('Install NemoClaw/OpenShell CLI');

    expect(dynamicResponse).toMatchObject({
      applied: false,
      error: {
        errorCode: 'CONFIG_COMMAND_UNAVAILABLE',
        userMessage: expect.stringContaining('openshell'),
      },
    });
    expect((dynamicResponse.error as any).nextSteps[0]).toContain('Install NemoClaw/OpenShell CLI');
  });

  it('simulates apply success in dev install simulation mode', async () => {
    const { adapter, deps } = createAdapter();
    deps.commandExists.mockResolvedValue(false);
    deps.isDevInstallSimulationEnabled.mockReturnValue(true);

    const response = await adapter.applyDocument({
      documentId: 'nemoclaw-policy',
      applyMode: 'dynamic',
    } as any);

    expect(response).toMatchObject({
      applied: true,
      issues: [],
    });
    expect(deps.commandExists).not.toHaveBeenCalled();
    expect(deps.runCommand).not.toHaveBeenCalled();
  });
});
