import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

export const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const isMain = (url) => process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === url;
export function parseArgs(argv = process.argv.slice(2)) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) { result._.push(argv[i]); continue; }
    const [key, inline] = argv[i].slice(2).split(/=(.*)/s, 2);
    result[key] = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
  }
  return result;
}
export async function writeJSON(file, data) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`); }
export async function readJSON(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
export async function listFiles(root, prefix = '', excluded = []) {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    if (entry.isSymbolicLink() || ['node_modules', 'out', '.cache', '.git', 'eval-workspace'].includes(entry.name)) continue;
    const relative = path.join(prefix, entry.name);
    const absolute = path.resolve(root, relative);
    if (excluded.some(p => absolute === path.resolve(p) || absolute.startsWith(`${path.resolve(p)}${path.sep}`))) continue;
    if (entry.isDirectory()) result.push(...await listFiles(root, relative, excluded)); else result.push(relative);
  }
  return result.sort();
}
