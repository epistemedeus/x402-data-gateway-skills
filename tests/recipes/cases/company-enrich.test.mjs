import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import { loadMerchant } from '../lib/merchant.mjs';

import { skillMarkdown } from '../lib/paths.mjs';

async function withExtractFixtureFetch(fetchImpl, fn) {
  const priorFetch = globalThis.__SAMEDAYDESK_EXTRACT_FETCH__;
  const priorGlobalFetch = globalThis.fetch;
  const methods = ['lookup', 'resolve4', 'resolve6', 'resolveMx', 'resolveNs', 'resolveTxt'];
  const priorDns = Object.fromEntries(methods.map((name) => [name, dns[name].bind(dns)]));
  globalThis.__SAMEDAYDESK_EXTRACT_FETCH__ = fetchImpl;
  globalThis.fetch = fetchImpl;
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  dns.resolve4 = async () => ['93.184.216.34'];
  dns.resolve6 = async () => [];
  dns.resolveMx = async () => [{ exchange: 'mail.acme.example', priority: 10 }];
  dns.resolveNs = async () => ['ns1.acme.example'];
  dns.resolveTxt = async () => [['v=spf1 -all']];
  try {
    return await fn();
  } finally {
    globalThis.fetch = priorGlobalFetch;
    if (priorFetch === undefined) delete globalThis.__SAMEDAYDESK_EXTRACT_FETCH__;
    else globalThis.__SAMEDAYDESK_EXTRACT_FETCH__ = priorFetch;
    for (const name of methods) dns[name] = priorDns[name];
  }
}

test('company-enrich useful: public HTML fixture yields company/contact evidence', async () => {
  const { enrich } = await loadMerchant('enrich.mjs');
  const html = `<!doctype html><html><head>
    <title>Acme Robotics</title>
    <meta name="description" content="Public company and contact evidence for agents." />
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme Robotics',
      email: 'hello@acme.example',
      telephone: '+1-555-0100',
      sameAs: ['https://github.com/acme'],
    })}</script></head><body><a href="mailto:hello@acme.example">Email</a></body></html>`;

  const result = await withExtractFixtureFetch(async (url) => {
    if (String(url).startsWith('https://acme.example')) {
      return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html', 'content-encoding': 'identity' },
      });
    }
    return new Response('', { status: 404, headers: { 'content-encoding': 'identity' } });
  }, () => enrich('acme.example'));

  assert.equal(result.company.name, "Acme Robotics");
  assert.ok(result.contact.emails.includes("hello@acme.example"));
  assert.match(skillMarkdown('company-enrich'), /\/enrich/);
});

test('company-enrich refusal: private host blocked before payment framing', async () => {
  const { enrich } = await loadMerchant('enrich.mjs');
  await assert.rejects(() => enrich('http://127.0.0.1/'), /private|non-public|blocked/i);
});
