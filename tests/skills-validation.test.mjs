import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const root=new URL('../',import.meta.url);
test('all installed skill files retain discoverable names and descriptions',()=>{
 const names=fs.readdirSync(new URL('skills/',root));assert.equal(names.length,17);
 for(const name of names){const s=fs.readFileSync(new URL(`skills/${name}/SKILL.md`,root),'utf8');
  const front=s.match(/^---\n([\s\S]+?)\n---\n/);assert.ok(front,name);
  assert.match(front[1],new RegExp('(?:^|\\n)name: '+name+'(?:\\n|$)'));
  assert.match(front[1],/(?:^|\n)description: .+/);
  assert.ok(s.includes('# '),name);
 }
});
test('request guidance preserves HTTP POST and read JSON versus MCP distinctions',()=>{
 const web=fs.readFileSync(new URL('skills/web-extract/SKILL.md',root),'utf8');
 const body=JSON.parse(web.match(/`(\{"urls":.*?\})`/)[1]);assert.deepEqual(body,{urls:['https://example.com/'],fields:['title','text']});
 for(const phrase of ['provenance.capture','skipped_duplicate','status:null','JSON record','sourceOk','charset','not a comment pager'])assert.ok(web.includes(phrase),phrase);
 const catalog=fs.readFileSync(new URL('skills/samedaydesk-machine-commerce/SKILL.md',root),'utf8');assert.match(catalog,/End every\nrun before payment/);assert.match(catalog,/exact POST body/);
 const readme=fs.readFileSync(new URL('README.md',root),'utf8');assert.match(readme,/not a native Grok\/Heavy model/);assert.match(readme,/POST for `\/extract\/batch`/);
});
