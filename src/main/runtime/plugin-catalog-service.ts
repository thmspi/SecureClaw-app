import { spawn } from 'child_process';
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

function runOpenClaw(args: string[], timeoutMs = 45000): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn('openclaw', args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
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

  if (combined.includes('ENOENT') || combined.includes('not found')) {
    return 'OpenClaw CLI is not available on PATH. Install OpenClaw first.';
  }

  return combined;
}

function parsePluginsJson(raw: string): PluginPackage[] {
  const parsed = JSON.parse(raw) as unknown;
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
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^[-+| ]+$/.test(line))
    .filter((line) => !/^id\s+/i.test(line))
    .filter((line) => !/^no plugins/i.test(line));

  return lines
    .map((line) => {
      const cells = line.includes('|')
        ? line
            .split('|')
            .map((part) => part.trim())
            .filter(Boolean)
        : line.split(/\s+/).filter(Boolean);

      if (cells.length === 0) {
        return null;
      }

      const id = cells[0];
      const version = cells.length > 1 ? cells[1] : undefined;
      const statusCell = cells.find((cell) => /(enabled|disabled|on|off)/i.test(cell)) ?? '';
      const enabled = /(enabled|on)/i.test(statusCell);

      return normalizePlugin({
        id,
        version,
        enabled: statusCell ? enabled : true,
        category: 'Other',
        source: 'unknown',
        removable: true,
      });
    })
    .filter((plugin): plugin is PluginPackage => Boolean(plugin));
}

function parseSinglePlugin(raw: string, packageName: string): PluginPackage {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const id =
    (typeof parsed.id === 'string' && parsed.id) ||
    (typeof parsed.name === 'string' && parsed.name) ||
    packageName;

  return normalizePlugin({
    id,
    displayName: (parsed.displayName as string) ?? (parsed.name as string) ?? id,
    version: typeof parsed.version === 'string' ? parsed.version : undefined,
    enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
    description: typeof parsed.description === 'string' ? parsed.description : undefined,
    category: derivePluginCategory(parsed, id),
    source:
      typeof parsed.source === 'string' && (parsed.source === 'local' || parsed.source === 'registry')
        ? parsed.source
        : 'unknown',
    origin: typeof parsed.origin === 'string' ? parsed.origin : undefined,
    removable: parsed.origin !== 'bundled',
  });
}

async function installWithFallback(packageName: string): Promise<CliResult> {
  const first = await runOpenClaw(['plugins', 'install', packageName, '--yes']);
  if (first.ok || supportsYesFlag(first)) {
    return first;
  }
  return runOpenClaw(['plugins', 'install', packageName]);
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

  const result = await runOpenClaw(['plugins', 'inspect', packageName, '--json']);
  if (!result.ok) {
    return {
      valid: false,
      packageName,
      error: toUserError(result, `Plugin "${packageName}" is not valid.`),
    };
  }

  try {
    return {
      valid: true,
      packageName,
      plugin: parseSinglePlugin(result.stdout, packageName),
    };
  } catch {
    return {
      valid: true,
      packageName,
      plugin: normalizePlugin({ id: packageName, source: 'unknown' }),
    };
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
