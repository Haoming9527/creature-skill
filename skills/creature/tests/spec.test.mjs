import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateSpec, createEditedSpec, creatureSpecSchema } from '../kit/spec.mjs';

const example = async name => JSON.parse(await readFile(new URL(`../examples/${name}.json`, import.meta.url), 'utf8'));
const codes = spec => validateSpec(spec).errors.map(error => error.code);

test('reference examples pass specification checks without implying visual approval', async () => {
  for (const name of ['cow', 'horse', 'horse-longer-legs']) {
    const spec = await example(name), before = JSON.stringify(spec), report = validateSpec(spec);
    assert.equal(report.valid, true, JSON.stringify(report.errors));
    assert(report.warnings.some(item => item.code === 'HUMAN_REVIEW_REQUIRED'));
    assert.equal(JSON.stringify(spec), before, 'validation must not mutate its input');
  }
});

test('unknown fields, non-finite numbers and undeclared assets cannot silently pass', async () => {
  const spec = await example('cow');
  spec.proportions.legLenght = 1.05;
  spec.proportions.scale = NaN;
  spec.features.wings = true;
  assert(codes(spec).includes('UNKNOWN_FIELD'));
  assert(codes(spec).includes('INVALID_TYPE'));
});

test('evidence must link to declared sources and distinguish unsupported living claims', async () => {
  const spec = await example('cow');
  spec.evidence.find(item => item.trait === 'feet').sourceIds = ['not-a-source'];
  spec.evidence.find(item => item.trait === 'gait').status = 'artistic';
  spec.evidence = spec.evidence.filter(item => item.trait !== 'anatomy');
  assert(codes(spec).includes('UNKNOWN_SOURCE'));
  assert(codes(spec).includes('UNSUPPORTED_LIVING_CLAIM'));
  assert(codes(spec).includes('MISSING_EVIDENCE_TRAIT'));
});

test('invalid dates, duplicate IDs, and empty identity are diagnosed', async () => {
  const spec = await example('horse');
  spec.sources[0].accessed = '2026-02-30';
  spec.identity.sex = '';
  assert(codes(spec).includes('INVALID_DATE'));
  assert(codes(spec).includes('EMPTY_VALUE'));
  spec.sources[0].accessed = '2026-10-18'; spec.identity.sex = 'gelding';
  spec.sources[1].id = spec.sources[0].id;
  assert(codes(spec).includes('DUPLICATE_SOURCE'));
});

test('living identity cannot be relabeled onto an incompatible existing body', async () => {
  const spec = await example('cow');
  spec.identity.scientificName = 'Panthera leo';
  spec.identity.lifeStage = 'calf';
  assert(codes(spec).includes('PROFILE_IDENTITY_CONFLICT'));
  assert(codes(spec).includes('UNSUPPORTED_LIFE_STAGE'));
  spec.bodyPlan = 'bird'; spec.profile = 'eagle';
  assert(codes(spec).includes('UNSUPPORTED_BODY_PLAN'));
  assert(codes(spec).includes('UNSUPPORTED_PROFILE'));
});

test('extinct dossiers require trait-specific uncertainty and do not claim supported generation', async () => {
  const spec = await example('horse');
  spec.category = 'extinct';
  spec.evidence = [{trait:'anatomy',status:'observed',sourceIds:['hoof-anatomy'],notes:'Test routing fixture; not a genuine extinct dossier.'}];
  const report = validateSpec(spec);
  assert(report.errors.some(item => item.code === 'UNSUPPORTED_EXTINCT_PROFILE'));
  for (const trait of ['surface','coloration','movement']) assert(report.errors.some(item => item.code === 'MISSING_EVIDENCE_TRAIT' && item.message.includes(trait)));
  spec.evidence.push(...['surface','coloration','movement'].map(trait => ({trait,status:'artistic',sourceIds:[],notes:'Interpretation, no direct evidence claimed.'})));
  assert(!codes(spec).includes('MISSING_EVIDENCE_TRAIT'));
  assert.equal(validateSpec(spec).valid, false, 'adding uncertainty notes cannot unlock unsupported geometry');
});

test('fictional designs have brief fidelity criteria and cited portrayals are not biological evidence', async () => {
  const spec = await example('horse');
  spec.category = 'fictional'; spec.sources = []; spec.evidence = [];
  assert(codes(spec).includes('MISSING_EVIDENCE_TRAIT'));
  spec.evidence.push({trait:'design',status:'artistic',sourceIds:[],notes:'Original horse-like creature, coherent four-limbed body and an amber coat.'});
  const report = validateSpec(spec);
  assert.equal(report.valid, true, JSON.stringify(report.errors));
  assert(report.warnings.some(item => item.code === 'FICTIONAL_INTERPRETATION'));
  spec.features.horns = true;
  assert(codes(spec).includes('UNSUPPORTED_FEATURE'), 'fiction does not bypass missing geometry');
});

test('safe proportion edits preserve seed, sources, original content and review obligations', async () => {
  const original = await example('horse'), before = JSON.stringify(original);
  const result = createEditedSpec(original, {'proportions.legLength':1.05}, {id:'longer-legs'});
  assert.equal(JSON.stringify(original), before);
  assert.equal(result.proportions.legLength, 1.05);
  assert.equal(result.seed, original.seed);
  assert.deepEqual(result.sources, original.sources);
  assert.equal(result.category, 'living');
  assert(result.notes.at(-1).includes(original.id));
  assert(result.notes.at(-1).includes('visual review is pending'));
});

test('fictional features still require their profile implementation', async () => {
  const original = await example('cow');
  assert.throws(() => createEditedSpec(original, {'features.mane':true}, {category:'fictional'}), error => error.code === 'UNSUPPORTED_FEATURE');
});

test('declared movements match the fixed v1 export capabilities', async () => {
  const spec = await example('horse');
  spec.supportedMovements = ['idle'];
  assert.equal(validateSpec(spec).valid, false);
  spec.supportedMovements = ['walk','idle'];
  spec.attachments = [];
  spec.behavior.jawLimit = spec.behavior.headYawLimit = spec.behavior.headPitchLimit = 0;
  assert.equal(validateSpec(spec).valid, true);
});

test('realism conflicts require an explicit fictional category transition', async () => {
  const original = await example('horse');
  assert.throws(() => createEditedSpec(original, {'proportions.legLength':1.2}), error => error.code === 'REALISM_CONFLICT' && /fictional derivative/.test(error.message));
  const result = createEditedSpec(original, {'proportions.legLength':1.2}, {category:'fictional'});
  assert.equal(result.category, 'fictional');
  assert(result.evidence.some(item => item.trait === 'design' && item.status === 'artistic'));
  assert.equal(original.category, 'living');
  assert.throws(() => createEditedSpec(original, {category:'fictional'}), error => error.code === 'UNSAFE_EDIT');
  assert.throws(() => createEditedSpec(original, [], {category:'extinct'}), error => error.code === 'CATEGORY_TRANSITION');
});

test('edit paths reject prototype injection and do not accept typo parameters', async () => {
  const original = await example('cow');
  for (const editPath of ['__proto__.polluted','proportions.constructor.prototype.polluted']) assert.throws(() => createEditedSpec(original, [[editPath,true]]), error => error.code === 'UNSAFE_EDIT');
  assert.equal({}.polluted, undefined);
  assert.throws(() => createEditedSpec(original, {'proportions.legLenght':1.05}), error => error.code === 'UNKNOWN_FIELD');
});

test('CLI edit refuses original and existing outputs', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'creature-edit-'));
  try {
    const original = await example('horse'), text = JSON.stringify(original), input = path.join(dir,'original.json'), output = path.join(dir,'edited.json');
    await writeFile(input,text);
    const cli = fileURLToPath(new URL('../scripts/edit.mjs',import.meta.url));
    const run = destination => spawnSync(process.execPath,[cli,input,destination,'--set','proportions.legLength=1.05'],{encoding:'utf8'});
    assert.equal(run(input).status,1);
    assert.equal(await readFile(input,'utf8'),text);
    assert.equal(run(output).status,0);
    const saved = await readFile(output,'utf8');
    assert.equal(run(output).status,1);
    assert.equal(await readFile(output,'utf8'),saved);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('published JSON Schema matches the validator contract', async () => {
  const published = JSON.parse(await readFile(new URL('../schemas/creature.schema.json',import.meta.url),'utf8'));
  assert.deepEqual(published,creatureSpecSchema);
});

test('validation report cannot replace its source specification', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'creature-validate-'));
  try {
    const text = JSON.stringify(await example('cow')), input = path.join(dir,'original.json');
    await writeFile(input,text);
    const cli = fileURLToPath(new URL('../scripts/validate.mjs',import.meta.url));
    const result = spawnSync(process.execPath,[cli,input,'--out',input],{encoding:'utf8'});
    assert.equal(result.status,1);
    assert.match(result.stderr,/Refusing to overwrite/);
    assert.equal(await readFile(input,'utf8'),text);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
