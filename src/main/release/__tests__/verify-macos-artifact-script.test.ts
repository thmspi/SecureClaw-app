import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readIfExists(path: string): string {
  if (!existsSync(path)) {
    return '';
  }

  return readFileSync(path, 'utf8');
}

describe('macOS artifact verification gate script', () => {
  const verifyScriptPath = resolve(process.cwd(), 'scripts/release/verify-macos-artifact.sh');

  it('runs codesign, gatekeeper, and stapler validation checks', () => {
    const verifyScript = readIfExists(verifyScriptPath);
    expect(verifyScript).toMatch(/codesign --verify --deep --strict --verbose=2/);
    expect(verifyScript).toMatch(/spctl --assess --type execute --verbose/);
    expect(verifyScript).toMatch(/xcrun stapler validate/);
  });

  it('launches the SecureClaw binary for smoke testing', () => {
    const verifyScript = readIfExists(verifyScriptPath);
    expect(verifyScript).toMatch(/Contents\/MacOS\/SecureClaw/);
    expect(verifyScript).toMatch(/10/);
  });
});
