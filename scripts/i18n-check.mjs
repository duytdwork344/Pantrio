#!/usr/bin/env node
// i18n key parity check (requirements 2b.1 #5). Run: pnpm i18n:check
//
// 1. Web (apps/web/public/i18n/*.json) and Mobile (apps/mobile/lib/l10n/*.arb):
//    every locale file has the same keys as the default-locale file.
// 2. Both clients translate every ErrorCode in @pantrio/shared.
// 3. Both clients label every value of the shared display enums.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT = 'vi';
const problems = [];

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object'
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, String(value)]],
  );
}

function compare(label, files) {
  const base = files[DEFAULT];
  if (!base) {
    problems.push(`${label}: missing ${DEFAULT} file`);
    return;
  }
  for (const [locale, entries] of Object.entries(files)) {
    if (locale === DEFAULT) continue;
    for (const key of base.keys()) {
      if (!entries.has(key)) problems.push(`${label}: ${locale} is missing "${key}"`);
    }
    for (const key of entries.keys()) {
      if (!base.has(key)) problems.push(`${label}: ${locale} has extra "${key}"`);
    }
  }
}

// --- Web JSON
const webDir = join(root, 'apps/web/public/i18n');
const web = Object.fromEntries(
  readdirSync(webDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f.replace('.json', ''), new Map(flatten(JSON.parse(readFileSync(join(webDir, f), 'utf8'))))]),
);
compare('web', web);

// --- Mobile ARB
const arbDir = join(root, 'apps/mobile/lib/l10n');
const arb = Object.fromEntries(
  readdirSync(arbDir)
    .filter((f) => /^app_.+\.arb$/.test(f))
    .map((f) => {
      const data = JSON.parse(readFileSync(join(arbDir, f), 'utf8'));
      const entries = Object.entries(data).filter(([k]) => !k.startsWith('@'));
      return [f.replace(/^app_|\.arb$/g, ''), new Map(entries)];
    }),
);
compare('mobile', arb);

// --- Shared catalogs
const sharedDir = join(root, 'packages/shared/src');
const errorsSrc = readFileSync(join(sharedDir, 'errors.ts'), 'utf8');
const errorBlock = errorsSrc.slice(errorsSrc.indexOf('export const ErrorCode'));
const errorCodes = [...errorBlock.slice(0, errorBlock.indexOf('} as const')).matchAll(/^\s+([A-Z_]+):/gm)].map((m) => m[1]);

const indexSrc = readFileSync(join(sharedDir, 'index.ts'), 'utf8');
function enumValues(name) {
  const block = indexSrc.slice(indexSrc.indexOf(`export enum ${name}`));
  return [...block.slice(0, block.indexOf('}')).matchAll(/=\s*'([^']+)'/g)].map((m) => m[1]);
}
const enums = { difficulty: 'RecipeDifficulty', storage: 'StorageLocation', unit: 'Unit' };
const arbMessage = { difficulty: 'difficultyLabel', storage: 'storageLabel', unit: 'unitLabel' };

for (const [locale, entries] of Object.entries(web)) {
  for (const code of errorCodes) {
    if (!entries.has(`errors.${code}`)) problems.push(`web ${locale}: no "errors.${code}"`);
  }
  for (const [ns, enumName] of Object.entries(enums)) {
    for (const value of enumValues(enumName)) {
      if (!entries.has(`${ns}.${value}`)) problems.push(`web ${locale}: no "${ns}.${value}" (${enumName})`);
    }
  }
}
for (const [locale, entries] of Object.entries(arb)) {
  const errors = entries.get('errorMessage') ?? '';
  for (const code of errorCodes) {
    if (!errors.includes(`${code}{`)) problems.push(`mobile ${locale}: errorMessage has no ${code}`);
  }
  for (const [ns, enumName] of Object.entries(enums)) {
    const message = entries.get(arbMessage[ns]) ?? '';
    for (const value of enumValues(enumName)) {
      if (!message.includes(` ${value}{`)) problems.push(`mobile ${locale}: ${arbMessage[ns]} has no ${value} (${enumName})`);
    }
  }
}

if (problems.length) {
  console.error(`i18n check failed (${problems.length}):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(
  `i18n check passed: web ${Object.keys(web).join('/')} (${web[DEFAULT].size} keys), ` +
    `mobile ${Object.keys(arb).join('/')} (${arb[DEFAULT].size} keys), ${errorCodes.length} error codes.`,
);
