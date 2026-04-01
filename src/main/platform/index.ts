// Platform service exports - centralized import surface

export {
  getAppDataDir,
  getLogsDir,
  getWorkDir,
  getManagedCacheDir,
} from './path-service';

export {
  resolveBinary,
  getNormalizedBinaryName,
  type BinaryResolutionOptions,
  type BinaryHealthResult,
} from './binary-resolver';
