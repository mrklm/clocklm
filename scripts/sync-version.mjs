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

function syncCargoVersion(relativePath, nextVersion) {
  const filePath = resolve(rootDir, relativePath);
  const currentContent = readFileSync(filePath, 'utf8');
  const versionLinePattern = /^version = ".*"$/m;

  if (!versionLinePattern.test(currentContent)) {
    throw new Error(`Unable to synchronize Cargo version in ${relativePath}`);
  }

  const nextContent = currentContent.replace(
    versionLinePattern,
    `version = "${nextVersion}"`,
  );

  writeFileSync(filePath, nextContent);
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
syncCargoVersion('src-tauri/Cargo.toml', nextVersion);

console.log(`Synchronized app version to ${nextVersion}`);
