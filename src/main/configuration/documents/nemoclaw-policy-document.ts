import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import YAML from 'yaml';
import type {
  ApplyDocumentRequest,
  ApplyDocumentResponse,
  ConfigurationDocumentPayload,
  ConfigurationDocumentSummary,
  ConfigurationOperationError,
  LoadDocumentRequest,
  LoadDocumentResponse,
  SaveDocumentRequest,
  SaveDocumentResponse,
  ValidateDocumentRequest,
  ValidateDocumentResponse,
} from '../../../shared/configuration/configuration-contracts';

const NEMOCLAW_POLICY_DOCUMENT_ID = 'nemoclaw-policy';
const NEMOCLAW_POLICY_RELATIVE_PATH = '.openclaw/openclaw-sandbox.yaml';

type NemoClawApplyMode = 'static' | 'dynamic';

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type YamlErrorWithPosition = Error & {
  linePos?: Array<{
    line?: number;
    col?: number;
  }>;
};

interface NemoClawPolicyAdapterDeps {
  homedir: () => string;
  readFile: (path: string, encoding: BufferEncoding) => Promise<string>;
  writeFile: (path: string, content: string, encoding: BufferEncoding) => Promise<void>;
  mkdir: (path: string, options: { recursive: true }) => Promise<unknown>;
  parseYaml: (text: string) => unknown;
  stringifyYaml: (value: unknown) => string;
  commandExists: (command: string) => Promise<boolean>;
  runCommand: (argv: string[]) => Promise<CommandResult>;
  nowIso: () => string;
}

type PolicyPathOverrideRequest = {
  pathOverride?: string;
};

type ApplyPolicyRequest = ApplyDocumentRequest &
  PolicyPathOverrideRequest & {
    applyMode?: NemoClawApplyMode;
  };

type CommandUnavailableError = ConfigurationOperationError & {
  nextSteps: string[];
};

const resolveDefaultPolicyPath = (homeDir: string): string => join(homeDir, NEMOCLAW_POLICY_RELATIVE_PATH);

const ensureTrailingNewline = (text: string): string => (text.endsWith('\n') ? text : `${text}\n`);

const resolvePolicyPath = (
  request: Partial<PolicyPathOverrideRequest> | undefined,
  deps: Pick<NemoClawPolicyAdapterDeps, 'homedir'>
): string => request?.pathOverride ?? resolveDefaultPolicyPath(deps.homedir());

const extractLineAndColumn = (error: unknown): { line?: number; column?: number } => {
  const positionedError = error as Partial<YamlErrorWithPosition>;
  if (Array.isArray(positionedError.linePos) && positionedError.linePos.length > 0) {
    const [first] = positionedError.linePos;
    if (typeof first?.line === 'number' || typeof first?.col === 'number') {
      return {
        line: first?.line,
        column: first?.col,
      };
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/line\s+(\d+),\s*column\s+(\d+)/i);
  if (!match) {
    return {};
  }

  return {
    line: Number(match[1]),
    column: Number(match[2]),
  };
};

const toYamlParseIssue = (error: unknown) => {
  const location = extractLineAndColumn(error);
  const message = error instanceof Error ? error.message : 'Invalid YAML document.';

  return {
    level: 'error' as const,
    code: 'CONFIG_VALIDATION_YAML_PARSE_ERROR',
    message,
    line: location.line,
    column: location.column,
  };
};

const createCommandUnavailableError = (command: string): CommandUnavailableError => ({
  errorCode: 'CONFIG_COMMAND_UNAVAILABLE',
  userMessage: `Unable to apply NemoClaw policy because "${command}" is not installed or not available in PATH.`,
  retryable: false,
  nextSteps: ['Install NemoClaw/OpenShell CLI and ensure it is available in your PATH.'],
});

const createDocumentSummary = (policyPath: string): ConfigurationDocumentSummary => ({
  documentId: NEMOCLAW_POLICY_DOCUMENT_ID,
  displayName: 'NemoClaw Sandbox Policy',
  kind: 'nemoclaw-policy',
  format: 'yaml',
  editorModes: ['visual', 'raw'],
  description: 'Edit baseline NemoClaw sandbox policy.',
  path: policyPath,
});

const runProcess = (argv: string[]): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const [command, ...args] = argv;
    if (!command) {
      reject(new Error('No command provided.'));
      return;
    }

    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
      });
    });
  });

const isCommandNotFoundError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const withCode = error as NodeJS.ErrnoException;
  if (withCode.code === 'ENOENT') {
    return true;
  }

  return /not found|no such file or directory/i.test(error.message);
};

const defaultDeps: NemoClawPolicyAdapterDeps = {
  homedir,
  readFile: (path, encoding) => readFile(path, encoding),
  writeFile: (path, content, encoding) => writeFile(path, content, encoding),
  mkdir: (path, options) => mkdir(path, options),
  parseYaml: (text) => YAML.parse(text),
  stringifyYaml: (value) => YAML.stringify(value),
  commandExists: async (command) => {
    const result = await runProcess(['which', command]);
    return result.exitCode === 0;
  },
  runCommand: (argv) => runProcess(argv),
  nowIso: () => new Date().toISOString(),
};

const buildLoadError = (policyPath: string, error: unknown): ConfigurationOperationError => ({
  errorCode: 'CONFIG_DOCUMENT_READ_FAILED',
  userMessage: `Unable to load NemoClaw policy from "${policyPath}".`,
  technicalDetails: error instanceof Error ? error.message : String(error),
  retryable: true,
});

const buildSaveError = (policyPath: string, error: unknown): ConfigurationOperationError => ({
  errorCode: 'CONFIG_DOCUMENT_SAVE_FAILED',
  userMessage: `Unable to save NemoClaw policy to "${policyPath}".`,
  technicalDetails: error instanceof Error ? error.message : String(error),
  retryable: true,
});

const buildApplyError = (error: unknown): ConfigurationOperationError => ({
  errorCode: 'CONFIG_APPLY_FAILED',
  userMessage: 'Unable to apply NemoClaw policy.',
  technicalDetails: error instanceof Error ? error.message : String(error),
  retryable: true,
});

const buildCommandArguments = (applyMode: NemoClawApplyMode, policyPath: string): string[] =>
  applyMode === 'dynamic'
    ? ['openshell', 'policy', 'set', policyPath]
    : ['nemoclaw', 'onboard'];

export const createNemoClawPolicyAdapter = (
  depsOverride: Partial<NemoClawPolicyAdapterDeps> = {}
) => {
  const deps: NemoClawPolicyAdapterDeps = {
    ...defaultDeps,
    ...depsOverride,
  };

  const toPayload = (
    content: string,
    structuredContent?: unknown
  ): ConfigurationDocumentPayload => ({
    documentId: NEMOCLAW_POLICY_DOCUMENT_ID,
    kind: 'nemoclaw-policy',
    format: 'yaml',
    content,
    editorMode: 'raw',
    updatedAt: deps.nowIso(),
    structuredContent:
      structuredContent && typeof structuredContent === 'object'
        ? (structuredContent as Record<string, unknown>)
        : undefined,
  });

  return {
    listDocuments(): ConfigurationDocumentSummary[] {
      const policyPath = resolveDefaultPolicyPath(deps.homedir());
      return [createDocumentSummary(policyPath)];
    },

    async loadDocument(request: LoadDocumentRequest): Promise<LoadDocumentResponse> {
      const policyPath = resolvePolicyPath(request as LoadDocumentRequest & PolicyPathOverrideRequest, deps);
      try {
        const content = await deps.readFile(policyPath, 'utf8');
        let parsed: unknown;
        try {
          parsed = deps.parseYaml(content);
        } catch {
          parsed = undefined;
        }

        return {
          document: toPayload(content, parsed),
        };
      } catch (error) {
        return {
          error: buildLoadError(policyPath, error),
        };
      }
    },

    async validateDocument(request: ValidateDocumentRequest): Promise<ValidateDocumentResponse> {
      try {
        deps.parseYaml(request.document.content);
        return {
          valid: true,
          issues: [],
        };
      } catch (error) {
        return {
          valid: false,
          issues: [toYamlParseIssue(error)],
        };
      }
    },

    async saveDocument(request: SaveDocumentRequest): Promise<SaveDocumentResponse> {
      const policyPath = resolvePolicyPath(request as SaveDocumentRequest & PolicyPathOverrideRequest, deps);
      try {
        const parsed = deps.parseYaml(request.document.content);
        const normalizedContent = ensureTrailingNewline(deps.stringifyYaml(parsed));

        await deps.mkdir(dirname(policyPath), { recursive: true });
        await deps.writeFile(policyPath, normalizedContent, 'utf8');

        return {
          saved: true,
          document: toPayload(normalizedContent, parsed),
        };
      } catch (error) {
        return {
          saved: false,
          error: buildSaveError(policyPath, error),
        };
      }
    },

    async applyDocument(request: ApplyDocumentRequest): Promise<ApplyDocumentResponse> {
      const applyRequest = request as ApplyPolicyRequest;
      const applyMode = applyRequest.applyMode ?? 'static';
      const policyPath = resolvePolicyPath(applyRequest, deps);
      const args = buildCommandArguments(applyMode, policyPath);
      const requiredCommand = args[0];

      if (!(await deps.commandExists(requiredCommand))) {
        return {
          applied: false,
          issues: [],
          error: createCommandUnavailableError(requiredCommand),
        };
      }

      if (request.dryRun) {
        return {
          applied: true,
          issues: [],
        };
      }

      try {
        const result = await deps.runCommand(args);
        if (result.exitCode === 0) {
          return {
            applied: true,
            issues: [],
          };
        }

        return {
          applied: false,
          issues: [
            {
              level: 'error',
              code: 'CONFIG_APPLY_FAILED',
              message: result.stderr || result.stdout || 'Policy apply command failed.',
            },
          ],
          error: {
            errorCode: 'CONFIG_APPLY_FAILED',
            userMessage: 'Unable to apply NemoClaw policy.',
            technicalDetails: result.stderr || result.stdout || `Exit code ${result.exitCode}`,
            retryable: true,
          },
        };
      } catch (error) {
        if (isCommandNotFoundError(error)) {
          return {
            applied: false,
            issues: [],
            error: createCommandUnavailableError(requiredCommand),
          };
        }

        return {
          applied: false,
          issues: [],
          error: buildApplyError(error),
        };
      }
    },
  };
};

export const nemoclawPolicyDocumentAdapter = createNemoClawPolicyAdapter();
