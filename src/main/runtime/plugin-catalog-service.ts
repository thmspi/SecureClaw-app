import { spawn } from 'child_process';
import { accessSync, constants, existsSync, readFileSync, readdirSync, rmSync } from 'fs';
import { homedir } from 'os';
import { delimiter, join } from 'path';
import type {
  ImportPluginPackageRequest,
  ImportPluginPackageResponse,
  ListPluginPackagesResponse,
  PluginPackage,
  SetPluginPackageEnabledRequest,
  SetPluginPackageEnabledResponse,
  UninstallPluginPackageRequest,
  UninstallPluginPackageResponse,
  ValidatePluginPackageRequest,
  ValidatePluginPackageResponse,
} from '../../shared/runtime/runtime-contracts';

interface CliResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

interface RunOpenClawOptions {
  profile?: string;
}

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveBinary(binaryName: string, pathDirs: string[]): string | null {
  for (const dir of pathDirs) {
    const candidate = join(dir, binaryName);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

function hasNodeShebang(filePath: string): boolean {
  try {
    const firstLine = readFileSync(filePath, 'utf8').split('\n', 1)[0] ?? '';
    return /^#!.*\bnode\b/.test(firstLine);
  } catch {
    return false;
  }
}

function buildOpenClawEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const existingPath = env.PATH ?? '';

  const candidateDirs = new Set<string>();
  if (existingPath) {
    for (const dir of existingPath.split(delimiter)) {
      if (dir.trim().length > 0) {
        candidateDirs.add(dir);
      }
    }
  }

  const homeDir = env.HOME ?? homedir();
  if (homeDir) {
    candidateDirs.add(join(homeDir, '.secureclaw', 'npm-global', 'bin'));
    candidateDirs.add(join(homeDir, '.volta', 'bin'));

    const nvmVersionsDir = join(homeDir, '.nvm', 'versions', 'node');
    if (existsSync(nvmVersionsDir)) {
      for (const versionDir of readdirSync(nvmVersionsDir)) {
        const binDir = join(nvmVersionsDir, versionDir, 'bin');
        if (existsSync(binDir)) {
          candidateDirs.add(binDir);
        }
      }
    }
  }

  if (env.npm_config_prefix) {
    candidateDirs.add(join(env.npm_config_prefix, 'bin'));
  }

  if (env.NPM_CONFIG_PREFIX) {
    candidateDirs.add(join(env.NPM_CONFIG_PREFIX, 'bin'));
  }

  // Common macOS global binary locations for npm-installed CLIs.
  candidateDirs.add('/usr/local/bin');
  candidateDirs.add('/opt/homebrew/bin');
  candidateDirs.add('/usr/bin');
  candidateDirs.add('/bin');

  env.PATH = Array.from(candidateDirs).join(delimiter);
  return env;
}

function runOpenClaw(
  args: string[],
  timeoutMs = 45000,
  options: RunOpenClawOptions = {}
): Promise<CliResult> {
  return new Promise((resolve) => {
    const env = buildOpenClawEnv();
    const pathDirs = (env.PATH ?? '').split(delimiter).filter((dir) => dir.trim().length > 0);
    const openClawBinary = resolveBinary(process.platform === 'win32' ? 'openclaw.exe' : 'openclaw', pathDirs);
    const nodeBinary = resolveBinary(process.platform === 'win32' ? 'node.exe' : 'node', pathDirs);
    const prefixArgs = options.profile ? ['--profile', options.profile] : [];

    let command = openClawBinary ?? 'openclaw';
    let commandArgs = [...prefixArgs, ...args];

    if (openClawBinary && nodeBinary && hasNodeShebang(openClawBinary)) {
      command = nodeBinary;
      commandArgs = [openClawBinary, ...prefixArgs, ...args];
    }

    const child = spawn(command, commandArgs, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({
        ok: false,
        stdout: '',
        stderr: '',
        error: `Command timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        stdout,
        stderr,
        error: error.message,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        stdout,
        stderr,
        error: code === 0 ? undefined : `Exited with code ${code}`,
      });
    });
  });
}

function normalizePlugin(input: Partial<PluginPackage> & { id: string }): PluginPackage {
  return {
    id: input.id,
    displayName: input.displayName ?? input.id,
    version: input.version,
    enabled: input.enabled ?? true,
    description: input.description,
    category: input.category ?? 'Other',
    source: input.source ?? 'unknown',
    origin: input.origin,
    removable: input.removable ?? true,
  };
}

function hasNonEmptyArray(value: Record<string, unknown>, key: string): boolean {
  return Array.isArray(value[key]) && (value[key] as unknown[]).length > 0;
}

function derivePluginCategory(value: Record<string, unknown>, id: string): NonNullable<PluginPackage['category']> {
  if (/^memory[-_]/i.test(id)) {
    return 'Memory';
  }
  if (hasNonEmptyArray(value, 'channelIds')) {
    return 'Channel';
  }
  if (hasNonEmptyArray(value, 'providerIds')) {
    return 'Model Provider';
  }
  if (hasNonEmptyArray(value, 'speechProviderIds')) {
    return 'Speech';
  }
  if (hasNonEmptyArray(value, 'mediaUnderstandingProviderIds')) {
    return 'Media Understanding';
  }
  if (hasNonEmptyArray(value, 'imageGenerationProviderIds')) {
    return 'Image Generation';
  }
  if (hasNonEmptyArray(value, 'webSearchProviderIds')) {
    return 'Web Search';
  }
  if (hasNonEmptyArray(value, 'toolNames')) {
    return 'Tool';
  }
  if (hasNonEmptyArray(value, 'cliCommands') || hasNonEmptyArray(value, 'commands')) {
    return 'Command';
  }
  if (hasNonEmptyArray(value, 'hookNames') || (typeof value.hookCount === 'number' && value.hookCount > 0)) {
    return 'Hook';
  }
  if (hasNonEmptyArray(value, 'services')) {
    return 'Service';
  }

  return 'Other';
}

function combineCliOutput(result: CliResult): string {
  return `${result.error ?? ''}\n${result.stderr}\n${result.stdout}`.trim();
}

function supportsYesFlag(result: CliResult): boolean {
  return !/unknown option\s+['"]?--yes['"]?|unexpected argument\s+['"]?--yes['"]?/i.test(
    combineCliOutput(result)
  );
}

function toUserError(result: CliResult, fallback: string): string {
  const combined = combineCliOutput(result);
  if (!combined) {
    return fallback;
  }

  if (/env:\s*node:.*not found|\/usr\/bin\/env:.*node.*No such file/i.test(combined)) {
    return 'OpenClaw CLI was found, but Node.js is not available in the runtime environment.';
  }

  if (
    /spawn\s+openclaw\s+enoent/i.test(combined) ||
    /(^|\n)\s*openclaw:\s*(command\s+not\s+found|not\s+found)\s*($|\n)/i.test(combined) ||
    /no such file or directory.*openclaw/i.test(combined) ||
    /\bENOENT\b/.test(combined)
  ) {
    return 'OpenClaw CLI is not available on PATH or managed install locations. Install OpenClaw first.';
  }

  if (/plugin not found/i.test(combined)) {
    return `${combined}\nTry a fully-qualified spec (for example: clawhub:<plugin-name> or npm package name).`;
  }

  return combined;
}

function extractJsonDocument(raw: string): string | null {
  const objectStart = raw.indexOf('{');
  if (objectStart < 0) {
    return null;
  }

  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let i = objectStart; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(objectStart, i + 1);
      }
    }
  }

  return raw.slice(objectStart);
}

function parsePluginsJson(raw: string): PluginPackage[] {
  const jsonDocument = extractJsonDocument(raw);
  if (!jsonDocument) {
    return [];
  }

  const parsed = JSON.parse(jsonDocument) as unknown;
  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).plugins)
      ? (parsed as { plugins: unknown[] }).plugins
      : [];

  return items
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const value = entry as Record<string, unknown>;
      const id = (value.id as string) ?? (value.name as string) ?? (value.plugin as string);
      if (!id) {
        return null;
      }

      const origin = typeof value.origin === 'string' ? value.origin : undefined;
      const normalizedSource =
        typeof value.source === 'string' && (value.source === 'local' || value.source === 'registry')
          ? value.source
          : origin && /bundled|marketplace|clawhub|npm|registry/i.test(origin)
            ? 'registry'
            : origin && /local|path|linked/i.test(origin)
              ? 'local'
              : 'unknown';

      return normalizePlugin({
        id,
        displayName: (value.displayName as string) ?? (value.name as string) ?? id,
        version: typeof value.version === 'string' ? value.version : undefined,
        enabled: Boolean(value.enabled ?? true),
        description: typeof value.description === 'string' ? value.description : undefined,
        category: derivePluginCategory(value, id),
        source: normalizedSource,
        origin,
        removable: origin !== 'bundled',
      });
    })
    .filter((plugin): plugin is PluginPackage => Boolean(plugin));
}

function parsePluginsTable(raw: string): PluginPackage[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .filter((line) => line.startsWith('│'))
    .filter((line) => !/^[│\s─┌┐└┘├┤┬┴┼]+$/.test(line))
    .filter((line) => !/^no plugins/i.test(line));

  return lines
    .map((line) => {
      const parts = line.split('│');
      if (parts.length < 8) {
        return null;
      }

      const cells = parts.slice(1, -1).map((part) => part.trim());

      if (cells.length < 6) {
        return null;
      }

      const displayName = cells[0];
      const id = cells[1];
      const format = cells[2];
      const status = cells[3];
      const source = cells[4];
      const version = cells[5];

      if (!id || /^id$/i.test(id) || /^(name|format|status|source|version)$/i.test(id)) {
        return null;
      }

      const enabled = /(loaded|enabled|on)/i.test(status);
      const origin = source.startsWith('stock:') ? 'bundled' : source.startsWith('global:') ? 'local' : undefined;

      return normalizePlugin({
        id,
        displayName: displayName || id,
        version: version || undefined,
        enabled,
        source: format === 'openclaw' ? 'registry' : 'unknown',
        origin,
        removable: origin !== 'bundled',
        category: 'Other',
      });
    })
    .filter((plugin): plugin is PluginPackage => Boolean(plugin));
}

async function installWithFallback(
  packageName: string,
  options: RunOpenClawOptions = {}
): Promise<CliResult> {
  const first = await runOpenClaw(['plugins', 'install', packageName, '--yes'], 90000, options);
  if (first.ok || supportsYesFlag(first)) {
    return first;
  }
  return runOpenClaw(['plugins', 'install', packageName], 90000, options);
}

async function uninstallWithFallback(pluginId: string): Promise<CliResult> {
  const first = await runOpenClaw(['plugins', 'uninstall', pluginId, '--yes']);
  if (first.ok || supportsYesFlag(first)) {
    return first;
  }
  return runOpenClaw(['plugins', 'uninstall', pluginId]);
}

export async function listPluginPackages(): Promise<ListPluginPackagesResponse> {
  const jsonResult = await runOpenClaw(['plugins', 'list', '--json']);
  if (jsonResult.ok) {
    try {
      return { packages: parsePluginsJson(jsonResult.stdout) };
    } catch {
      // Fall through to plain text parsing.
    }
  }

  const textResult = await runOpenClaw(['plugins', 'list']);
  if (!textResult.ok) {
    return {
      packages: [],
      error: toUserError(textResult, 'Failed to list plugin packages'),
    };
  }

  return {
    packages: parsePluginsTable(textResult.stdout),
  };
}

export async function validatePluginPackage(
  request: ValidatePluginPackageRequest
): Promise<ValidatePluginPackageResponse> {
  const packageName = request.packageName.trim();
  if (!packageName) {
    return {
      valid: false,
      packageName,
      error: 'Plugin package name is required.',
    };
  }

  const validationProfile = `secureclaw-validate-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const profileRoot = join(homedir(), `.openclaw-${validationProfile}`);

  try {
    const result = await installWithFallback(packageName, { profile: validationProfile });
    if (!result.ok) {
      return {
        valid: false,
        packageName,
        error: toUserError(result, `Plugin "${packageName}" is not installable.`),
      };
    }

    return {
      valid: true,
      packageName,
      plugin: normalizePlugin({ id: packageName, source: 'registry' }),
    };
  } catch {
    return {
      valid: false,
      packageName,
      error: `Plugin "${packageName}" is not installable.`,
    };
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
  }
}

export async function importPluginPackage(
  request: ImportPluginPackageRequest
): Promise<ImportPluginPackageResponse> {
  const packageName = request.packageName.trim();
  if (!packageName) {
    return {
      imported: false,
      packageName,
      error: 'Plugin package name is required.',
    };
  }

  const validateResult = await validatePluginPackage({ packageName });
  if (!validateResult.valid) {
    return {
      imported: false,
      packageName,
      error: validateResult.error,
    };
  }

  const beforeInstall = await listPluginPackages();
  const beforeInstallIds = new Set(beforeInstall.packages.map((entry) => entry.id.toLowerCase()));

  const installResult = await installWithFallback(packageName);
  if (!installResult.ok) {
    return {
      imported: false,
      packageName,
      error: toUserError(installResult, `Failed to import plugin "${packageName}"`),
    };
  }

  const listed = await listPluginPackages();
  const expectedId = validateResult.plugin?.id.toLowerCase();
  const addedPlugin = listed.packages.find((entry) => !beforeInstallIds.has(entry.id.toLowerCase()));
  const plugin = listed.packages.find(
    (entry) =>
      (expectedId ? entry.id.toLowerCase() === expectedId : false) ||
      entry.id.toLowerCase() === packageName.toLowerCase() ||
      entry.displayName.toLowerCase() === packageName.toLowerCase()
  );

  return {
    imported: true,
    packageName,
    plugin: addedPlugin ?? plugin ?? validateResult.plugin ?? normalizePlugin({ id: packageName, source: 'unknown' }),
  };
}

export async function uninstallPluginPackage(
  request: UninstallPluginPackageRequest
): Promise<UninstallPluginPackageResponse> {
  const pluginId = request.pluginId.trim();
  if (!pluginId) {
    return {
      uninstalled: false,
      pluginId,
      error: 'Plugin ID is required.',
    };
  }

  const result = await uninstallWithFallback(pluginId);
  if (!result.ok) {
    return {
      uninstalled: false,
      pluginId,
      error: toUserError(result, `Failed to uninstall plugin "${pluginId}"`),
    };
  }

  return {
    uninstalled: true,
    pluginId,
  };
}

export async function setPluginPackageEnabled(
  request: SetPluginPackageEnabledRequest
): Promise<SetPluginPackageEnabledResponse> {
  const pluginId = request.pluginId.trim();
  if (!pluginId) {
    return {
      updated: false,
      pluginId,
      enabled: request.enabled,
      error: 'Plugin ID is required.',
    };
  }

  const operation = request.enabled ? 'enable' : 'disable';
  const result = await runOpenClaw(['plugins', operation, pluginId]);
  if (!result.ok) {
    return {
      updated: false,
      pluginId,
      enabled: request.enabled,
      error: toUserError(result, `Failed to ${operation} plugin "${pluginId}"`),
    };
  }

  const listed = await listPluginPackages();
  const plugin = listed.packages.find((entry) => entry.id.toLowerCase() === pluginId.toLowerCase());

  return {
    updated: true,
    pluginId,
    enabled: plugin?.enabled ?? request.enabled,
  };
}
