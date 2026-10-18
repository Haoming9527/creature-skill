#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { skillRoot, listFiles, readJSON } from './lib/common.mjs';
const issues = [];
const skill = await fs.readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
const match = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!match) issues.push('SKILL.md needs YAML frontmatter.');
else {
  const name = match[1].match(/^name:\s*(.+)$/m)?.[1].trim();
  if (name !== 'creature' || path.basename(skillRoot) !== name) issues.push('Skill name must match directory name creature.');
  if (!/^description:\s*\S/m.test(match[1])) issues.push('Skill description is missing.');
}
if (skill.split('\n').length > 500) issues.push('Move detailed guidance into references to keep SKILL.md below 500 lines.');
for (const file of ['LICENSE', 'package-lock.json', 'assets/LICENSES.md', 'kit/creature.mjs', 'kit/spec.mjs', 'examples/cow.json', 'examples/horse.json', 'evals/evals.json']) {
  if (!(await fs.stat(path.join(skillRoot, file)).catch(() => null))) issues.push(`Missing distributable resource: ${file}`);
}
const files = await listFiles(skillRoot);
for (const file of files.filter(f=>f.endsWith('.md'))) {
  const content=await fs.readFile(path.join(skillRoot,file),'utf8');
  for (const link of content.matchAll(/\]\(([^)]+)\)/g)) {
    const target=link[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;
    if(!(await fs.stat(path.resolve(skillRoot,path.dirname(file),target)).catch(()=>null)))issues.push(`${file}: broken relative link ${target}`);
  }
}
const examples = ['cow','horse','horse-longer-legs']; const {validateSpec}=await import('../kit/spec.mjs');
for(const name of examples){const r=validateSpec(await readJSON(path.join(skillRoot,`examples/${name}.json`)));if(!r.valid)issues.push(`${name}: ${r.errors.map(e=>e.message).join('; ')}`);}
console.log(JSON.stringify({passed:issues.length===0,files:files.length,skillLines:skill.split('\n').length,issues},null,2));
if(issues.length)process.exitCode=1;
