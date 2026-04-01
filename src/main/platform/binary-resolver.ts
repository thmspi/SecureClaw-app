import * as path from 'path';
import { existsSync, accessSync, constants } from 'fs';
import { getManagedCacheDir } from './path-service';

export interface BinaryResolutionOptions {
  configuredPath?: string;
  bundledDir?: string;
  systemPath?: boolean;
  managedCache?: boolean;
}

export interface BinaryHealthResult {
  resolvedPath: string | null;
  isExecutable: boolean;
  version: string | null;
  failureReason: string | null;
  remediationHint: string | null;
}

// Platform-specific binary naming (e.g., .exe on Windows)
export function getNormalizedBinaryName(baseName: string): string {
  if (process.platform === 'win32' && !baseName.endsWith('.exe')) {
    return `${baseName}.exe`;
  }
  return baseName;
}

// Check if file exists and is executable
function checkExecutable(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) {
      return false;
    }
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Resolve binary following D-05 precedence order:
// configured -> bundled -> PATH -> cache
export async function resolveBinary(
  binaryName: string,
  options: BinaryResolutionOptions = {}
): Promise<BinaryHealthResult> {
  const normalizedName = getNormalizedBinaryName(binaryName);
  const locations: Array<{ path: string | null; source: string }> = [];

  // 1. Configured path (highest priority)
  if (options.configuredPath) {
    locations.push({
      path: options.configuredPath,
      source: 'configured',
    });
  }

  // 2. Bundled binaries
  if (options.bundledDir) {
    locations.push({
      path: path.join(options.bundledDir, normalizedName),
      source: 'bundled',
    });
  }

  // 3. System PATH (if enabled, default true)
  if (options.systemPath !== false) {
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
    for (const dir of pathDirs) {
      locations.push({
        path: path.join(dir, normalizedName),
        source: 'system_path',
      });
    }
  }

  // 4. Managed cache (lowest priority)
  if (options.managedCache !== false) {
    locations.push({
      path: path.join(getManagedCacheDir(), normalizedName),
      source: 'managed_cache',
    });
  }

  // Try each location in order
  for (const location of locations) {
    if (location.path && checkExecutable(location.path)) {
      return {
        resolvedPath: location.path,
        isExecutable: true,
        version: null, // TODO: extract version from binary
        failureReason: null,
        remediationHint: null,
      };
    }
  }

  // Not found in any location
  return {
    resolvedPath: null,
    isExecutable: false,
    version: null,
    failureReason: `Binary '${binaryName}' not found in any checked location`,
    remediationHint: `Install ${binaryName} or configure its path in settings`,
  };
}
