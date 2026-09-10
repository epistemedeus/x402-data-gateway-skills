import test from 'node:test';
import assert from 'node:assert/strict';
import { skillMarkdown } from '../lib/paths.mjs';


test('web-extract non-changing audit: S81 guidance still distinguishes source evidence from paid success', () => {
  const skill = skillMarkdown('web-extract');
  assert.match(skill, /sourceOk|capture|partial/i);
  assert.match(skill, /not .* completeness|untrusted|no-JS|truncat/i);
});

test('samedaydesk-machine-commerce non-changing audit: stays unpaid discovery/intent only', () => {
  const skill = skillMarkdown('samedaydesk-machine-commerce');
  assert.match(skill, /before payment|purchase intent|Do not access a wallet|separate payment executor/i);
  assert.doesNotMatch(skill, /\b(sign and broadcast|spend automatically)\b/i);
});
