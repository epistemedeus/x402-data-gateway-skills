const MAX_BYTES = 128 * 1024;
const TIMEOUT_MS = 5_000;
const INDEX_PATH = '/llms.txt';

// Validate the spelling before URL parsing can normalize paths, ports or whitespace.
function parseOrigin(value) {
  if (typeof value !== 'string' || /\s/.test(value)) return null;
  const bare = /^https:\/\/(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::[1-9][0-9]{0,4})?\/?$/;
  if (!bare.test(value)) return null;

  try {
    const url = new URL(value);
    if (!url.hostname.startsWith('[')) {
      const labels = url.hostname.split('.');
      const validLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
      if (url.hostname.length > 253 || !labels.every(label => validLabel.test(label))) return null;
      // Reject alternate spellings such as 127.1 that the URL parser turns into an IP.
      const inputHost = value.slice('https://'.length).split(/[:/]/, 1)[0].toLowerCase();
      if (inputHost !== url.hostname) return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function htmlBlockEnd(line) {
  if (/^ {0,3}<!--/.test(line)) return /-->/;
  if (/^ {0,3}<\?/.test(line)) return /\?>/;
  if (/^ {0,3}<!\[CDATA\[/.test(line)) return /\]\]>/;
  if (/^ {0,3}<![A-Z]/.test(line)) return />/;
  const raw = line.match(/^ {0,3}<(script|pre|style|textarea)(?=[\s>/]|$)/i);
  if (raw) return new RegExp(`</${raw[1]}>`, 'i');
  if (/^ {0,3}<\/?[A-Za-z][A-Za-z0-9-]*(?=[\t />]|$)/.test(line)) return /^[\t ]*$/;
  return null;
}

function hasPeerLink(lines, target) {
  let fence;
  let htmlEnd;
  // Unindented, single-line list entries with the link first. Capture the
  // destination without resolving, decoding, or requesting it.
  const link = /^(?:[-+*]|[0-9]{1,9}[.)]) {1,4}\[(?:\\.|[^\[\]\\])+\]\([\t ]*(?:<([^<>\s]+)>|([^<>\s()]+))(?:[\t ]+(?:"[^"]*"|'[^']*'|\([^()]*\)))?[\t ]*\)/;
  for (const line of lines) {
    if (htmlEnd) {
      if (htmlEnd.test(line)) htmlEnd = undefined;
      continue;
    }
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length &&
          /^[\t ]*$/.test(marker[2])) fence = undefined;
      continue;
    }
    if (marker && (marker[1][0] === '~' || !marker[2].includes('`'))) {
      fence = marker[1];
      continue;
    }
    const end = htmlBlockEnd(line);
    if (end) {
      if (!end.test(line)) htmlEnd = end;
      continue;
    }
    const entry = line.match(link);
    if (entry && (entry[1] ?? entry[2]) === target) return true;
  }
  return false;
}

function result(origin, status, reason) {
  return { origin, status, reason };
}

async function inspect(origin, peer) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let response;
  try {
    response = await fetch(origin + INDEX_PATH, { method: 'GET', redirect: 'manual', signal });
    if ([300, 301, 302, 303, 307, 308].includes(response.status)) {
      return result(origin, 'refused', 'redirect');
    }
    if (response.status === 404 || response.status === 410) {
      return result(origin, 'drift', 'missing_index');
    }
    if (response.status !== 200) return result(origin, 'refused', 'unexpected_http_status');

    const mediaType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (mediaType !== 'text/plain' && mediaType !== 'text/markdown') {
      return result(origin, 'refused', 'unsupported_media_type');
    }
    if (Number(response.headers.get('content-length')) > MAX_BYTES) {
      return result(origin, 'refused', 'body_too_large');
    }

    const bytes = new Uint8Array(MAX_BYTES);
    let length = 0;
    const reader = response.body?.getReader();
    if (reader) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (length + value.byteLength > MAX_BYTES) {
            return result(origin, 'refused', 'body_too_large');
          }
          bytes.set(value, length);
          length += value.byteLength;
        }
      } finally {
        reader.releaseLock();
      }
    }

    let body;
    try {
      body = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
    } catch {
      return result(origin, 'refused', 'invalid_utf8');
    }
    const lines = body.split(/\r\n?|\n/);
    const heading = lines.findIndex(line => !/^[\t ]*$/.test(line));
    if (heading < 0 || !/^ {0,3}#[\t ]+(?!#+[\t ]*$)\S/.test(lines[heading])) {
      return result(origin, 'refused', 'missing_initial_h1');
    }
    return hasPeerLink(lines.slice(heading + 1), peer + INDEX_PATH)
      ? result(origin, 'pass', 'peer_link_present')
      : result(origin, 'drift', 'peer_link_missing');
  } catch {
    return result(origin, 'refused', signal.aborted ? 'timeout' : 'request_failed');
  } finally {
    // Cancel unread bytes after a refusal without delaying the other result.
    void response?.body?.cancel().catch(() => {});
  }
}

async function run(args) {
  if (args.length !== 2) {
    return [2, [result(null, 'refused', 'expected_two_origins'), result(null, 'refused', 'expected_two_origins')]];
  }
  const origins = args.map(parseOrigin);
  const [first, second] = origins;
  if (!first || !second) {
    return [2, origins.map(origin => origin
      ? result(origin, 'skipped', 'invalid_pair')
      : result(null, 'refused', 'invalid_origin'))];
  }
  if (first === second) {
    return [2, origins.map(origin => result(origin, 'refused', 'duplicate_origin'))];
  }
  const results = await Promise.all([inspect(first, second), inspect(second, first)]);
  return [results.every(entry => entry.status === 'pass') ? 0 : 1, results];
}

const [exitCode, results] = await run(process.argv.slice(2));
console.log(JSON.stringify({ schemaVersion: 1, results }));
process.exitCode = exitCode;
