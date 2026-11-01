import http from 'node:http';

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

function settle(done, value) {
  if (done.settled) return;
  done.settled = true;
  done.resolve(value);
}

export function postNotice(sink, notice, timeoutMs) {
  const url = assertLoopbackSink(sink);
  const payload = Buffer.from(JSON.stringify(notice));
  return new Promise((resolve) => {
    const done = { settled: false, resolve };
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
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { parsed = null; }
        const accepted = res.statusCode === 200
          && parsed?.delivery === 'accepted'
          && parsed?.noticeId === notice.url;
        if (accepted) {
          settle(done, { delivery: 'accepted', status: res.statusCode });
          return;
        }
        if (res.statusCode >= 300 && res.statusCode < 400) {
          settle(done, { delivery: 'not_followed', status: res.statusCode });
          return;
        }
        if (res.statusCode === 200) {
          settle(done, { delivery: 'unknown', status: res.statusCode });
          return;
        }
        settle(done, { delivery: 'rejected', status: res.statusCode });
      });
    });
    let finished = false;
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      settle(done, { delivery: finished ? 'ambiguous' : 'failed', status: null, reason: 'timeout' });
    });
    req.on('finish', () => { finished = true; });
    req.on('error', (error) => {
      settle(done, {
        delivery: finished ? 'ambiguous' : 'failed',
        status: null,
        reason: error?.code || 'error',
      });
    });
    req.end(payload);
  });
}
