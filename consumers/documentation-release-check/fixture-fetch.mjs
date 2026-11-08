// Test-only preload. Even an unexpected request stays inside this process.
import assert from 'node:assert/strict';

const first = 'https://marketing.example';
const second = 'https://docs.example';
const path = '/llms.txt';
const entry = origin => '- [Other index](' + origin + path + '): peer';
const index = line => '# Documentation index\n\n' + line + '\n';
const plain = (body, headers = {}) =>
  new Response(body, { headers: { 'content-type': 'text/plain', ...headers } });
const scenario = process.env.DOCS_CHECK_FIXTURE || 'reciprocal';
const requests = [];

process.on('exit', () => {
  const expected = scenario === 'no_requests' ? [] : [first + path, second + path];
  assert.deepEqual(requests.sort(), expected.sort());
});

const firstResponse = {
  reciprocal: () => plain(index(entry(second))),
  absent: () => new Response('fixture body', { status: 404 }),
  html: () => new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } }),
  plain_html: () => plain('<!DOCTYPE html>\n' + index(entry(second))),
  wrong_status: () => new Response(index(entry(second)), { status: 503 }),
  missing_h1: () => plain('Read first\n' + index(entry(second))),
  empty_h1: () => plain('# ###\n' + entry(second)),
  missing_link: () => plain(index([
    second + path,
    '[Inline prose](' + second + path + ')',
    '- See [link](' + second + path + ')',
    '- [Different path](' + second + path + '/)',
    '- [Query](' + second + path + '?x=1)',
    '- [Fragment](' + second + path + '#top)',
    '- [Different spelling](https://DOCS.example/llms.txt)',
    '- [Encoded spelling](' + second + '/%6Clms.txt)',
    '- [Relative](/llms.txt)',
    '- [Link to a different host](https://outside.example/llms.txt)',
  ].join('\n'))),
  fenced_link: () => plain(index([
    '````md', '```', entry(second), '````',
    '~~~', entry(second), '~~~',
    '<!--', entry(second), '-->',
    '<pre>', entry(second), '</pre>',
    '<div>', entry(second), '</div>', '',
    '    ' + entry(second), '> ' + entry(second),
    '- <!--', '  ' + entry(second), '  -->',
    '-     [Indented code](' + second + path + ')',
  ].join('\n'))),
  redirect: () => Response.redirect('https://outside.example/redirect', 302),
  oversized_length: () => plain(index(entry(second)), { 'content-length': '131073' }),
  oversized_stream: () => plain(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(index(entry(second))));
      controller.enqueue(new Uint8Array(128 * 1024));
      controller.close();
    },
  })),
  exact_limit: () => {
    const prefix = '\uFEFF\r\n# Index\r\n\r\n' + entry(second) + '\r\n';
    const padding = 128 * 1024 - Buffer.byteLength(prefix);
    return plain(prefix + 'é'.repeat(Math.floor(padding / 2)) + 'x'.repeat(padding % 2));
  },
  invalid_utf8: () => plain(Buffer.concat([Buffer.from(index(entry(second))), Buffer.from([0xff])])),
  markdown: () => plain('\r\n# Index\r\n\r\n1. [Other \\] index](<' + second + path + '> "peer"): description\r\n',
    { 'content-type': 'Text/Markdown; charset=utf-8' }),
  request_error: () => { throw new Error('fixture secret error'); },
  timeout: signal => plain(new ReadableStream({
    start(controller) {
      const keepAlive = setTimeout(() => controller.error(new Error('abort did not fire')), 10_000);
      signal.addEventListener('abort', () => {
        clearTimeout(keepAlive);
        controller.error(signal.reason);
      }, { once: true });
    },
  })),
};

globalThis.fetch = async (url, options) => {
  requests.push(url);
  assert.equal(options.method, 'GET');
  assert.equal(options.redirect, 'manual');
  assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(Object.keys(options).sort(), ['method', 'redirect', 'signal']);
  if (url === first + path) return firstResponse[scenario](options.signal);
  assert.equal(url, second + path);
  return plain(index(entry(first)));
};
