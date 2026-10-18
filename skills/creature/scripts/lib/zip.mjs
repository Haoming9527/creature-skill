import fs from 'node:fs/promises';
import path from 'node:path';
const crcTable = Array.from({ length: 256 }, (_, i) => { for (let n = 0; n < 8; n++) i = (i & 1) ? 0xedb88320 ^ (i >>> 1) : i >>> 1; return i >>> 0; });
function crc32(buffer) { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
/** Reproducible uncompressed ZIP; original editable sources stay inspectable. */
export async function zipFiles(root, files, destination) {
  const local = [], central = []; let offset = 0;
  for (const relative of [...files].sort()) {
    const name = Buffer.from(relative.split(path.sep).join('/')); const data = await fs.readFile(path.join(root, relative)); const crc = crc32(data);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20,4); header.writeUInt16LE(0x800,6); header.writeUInt16LE(33,12); header.writeUInt32LE(crc,14); header.writeUInt32LE(data.length,18); header.writeUInt32LE(data.length,22); header.writeUInt16LE(name.length,26);
    local.push(header, name, data);
    const dir = Buffer.alloc(46); dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(20,4); dir.writeUInt16LE(20,6); dir.writeUInt16LE(0x800,8); dir.writeUInt16LE(33,14); dir.writeUInt32LE(crc,16); dir.writeUInt32LE(data.length,20); dir.writeUInt32LE(data.length,24); dir.writeUInt16LE(name.length,28); dir.writeUInt32LE(offset,42); central.push(dir,name);
    offset += header.length + name.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
  await fs.writeFile(destination, Buffer.concat([...local, directory, end]));
}
