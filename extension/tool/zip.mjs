// Writes a ZIP archive, in Node, with no external tool.
//
// This exists because the alternatives all tie the build to one machine, and
// the build that only runs on one machine is the one that never runs in CI:
//
//   powershell     what pack.mjs used to call. Absent on Linux, so the release
//                  workflow could not produce the extension zip at all — which
//                  is why /releases/latest/download/handy-unpacked.zip 404'd
//                  on every release while the website linked to it.
//   Compress-Archive / ZipFile.CreateFromDirectory
//                  on Windows PowerShell these have written entry names
//                  containing backslashes. The ZIP format specifies "/"
//                  regardless of platform, and an archive like that extracts
//                  on a student's machine as one file literally named
//                  "src\background.js" instead of a src directory, which
//                  Chrome then refuses to load.
//   zip(1)         fine on the runners, absent on a plain Windows box.
//
// So the container is written here instead. It is a small, very fixed format,
// and getting it right once costs less than a build that works in one place.
// Entry names are joined with "/" by construction — there is no code path that
// could emit a backslash.
import { deflateRawSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';

/** Standard CRC-32, the checksum every ZIP entry carries. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * MS-DOS packed time and date, which is what ZIP stores.
 *
 * Two-second resolution and no year before 1980 — both are the format's, not
 * ours. A file older than that (or one with a broken mtime) is clamped rather
 * than written as a negative year, which some extractors read as a corrupt
 * archive.
 */
function dosStamp(date) {
  const d = date.getFullYear() < 1980 ? new Date(1980, 0, 1) : date;
  return {
    time: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff,
    date: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff,
  };
}

/**
 * Builds a ZIP from `[{ name, path }]` and returns it as a Buffer.
 *
 * `name` is the path inside the archive and is written exactly as given, so
 * callers must already be using forward slashes. Files only: extractors create
 * the intervening directories from the entry names, and directory records
 * would only be one more thing to get wrong.
 */
export function zipFiles(entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const contents = readFileSync(entry.path);
    const crc = crc32(contents);
    const stamp = dosStamp(statSync(entry.path).mtime);

    // Whichever is smaller. Deflate can grow a tiny or already-compressed
    // file, and a "compressed" entry larger than its input is just waste.
    const deflated = deflateRawSync(contents, { level: 9 });
    const stored = deflated.length >= contents.length;
    const body = stored ? contents : deflated;
    const method = stored ? 0 : 8;

    // Bit 11 says the name is UTF-8. The extension's filenames are all ASCII
    // today, but a name that is not would otherwise be read in the archiver's
    // local codepage, which is a different name on a different machine.
    const flags = 0x0800;

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(contents.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // no extra field
    name.copy(local, 30);

    const header = Buffer.alloc(46 + name.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4); // version made by
    header.writeUInt16LE(20, 6); // version needed
    header.writeUInt16LE(flags, 8);
    header.writeUInt16LE(method, 10);
    header.writeUInt16LE(stamp.time, 12);
    header.writeUInt16LE(stamp.date, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(body.length, 20);
    header.writeUInt32LE(contents.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30); // extra
    header.writeUInt16LE(0, 32); // comment
    header.writeUInt16LE(0, 34); // disk number
    header.writeUInt16LE(0, 36); // internal attributes
    header.writeUInt32LE(0, 38); // external attributes
    header.writeUInt32LE(offset, 42);
    name.copy(header, 46);

    locals.push(local, body);
    central.push(header);
    offset += local.length + body.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with the directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // no archive comment

  return Buffer.concat([...locals, directory, end]);
}
