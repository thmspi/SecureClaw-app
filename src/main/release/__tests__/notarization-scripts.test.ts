import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function readIfExists(path: string): string {
  if (!existsSync(path)) {
    return '';
  }

  return readFileSync(path, 'utf8');
}

describe('macOS notarization scripts', () => {
  const preflightPath = resolve(process.cwd(), 'scripts/release/preflight-macos-signing.sh');
  const notarizePath = resolve(process.cwd(), 'scripts/release/notarize.mjs');

  it('fails preflight when APPLE_KEYCHAIN_PROFILE is missing', () => {
    const result = spawnSync('bash', [preflightPath], {
      env: { ...process.env, APPLE_KEYCHAIN_PROFILE: '' },
      encoding: 'utf8'
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/APPLE_KEYCHAIN_PROFILE/);
  });

  it('checks for a Developer ID Application identity in preflight', () => {
    const preflightScript = readIfExists(preflightPath);
    expect(preflightScript).toMatch(/Developer ID Application/);
  });

  it('submits with notarytool and staples the app', () => {
    const notarizeScript = readIfExists(notarizePath);
    expect(notarizeScript).toMatch(/notarytool submit/);
    expect(notarizeScript).toMatch(/stapler staple/);
  });
});
