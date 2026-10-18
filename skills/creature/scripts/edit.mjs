#!/usr/bin/env node
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEditedSpec } from '../kit/spec.mjs';

export async function editMain(args = process.argv.slice(2)) {
  if (args.includes('--help')) { console.log('Usage: node scripts/edit.mjs input.json output.json --set proportions.legLength=1.05 [--category fictional] [--id new-id] [--prompt "follow-up request"]\nCreates a new file; never overwrites either the original or an existing output.'); return; }
  const [input, output, ...flags] = args;
  if (!input || !output) throw new Error('Provide input.json and a new output.json; use --help for usage.');
  const edits = [], options = {};
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i], value = flags[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
    if (flag === '--set') {
      const eq = value.indexOf('=');
      if (eq < 1) throw new Error('--set needs path=value.');
      let parsed; try { parsed = JSON.parse(value.slice(eq + 1)); } catch { parsed = value.slice(eq + 1); }
      edits.push([value.slice(0, eq), parsed]);
    } else if (['--category', '--id', '--prompt'].includes(flag)) options[flag.slice(2)] = value;
    else throw new Error(`Unknown option ${flag}.`);
  }
  if (!edits.length && options.category === undefined) throw new Error('Specify at least one --set change or an explicit --category fictional transition.');
  const originalPath = await realpath(input);
  const outputPath = path.resolve(output);
  const existingOutput = await realpath(outputPath).catch(() => outputPath);
  const equal = process.platform === 'win32' ? originalPath.toLowerCase() === existingOutput.toLowerCase() : originalPath === existingOutput;
  if (equal) throw new Error('Refusing to overwrite the original. Choose a different output file.');
  const result = createEditedSpec(JSON.parse(await readFile(originalPath, 'utf8')), edits, options);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  console.log(`Saved ${outputPath}. Regenerate the model and repeat visual review.`);
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) editMain().catch(error => { console.error(error.message); process.exitCode = 1; });
