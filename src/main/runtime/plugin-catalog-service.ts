import { spawn } from 'child_process';
import type {
  ImportPluginPackageRequest,
  ImportPluginPackageResponse,
  ListPluginPackagesResponse,
  PluginPackage,
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
    source: input.source ?? 'unknown',
  };
}

function toUserError(result: CliResult, fallback: string): string {
  const combined = `${result.error ?? ''}\n${result.stderr}`.trim();
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

      return normalizePlugin({
        id,
        displayName: (value.displayName as string) ?? (value.name as string) ?? id,
        version: typeof value.version === 'string' ? value.version : undefined,
        enabled: Boolean(value.enabled ?? true),
        description: typeof value.description === 'string' ? value.description : undefined,
        source: typeof value.source === 'string' && (value.source === 'local' || value.source === 'registry')
          ? value.source
          : 'unknown',
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
        source: 'unknown',
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
    source: 'unknown',
  });
}

async function installWithFallback(packageName: string): Promise<CliResult> {
  const first = await runOpenClaw(['plugins', 'install', packageName, '--yes']);
  if (first.ok || !/unknown option|unexpected argument/i.test(first.stderr)) {
    return first;
  }
  return runOpenClaw(['plugins', 'install', packageName]);
}

async function uninstallWithFallback(pluginId: string): Promise<CliResult> {
  const first = await runOpenClaw(['plugins', 'uninstall', pluginId, '--yes']);
  if (first.ok || !/unknown option|unexpected argument/i.test(first.stderr)) {
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

  const installResult = await installWithFallback(packageName);
  if (!installResult.ok) {
    return {
      imported: false,
      packageName,
      error: toUserError(installResult, `Failed to import plugin "${packageName}"`),
    };
  }

  const listed = await listPluginPackages();
  const plugin = listed.packages.find(
    (entry) =>
      entry.id.toLowerCase() === packageName.toLowerCase() ||
      entry.displayName.toLowerCase() === packageName.toLowerCase()
  );

  return {
    imported: true,
    packageName,
    plugin: plugin ?? normalizePlugin({ id: packageName, source: 'unknown' }),
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
