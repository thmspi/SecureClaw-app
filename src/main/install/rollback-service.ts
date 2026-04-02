import { rm, unlink } from 'fs/promises';

export interface InstallArtifact {
  type: 'file' | 'directory' | 'symlink';
  path: string;
  createdAt: string;
}

/**
 * Tracks install artifacts and removes them in reverse order on rollback (D-15)
 */
export class RollbackService {
  private artifacts: InstallArtifact[] = [];

  /**
   * Track an artifact for potential rollback
   */
  track(artifact: InstallArtifact): void {
    this.artifacts.push(artifact);
  }

  /**
   * Get list of tracked artifact paths
   */
  getSummary(): string[] {
    return this.artifacts.map((a) => a.path);
  }

  /**
   * Remove all tracked artifacts in reverse order (LIFO)
   * Continues on errors (best effort cleanup)
   */
  async rollback(): Promise<string[]> {
    const removed: string[] = [];
    const toRemove = [...this.artifacts].reverse();

    for (const artifact of toRemove) {
      try {
        if (artifact.type === 'directory') {
          await rm(artifact.path, { recursive: true, force: true });
        } else {
          await unlink(artifact.path);
        }
        removed.push(artifact.path);
      } catch (error) {
        // Best effort - log and continue
        console.warn(`Failed to remove ${artifact.path}:`, error);
      }
    }

    this.artifacts = [];
    return removed;
  }

  /**
   * Clear tracked artifacts without removing files
   */
  clear(): void {
    this.artifacts = [];
  }
}

// Singleton instance
export const rollbackService = new RollbackService();
