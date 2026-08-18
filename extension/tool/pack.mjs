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
// Runs anywhere Node does. The zip used to be written by shelling out to
// PowerShell, which meant this script could only run on Windows — so the
// release workflow could not produce the extension zip at all, and the
// download link the website points at 404'd on every release. See tool/zip.mjs.
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
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipFiles } from './zip.mjs';

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

/** Every file under a folder, recursively. */
function filesUnder(directory) {
  const found = [];
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, item.name);
    if (item.isDirectory()) found.push(...filesUnder(full));
    else if (item.isFile()) found.push(full);
  }
  return found;
}

// Everything lands under a top-level handy/ so extracting the zip anywhere
// gives one tidy directory instead of scattering files across a downloads
// folder. Entry names are joined with "/" explicitly: the ZIP format specifies
// forward slashes on every platform, and an archive carrying backslashes
// extracts on a student's machine as one file literally named
// "src\background.js" rather than a src directory, which Chrome then refuses
// to load.
const entries = filesUnder(staging)
  .map((path) => ({
    path,
    name: 'handy/' + relative(staging, path).split(sep).join('/'),
  }))
  // Sorted, so two builds of the same source produce the same archive rather
  // than one that differs by whatever order the filesystem listed things in.
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(zip, zipFiles(entries));

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
