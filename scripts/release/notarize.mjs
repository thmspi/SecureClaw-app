import { spawn } from 'node:child_process';
import { join } from 'node:path';

const PREFIX = '[notarize-macos]';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
    });
  });
}

export default async function notarizeMacArtifact(context) {
  const keychainProfile = process.env.APPLE_KEYCHAIN_PROFILE;
  if (!keychainProfile) {
    throw new Error(
      'APPLE_KEYCHAIN_PROFILE is missing. Configure notarytool credentials before packaging.'
    );
  }

  const appOutDir = context?.appOutDir;
  const productFilename = context?.packager?.appInfo?.productFilename;
  if (!appOutDir || !productFilename) {
    throw new Error('Electron builder context is missing appOutDir or productFilename.');
  }

  const appPath = join(appOutDir, `${productFilename}.app`);

  try {
    console.log(`${PREFIX} START: xcrun notarytool submit ${appPath}`);
    await run('xcrun', [
      'notarytool',
      'submit',
      appPath,
      '--keychain-profile',
      keychainProfile,
      '--wait'
    ]);
    console.log(`${PREFIX} SUCCESS: xcrun notarytool submit ${appPath}`);

    console.log(`${PREFIX} START: xcrun stapler staple ${appPath}`);
    await run('xcrun', ['stapler', 'staple', appPath]);
    console.log(`${PREFIX} SUCCESS: xcrun stapler staple ${appPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${PREFIX} FAILURE: ${message}`);
    throw error;
  }
}
