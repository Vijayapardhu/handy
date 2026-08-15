// Builds the extension into the folder students load into their browser.
//
//   node extension/tool/pack.mjs
//
// Produces, in dist-extension/:
//
//   handy/                a clean copy of the extension — Load unpacked points
//                         here when you're testing a change locally.
//   handy-unpacked.zip    the same folder, zipped, with everything under a
//                         top-level handy/ so extracting it anywhere lands one
//                         tidy directory instead of scattering files. This is
//                         the file to attach to a GitHub release.
//
// Handy ships unpacked and open source. There is no signing step, because
// nothing checks a signature on this path: Chrome refuses self-signed .crx
// installs (blocked since Chrome 33, and a policy install additionally demands
// a store publisher proof we cannot produce), and a store would sign the
// package itself. The signed-.crx and store-.zip builds this script used to
// emit are in git history if a store route is ever revisited.
//
// manifest.json's "key" is KEPT here, unlike a store package where it has to
// come out. It pins the extension ID to ledmfeohpnfmepdbncmcidoaflhijmkn no
// matter which folder a student extracts to, which is what lets the Handy web
// app talk to the extension at all.
//
// See INSTALL.md for what students are told to do with the zip.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(here, '..');
const projectRoot = resolve(extensionRoot, '..');
const dist = join(projectRoot, 'dist-extension');

/**
 * Never shipped: harnesses, notes, and anything a browser has no use for.
 *
 * `build/` holds the public-key artifacts the ID was derived from and
 * `scripts/` the icon generator — both are how the extension gets made, not
 * part of it, and a student opening the folder should see only what runs.
 */
const EXCLUDE = new Set([
  'test',
  'tool',
  'build',
  'scripts',
  'README.md',
  '.gitignore',
  'node_modules',
]);

/**
 * The extension ID Chrome derives from a public key: SHA-256 of the DER, first
 * 16 bytes, every nibble mapped 0-f to a-p. Computed rather than hardcoded so a
 * changed manifest key can never silently disagree with what's documented.
 */
function idFromManifestKey(key) {
  return [...createHash('sha256').update(Buffer.from(key, 'base64')).digest().subarray(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .split('')
    .map((ch) => String.fromCharCode(parseInt(ch, 16) + 97))
    .join('');
}

const manifest = JSON.parse(readFileSync(join(extensionRoot, 'manifest.json'), 'utf8'));

if (!manifest.key) {
  console.error('manifest.json has no "key". The extension ID would change with the folder it');
  console.error('was extracted to, and the web app could no longer reach it. Refusing to build.');
  process.exit(1);
}

// The listing-facing limit is a store thing, but an over-long description is
// also just wrong in the browser's extension list, so it stays checked.
if (manifest.description.length > 132) {
  console.error(`manifest.json "description" is ${manifest.description.length} chars; the limit is 132.`);
  process.exit(1);
}

const id = idFromManifestKey(manifest.key);

mkdirSync(dist, { recursive: true });

const staging = join(dist, 'handy');
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
cpSync(extensionRoot, staging, {
  recursive: true,
  filter: (src) => {
    const relative = src.slice(extensionRoot.length + 1);
    if (!relative) return true;
    return !EXCLUDE.has(relative.split(/[\\/]/)[0]);
  },
});

const zip = join(dist, 'handy-unpacked.zip');
rmSync(zip, { force: true });
// Entries are added one at a time with their names forced to forward slashes.
// Both Compress-Archive and ZipFile.CreateFromDirectory have, on Windows
// PowerShell, written entry names containing backslashes — the ZIP format
// specifies "/" regardless of platform, and an archive like that unpacks on a
// student's machine as one file literally named "src\background.js" rather
// than a src directory, which Chrome then refuses to load.
execFileSync('powershell', [
  '-NoProfile',
  '-Command',
  [
    `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
    `$root = '${staging}'`,
    `$zip = [System.IO.Compression.ZipFile]::Open('${zip}', 'Create')`,
    `Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object {`,
    `  $name = 'handy/' + $_.FullName.Substring($root.Length + 1).Replace('\\', '/')`,
    `  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $name)`,
    `}`,
    `$zip.Dispose()`,
  ].join('; '),
], { stdio: 'inherit' });

if (!existsSync(zip)) {
  console.error('The zip was not written. Check the output above.');
  process.exit(1);
}

console.log(`\nversion   ${manifest.version}`);
console.log(`id        ${id}`);
console.log(`\nrelease   ${zip}`);
console.log(`          attach this to the GitHub release — see extension/tool/INSTALL.md`);
console.log(`local     ${staging}`);
console.log(`          Load unpacked points here while developing`);
