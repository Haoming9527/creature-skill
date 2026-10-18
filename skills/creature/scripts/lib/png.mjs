import zlib from 'node:zlib';

/** Minimal 8-bit, non-interlaced PNG reader (gray, RGB, RGBA, gray+alpha). */
export function decodePNG(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG file.');
  let offset = 8, width = 0, height = 0, type = 0, depth = 0, interlace = 0; const data = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset), name = buffer.toString('ascii', offset + 4, offset + 8), chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (name === 'IHDR') { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); depth = chunk[8]; type = chunk[9]; interlace = chunk[12]; }
    else if (name === 'IDAT') data.push(chunk);
    else if (name === 'IEND') break;
    offset += 12 + length;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (depth !== 8 || !channels || interlace) throw new Error(`Unsupported PNG (depth ${depth}, type ${type}, interlace ${interlace}).`);
  const raw = zlib.inflateSync(Buffer.concat(data)), stride = width * channels, pixels = new Uint8Array(width * height * 4), line = new Uint8Array(stride), prior = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0, b = prior[i], c = i >= channels ? prior[i - channels] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      line[i] = (row[i] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter]) & 255;
    }
    for (let x = 0; x < width; x++) {
      const s = line.subarray(x * channels, x * channels + channels), o = (y * width + x) * 4;
      if (channels <= 2) { pixels[o] = pixels[o + 1] = pixels[o + 2] = s[0]; pixels[o + 3] = channels === 2 ? s[1] : 255; }
      else { pixels[o] = s[0]; pixels[o + 1] = s[1]; pixels[o + 2] = s[2]; pixels[o + 3] = channels === 4 ? s[3] : 255; }
    }
    prior.set(line);
  }
  return { width, height, pixels };
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buffer => { let c = 0xffffffff; for (const b of buffer) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (name, data) => { const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(name, 4, 'ascii'); data.copy(out, 8); out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length); return out; };

/** Encode RGBA pixels as an unfiltered PNG. */
export function encodePNG({ width, height, pixels }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
