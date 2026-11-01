import http from 'node:http';

const MAX_RESPONSE_BYTES = 65536;

export function assertLoopbackSink(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw Object.assign(new Error('sink_refused'), { code: 'sink_refused' });
  }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port) {
    throw Object.assign(new Error('sink_refused'), { code: 'sink_refused' });
  }
  if (url.username || url.password) throw Object.assign(new Error('sink_refused'), { code: 'sink_refused' });
  return url;
}

function classifyBody(status, text, notice) {
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  if (status === 200 && parsed?.delivery === 'accepted' && parsed?.noticeId === notice.url) {
    return { delivery: 'accepted', status };
  }
  if (status >= 300 && status < 400) return { delivery: 'not_followed', status };
  if (status === 200) return { delivery: 'unknown', status };
  return { delivery: 'rejected', status };
}

export function postNotice(sink, notice, timeoutMs) {
  const url = assertLoopbackSink(sink);
  const payload = Buffer.from(JSON.stringify(notice));
  return new Promise((resolve) => {
    let settled = false;
    let requestFinished = false;
    let responseEnded = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const incomplete = (reason, status = null) => {
      finish({ delivery: requestFinished ? 'ambiguous' : 'failed', status, reason });
    };
    const req = http.request({
      hostname: '127.0.0.1',
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(payload.length),
      },
    }, (res) => {
      const chunks = [];
      let received = 0;
      res.on('data', (chunk) => {
        if (settled) return;
        received += chunk.length;
        if (received > MAX_RESPONSE_BYTES) {
          incomplete('response_limited', res.statusCode ?? null);
          res.destroy();
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        if (settled) return;
        if (res.complete !== true) {
          incomplete('response_closed', res.statusCode ?? null);
          return;
        }
        responseEnded = true;
        finish(classifyBody(res.statusCode, Buffer.concat(chunks).toString('utf8'), notice));
      });
      res.on('aborted', () => {
        if (!responseEnded) incomplete('response_aborted', res.statusCode ?? null);
      });
      res.on('error', (error) => {
        if (!responseEnded) incomplete(error?.code || 'response_error', res.statusCode ?? null);
      });
      res.on('close', () => {
        if (!responseEnded) incomplete('response_closed', res.statusCode ?? null);
      });
    });
    const timer = setTimeout(() => {
      incomplete('timeout');
      req.destroy();
    }, timeoutMs);
    req.on('finish', () => { requestFinished = true; });
    req.on('error', (error) => {
      incomplete(error?.code || 'error');
    });
    req.end(payload);
  });
}
