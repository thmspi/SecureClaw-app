import { RollbackService, InstallArtifact } from '../rollback-service';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  rm: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

import { rm, unlink } from 'fs/promises';

describe('RollbackService', () => {
  let service: RollbackService;

  beforeEach(() => {
    service = new RollbackService();
    jest.clearAllMocks();
  });

  describe('track', () => {
    it('should add artifact to list', () => {
      const artifact: InstallArtifact = {
        type: 'file',
        path: '/test/file.txt',
        createdAt: new Date().toISOString(),
      };

      service.track(artifact);

      expect(service.getSummary()).toContain('/test/file.txt');
    });

    it('should accumulate multiple artifacts', () => {
      service.track({ type: 'file', path: '/a.txt', createdAt: '' });
      service.track({ type: 'directory', path: '/dir', createdAt: '' });
      service.track({ type: 'file', path: '/b.txt', createdAt: '' });

      expect(service.getSummary()).toHaveLength(3);
    });
  });

  describe('getSummary', () => {
    it('should return all tracked paths', () => {
      service.track({ type: 'file', path: '/file1.txt', createdAt: '' });
      service.track({ type: 'directory', path: '/dir1', createdAt: '' });

      const summary = service.getSummary();

      expect(summary).toEqual(['/file1.txt', '/dir1']);
    });

    it('should return empty array when no artifacts tracked', () => {
      expect(service.getSummary()).toEqual([]);
    });
  });

  describe('rollback', () => {
    it('should remove files in reverse order (LIFO)', async () => {
      const callOrder: string[] = [];
      (unlink as jest.Mock).mockImplementation((path) => {
        callOrder.push(path);
        return Promise.resolve();
      });

      service.track({ type: 'file', path: '/first.txt', createdAt: '' });
      service.track({ type: 'file', path: '/second.txt', createdAt: '' });
      service.track({ type: 'file', path: '/third.txt', createdAt: '' });

      await service.rollback();

      expect(callOrder).toEqual(['/third.txt', '/second.txt', '/first.txt']);
    });

    it('should use rm with recursive for directories', async () => {
      service.track({ type: 'directory', path: '/mydir', createdAt: '' });

      await service.rollback();

      expect(rm).toHaveBeenCalledWith('/mydir', { recursive: true, force: true });
    });

    it('should use unlink for files', async () => {
      service.track({ type: 'file', path: '/myfile.txt', createdAt: '' });

      await service.rollback();

      expect(unlink).toHaveBeenCalledWith('/myfile.txt');
    });

    it('should return list of removed paths', async () => {
      service.track({ type: 'file', path: '/a.txt', createdAt: '' });
      service.track({ type: 'file', path: '/b.txt', createdAt: '' });

      const removed = await service.rollback();

      expect(removed).toContain('/a.txt');
      expect(removed).toContain('/b.txt');
    });

    it('should continue on individual removal errors', async () => {
      (unlink as jest.Mock)
        .mockResolvedValueOnce(undefined) // first succeeds
        .mockRejectedValueOnce(new Error('File not found')) // second fails
        .mockResolvedValueOnce(undefined); // third succeeds

      service.track({ type: 'file', path: '/first.txt', createdAt: '' });
      service.track({ type: 'file', path: '/second.txt', createdAt: '' });
      service.track({ type: 'file', path: '/third.txt', createdAt: '' });

      const removed = await service.rollback();

      // Should have attempted all 3, succeeded on 2
      expect(unlink).toHaveBeenCalledTimes(3);
      expect(removed).toHaveLength(2);
    });

    it('should clear artifacts after rollback', async () => {
      service.track({ type: 'file', path: '/file.txt', createdAt: '' });

      await service.rollback();

      expect(service.getSummary()).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should empty artifact list without file operations', () => {
      service.track({ type: 'file', path: '/file.txt', createdAt: '' });
      service.track({ type: 'directory', path: '/dir', createdAt: '' });

      service.clear();

      expect(service.getSummary()).toEqual([]);
      expect(rm).not.toHaveBeenCalled();
      expect(unlink).not.toHaveBeenCalled();
    });
  });
});
