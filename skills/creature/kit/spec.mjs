/** Specification contract and semantic checks. No rendering or Node dependency. */
export const CATEGORIES = Object.freeze(['living', 'extinct', 'fictional']);
export const PROFILES = Object.freeze(['holstein', 'thoroughbred']);
export const PROPORTIONS = Object.freeze(['scale', 'torsoLength', 'torsoWidth', 'torsoDepth', 'neckLength', 'headLength', 'legLength', 'tailLength']);
export const REQUIRED_LIVING_TRAITS = Object.freeze(['identity', 'anatomy', 'proportions', 'feet', 'coat', 'gait']);
export const REQUIRED_EXTINCT_TRAITS = Object.freeze(['anatomy', 'surface', 'coloration', 'movement']);
// These are conservative software envelopes, not measured biological population bounds.
export const PROFILE_LIMITS = Object.freeze({ living: [0.9, 1.1], fictional: [0.75, 1.3] });
export const ATTACHMENT_REGIONS = Object.freeze(['head', 'jaw', 'neck', 'torso', 'tail', 'front-left-foot', 'front-right-foot', 'hind-left-foot', 'hind-right-foot']);
const text = (extra = {}) => ({ type: 'string', minLength: 1, ...extra });
const number = (minimum, maximum) => ({ type: 'number', minimum, maximum });
const object = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const array = items => ({ type: 'array', items });
const choice = values => ({ type: 'string', enum: values });
export const creatureSpecSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://github.com/Haoming9527/creature-skill/spec/creature-v1',
  title: 'Creature specification v1',
  ...object({
    schemaVersion: { type: 'integer', const: 1 },
    id: text({ pattern: '^[a-z][a-z0-9-]*$' }), name: text(), prompt: text(),
    category: choice(CATEGORIES), bodyPlan: text(), profile: text(),
    seed: { type: 'integer', minimum: 0, maximum: 4294967295 },
    identity: object({ commonName: text(), scientificName: text(), breed: text(), sex: text(), lifeStage: text(), bodyCondition: text(), hornStatus: text() }),
    proportions: object(Object.fromEntries(PROPORTIONS.map(key => [key, number(0.25, 3)]))),
    materials: object({ coatColor: text({ pattern: '^#[0-9a-fA-F]{6}$' }), secondaryColor: text({ pattern: '^#[0-9a-fA-F]{6}$' }), muzzleColor: text({ pattern: '^#[0-9a-fA-F]{6}$' }), hoofColor: text({ pattern: '^#[0-9a-fA-F]{6}$' }), eyeColor: text({ pattern: '^#[0-9a-fA-F]{6}$' }), roughness: number(0.15, 1), pattern: choice(['solid', 'piebald']) }),
    features: object({ mane: { type: 'boolean' }, tailTuft: { type: 'boolean' }, horns: { type: 'boolean' }, udder: { type: 'boolean' } }),
    behavior: object({ breathingRate: number(0.05, 0.6), walkSpeed: number(0.05, 1.5), strideScale: number(0.6, 1.2), headYawLimit: number(0, 0.5), headPitchLimit: number(0, 0.35), jawLimit: number(0, 0.3) }),
    supportedMovements: { ...array(choice(['idle', 'walk'])), minItems: 2, uniqueItems: true },
    attachments: array(object({ id: text({ pattern: '^[a-z][a-z0-9-]*$' }), region: choice(ATTACHMENT_REGIONS) })),
    sources: array(object({ id: text({ pattern: '^[a-z][a-z0-9-]*$' }), title: text(), url: text({ format: 'uri' }), accessed: text({ format: 'date' }), note: text() })),
    evidence: array(object({ trait: text(), status: choice(['observed', 'inferred', 'disputed', 'artistic']), sourceIds: { ...array(text()), uniqueItems: true }, notes: text() })),
    notes: array(text()),
  }),
};

function inspect(value, schema, path, errors) {
  const issue = (code, message) => errors.push({ code, path, message });
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const typeOK = schema.type === 'object' ? isObject : schema.type === 'array' ? Array.isArray(value) : schema.type === 'integer' ? Number.isInteger(value) : schema.type === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === schema.type;
  if (!typeOK) { issue('INVALID_TYPE', `Expected ${schema.type}.`); return; }
  if ('const' in schema && value !== schema.const) issue('INVALID_VERSION', `Expected ${schema.const}.`);
  if (schema.enum && !schema.enum.includes(value)) issue('INVALID_VALUE', `Choose one of: ${schema.enum.join(', ')}.`);
  if (typeof value === 'string') {
    if (schema.minLength && !value.trim()) issue('EMPTY_VALUE', 'Supply a non-empty value.');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) issue('INVALID_FORMAT', `Value does not match ${schema.pattern}.`);
    if (schema.format === 'uri') { try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol)) throw new Error(); } catch { issue('INVALID_SOURCE_URL', 'Use an absolute HTTP(S) reference URL.'); } }
    if (schema.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) issue('INVALID_DATE', 'Use a real calendar date in YYYY-MM-DD form.');
  }
  if (typeof value === 'number' && (value < schema.minimum || value > schema.maximum)) issue('OUT_OF_RANGE', `Expected ${schema.minimum}–${schema.maximum}.`);
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0)) issue('MISSING_ITEMS', `Include at least ${schema.minItems} item(s).`);
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) issue('DUPLICATE_ITEM', 'List items must be unique.');
    value.forEach((item, index) => inspect(item, schema.items, `${path}[${index}]`, errors));
  }
  if (isObject) {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push({ code: 'REQUIRED_FIELD', path: `${path}.${key}`, message: 'Required field is missing.' });
    for (const [key, item] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties, key)) errors.push({ code: 'UNKNOWN_FIELD', path: `${path}.${key}`, message: 'Unknown field; correct the name or extend the versioned contract before using it.' });
      else inspect(item, schema.properties[key], `${path}.${key}`, errors);
    }
  }
}

export function validateSpec(spec) {
  const errors = [], warnings = [];
  inspect(spec, creatureSpecSchema, '$', errors);
  const result = () => ({ valid: errors.length === 0, errors, warnings, category: spec?.category ?? null, profile: spec?.profile ?? null });
  if (errors.length) return result();
  const error = (code, path, message) => errors.push({ code, path, message });
  const warn = (code, path, message) => warnings.push({ code, path, message });
  if (spec.bodyPlan !== 'ungulate-quadruped') error('UNSUPPORTED_BODY_PLAN', '$.bodyPlan', 'This release builds ungulate-quadruped only. Follow the body-module extension workflow and review the new anatomy before generation.');
  if (!PROFILES.includes(spec.profile)) error('UNSUPPORTED_PROFILE', '$.profile', 'This release builds holstein and thoroughbred profiles only. Do not substitute an existing profile for another species.');
  if (spec.category === 'extinct') error('UNSUPPORTED_EXTINCT_PROFILE', '$.category', 'No extinct profile has been validated in v1. Preserve the evidence dossier and implement/review its own species profile before generation.');
  const sourceIds = new Set();
  spec.sources.forEach((source, index) => { if (sourceIds.has(source.id)) error('DUPLICATE_SOURCE', `$.sources[${index}].id`, 'Source IDs must be unique.'); sourceIds.add(source.id); });
  const attachmentIds = new Set();
  spec.attachments.forEach((attachment, index) => { if (attachmentIds.has(attachment.id)) error('DUPLICATE_ATTACHMENT', `$.attachments[${index}].id`, 'Attachment IDs must be unique.'); attachmentIds.add(attachment.id); });
  const traits = new Map();
  spec.evidence.forEach((entry, index) => {
    if (traits.has(entry.trait)) error('DUPLICATE_TRAIT', `$.evidence[${index}].trait`, 'Use one evidence entry per trait, describing conflicting evidence together.');
    traits.set(entry.trait, entry);
    entry.sourceIds.forEach(id => { if (!sourceIds.has(id)) error('UNKNOWN_SOURCE', `$.evidence[${index}].sourceIds`, `Source '${id}' is not in sources.`); });
    if (entry.status !== 'artistic' && !entry.sourceIds.length) error('MISSING_TRAIT_SOURCE', `$.evidence[${index}].sourceIds`, 'Observed, inferred, and disputed claims need a cited source. Use artistic for an original design choice.');
    if (entry.status === 'disputed') warn('DISPUTED_TRAIT', `$.evidence[${index}]`, 'Expose this interpretation and its alternatives in the delivered notes.');
  });
  const requiredTraits = spec.category === 'living' ? REQUIRED_LIVING_TRAITS : spec.category === 'extinct' ? REQUIRED_EXTINCT_TRAITS : ['design'];
  for (const trait of requiredTraits) if (!traits.has(trait)) error('MISSING_EVIDENCE_TRAIT', '$.evidence', `Add trait '${trait}' with its evidence status and reasoning.`);
  if (spec.category === 'living') {
    if (spec.sources.length < 2) error('INSUFFICIENT_REFERENCES', '$.sources', 'Living profiles need at least two credible anatomical/breed or movement sources. URL existence alone does not establish credibility.');
    for (const trait of REQUIRED_LIVING_TRAITS) if (traits.get(trait)?.status === 'artistic') error('UNSUPPORTED_LIVING_CLAIM', '$.evidence', `The required living trait '${trait}' cannot be an unsupported artistic claim. Retain realism or explicitly create a fictional derivative.`);
    if (spec.identity.lifeStage !== 'adult') error('UNSUPPORTED_LIFE_STAGE', '$.identity.lifeStage', 'Only adult anatomy is implemented; younger animals require a separately reviewed profile.');
    const cow = spec.profile === 'holstein';
    const expected = cow ? { breed: 'Holstein', sex: 'female', scientificName: ['Bos taurus'] } : { breed: 'Thoroughbred', sex: 'gelding', scientificName: ['Equus caballus', 'Equus ferus caballus'] };
    if (PROFILES.includes(spec.profile)) {
      for (const key of ['breed', 'sex']) if (spec.identity[key] !== expected[key]) error('PROFILE_IDENTITY_CONFLICT', `$.identity.${key}`, `The ${spec.profile} base currently represents ${expected[key]}; changing identity requires a reviewed profile.`);
      if (!expected.scientificName.includes(spec.identity.scientificName)) error('PROFILE_IDENTITY_CONFLICT', '$.identity.scientificName', 'The selected profile does not represent this taxon.');
      if (!(cow ? ['polled', 'dehorned'] : ['none']).includes(spec.identity.hornStatus)) error('REALISM_CONFLICT', '$.identity.hornStatus', 'Horn status conflicts with the implemented profile. Retain realism or explicitly create a fictional derivative; new geometry needs a supported module.');
      const expectedFeatures = cow ? { mane: false, tailTuft: true, udder: true } : { mane: true, tailTuft: false, udder: false };
      for (const [key, value] of Object.entries(expectedFeatures)) if (spec.features[key] !== value) error('REALISM_CONFLICT', `$.features.${key}`, `This adult ${spec.profile} profile expects ${key}=${value}. Retain realism or explicitly create a fictional derivative.`);
      if (cow && spec.materials.pattern !== 'piebald') error('REALISM_CONFLICT', '$.materials.pattern', 'The current black-and-white Holstein showcase requires piebald markings; other documented appearances need their own reviewed profile.');
    }
  }
  if (spec.category === 'extinct' && !spec.sources.length) error('MISSING_FOSSIL_REFERENCES', '$.sources', 'Cite the preserved evidence and comparative references used for reconstruction.');
  if (spec.category === 'fictional') warn('FICTIONAL_INTERPRETATION', '$.category', 'Assess fidelity to the brief and cited portrayal; these sources do not establish biological existence.');
  if (spec.features.horns) error('UNSUPPORTED_FEATURE', '$.features.horns', 'Horns have no reviewed geometry or attachment implementation in this release. Follow the extension workflow.');
  if (spec.profile === 'holstein' && spec.features.mane) error('UNSUPPORTED_FEATURE', '$.features.mane', 'The bovine base has no mane path. Author and review that feature before requesting it, including for a fictional derivative.');
  if (!spec.supportedMovements.includes('idle')) error('MISSING_IDLE', '$.supportedMovements', 'The supported viewer requires an idle state.');
  const bounds = PROFILE_LIMITS[spec.category] ?? PROFILE_LIMITS.living;
  for (const key of PROPORTIONS) {
    if (spec.proportions[key] < bounds[0] || spec.proportions[key] > bounds[1]) error(spec.category === 'living' ? 'REALISM_CONFLICT' : 'PROFILE_RANGE', `$.proportions.${key}`, `The current ${spec.category} authoring envelope is ${bounds[0]}–${bounds[1]}. This is a software safeguard, not a proven biological range. For a living animal, retain the reviewed proportions or explicitly request a fictional derivative; either may need additional topology review.`);
  }
  warn('HUMAN_REVIEW_REQUIRED', '$', 'Specification checks cannot approve anatomy, visual quality, deformation, source credibility, or measured performance. Inspect the rendered result and record review separately.');
  warn('ENGINEERING_ENVELOPE', '$.proportions', 'Accepted multipliers are implementation limits, not scientifically established species variation. Changed proportions require reference comparison.');
  return result();
}

export class SpecError extends Error {
  constructor(message, issues) { super(message); this.name = 'SpecError'; this.issues = issues; this.code = issues[0]?.code ?? 'INVALID_SPEC'; }
}
export function assertValidSpec(spec) {
  const report = validateSpec(spec);
  if (!report.valid) throw new SpecError(report.errors.map(e => `${e.code} ${e.path}: ${e.message}`).join('\n'), report.errors);
  return spec;
}

/** Return a new specification; callers must write it to a different file. */
export function createEditedSpec(original, changes, options = {}) {
  assertValidSpec(original);
  const next = structuredClone(original);
  const entries = Array.isArray(changes) ? changes : Object.entries(changes);
  for (const [path, value] of entries) {
    const keys = path.split('.');
    if (keys.some(key => ['__proto__', 'prototype', 'constructor'].includes(key)) || ['schemaVersion', 'category', 'sources', 'evidence', 'id'].includes(keys[0])) throw new SpecError(`Use explicit category/id options or edit the evidence dossier directly; '${path}' is not an editable parameter.`, [{ code: 'UNSAFE_EDIT', path, message: 'Protected or invalid edit path.' }]);
    let target = next;
    for (const key of keys.slice(0, -1)) { if (!target || typeof target !== 'object' || !Object.hasOwn(target, key)) throw new SpecError(`Unknown path '${path}'.`, [{ code: 'UNKNOWN_FIELD', path, message: 'Edit an existing specification field.' }]); target = target[key]; }
    const key = keys.at(-1);
    if (!target || typeof target !== 'object' || !Object.hasOwn(target, key)) throw new SpecError(`Unknown path '${path}'.`, [{ code: 'UNKNOWN_FIELD', path, message: 'Edit an existing specification field.' }]);
    target[key] = structuredClone(value);
  }
  if (options.category !== undefined) {
    if (options.category !== original.category && options.category !== 'fictional') throw new SpecError('Only an explicit fictional derivative transition is supported; new living/extinct identities require a new researched specification.', [{ code: 'CATEGORY_TRANSITION', path: 'category', message: 'Create and review a new evidence dossier for this category.' }]);
    next.category = options.category;
    if (options.category === 'fictional' && original.category !== 'fictional') {
      next.evidence.push({ trait: 'design', status: 'artistic', sourceIds: [], notes: `Explicit fictional derivative of ${original.id}. The inherited sources describe the original animal, not the invented changes.` });
      next.notes.push(`Category explicitly changed from ${original.category} to fictional. Original evidence retained as provenance, not validation of invented features.`);
    }
  }
  next.id = options.id ?? `${original.id}-edited`;
  if (options.prompt) next.prompt = options.prompt;
  next.notes.push(`Derived from ${original.id}; seed ${original.seed} and reference dossier preserved. Edits: ${entries.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(', ') || 'category/identity metadata only'}. Geometry, rig, attachments, and motion must be regenerated together; visual review is pending.`);
  assertValidSpec(next);
  return next;
}
