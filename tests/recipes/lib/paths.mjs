import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SKILLS_ROOT = path.resolve(here, '../../..');
export const SKILLS_DIR = path.join(SKILLS_ROOT, 'skills');

export const MERCHANT_PIN = '4910f83bd2be1e38667f1a3cfa23c70fcff6b0c1';
export const SKILLS_PIN = '2c57e275bbb57421d08c4a270ba6ab5237ff2ec8';

export function merchantRoot() {
  const fromEnv = process.env.S88_MERCHANT_SOURCE_DIR || process.env.EXTRACT_MERCHANT_SOURCE_DIR;
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);
  const sibling = path.resolve(SKILLS_ROOT, '../x402-url-extractor');
  if (fs.existsSync(sibling)) return sibling;
  throw new Error(`Set S88_MERCHANT_SOURCE_DIR to merchant pin ${MERCHANT_PIN}`);
}

export function skillMarkdown(skillDir) {
  return fs.readFileSync(path.join(SKILLS_DIR, skillDir, 'SKILL.md'), 'utf8');
}

export function listSkillDirs() {
  return fs
    .readdirSync(SKILLS_DIR)
    .filter((name) => fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')))
    .sort();
}
