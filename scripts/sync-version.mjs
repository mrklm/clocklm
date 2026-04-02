import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');

function readJson(relativePath) {
  const filePath = resolve(rootDir, relativePath);
  return {
    filePath,
    data: JSON.parse(readFileSync(filePath, 'utf8')),
  };
}

function writeJson(filePath, data) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

const packageJson = readJson('package.json');
const packageLockJson = readJson('package-lock.json');
const tauriConfigJson = readJson('src-tauri/tauri.conf.json');

const nextVersion = packageJson.data.version;

if (typeof nextVersion !== 'string' || !nextVersion.trim()) {
  throw new Error('package.json version is missing or invalid');
}

packageLockJson.data.version = nextVersion;
if (packageLockJson.data.packages?.['']) {
  packageLockJson.data.packages[''].version = nextVersion;
}

tauriConfigJson.data.version = nextVersion;

writeJson(packageLockJson.filePath, packageLockJson.data);
writeJson(tauriConfigJson.filePath, tauriConfigJson.data);

console.log(`Synchronized app version to ${nextVersion}`);
