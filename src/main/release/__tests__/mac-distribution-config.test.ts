import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readIfExists(path: string): string {
  if (!existsSync(path)) {
    return '';
  }

  return readFileSync(path, 'utf8');
}

describe('macOS distribution config baseline', () => {
  const builderConfigPath = resolve(process.cwd(), 'electron-builder.yml');
  const entitlementsPath = resolve(process.cwd(), 'build/entitlements.mac.plist');

  it('includes dmg and zip targets for mac builds', () => {
    const builderConfig = readIfExists(builderConfigPath);
    expect(builderConfig).toMatch(/target:\s*\[dmg,\s*zip\]/);
  });

  it('enables hardened runtime and shared entitlements plist', () => {
    const builderConfig = readIfExists(builderConfigPath);
    expect(builderConfig).toMatch(/hardenedRuntime:\s*true/);
    expect(builderConfig).toMatch(/entitlements:\s*build\/entitlements\.mac\.plist/);
    expect(builderConfig).toMatch(/entitlementsInherit:\s*build\/entitlements\.mac\.plist/);
  });

  it('declares hardened runtime entitlement keys', () => {
    const entitlements = readIfExists(entitlementsPath);
    expect(entitlements).toMatch(/<key>com\.apple\.security\.cs\./);
  });
});
