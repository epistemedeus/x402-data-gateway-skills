import path from 'node:path';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const manifest = JSON.parse(fs.readFileSync(new URL('../merchant-source.json', import.meta.url)));
export function verifyMerchantSource(root) {
  for (const [file, expected] of Object.entries(manifest.gitBlobs)) {
    const b = fs.readFileSync(path.join(root, file));
    const actual = createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
    if (actual !== expected) throw new Error(`merchant source differs from pinned contract: ${file}`);
  }
}

import { pathToFileURL } from 'node:url';
import { merchantRoot, MERCHANT_PIN, SKILLS_PIN } from './paths.mjs';

export async function loadMerchant(moduleName) {
  verifyMerchantSource(merchantRoot());
  const href = pathToFileURL(path.join(merchantRoot(), moduleName)).href;
  return import(href);
}

export function pinnedContext() {
  return { MERCHANT_PIN, SKILLS_PIN, root: merchantRoot() };
}
