import { resolve, sep } from 'node:path';
import { access, mkdir } from 'node:fs/promises';
import { assertLoopbackSink, postNotice } from './deliver.mjs';
import { canonicalPhrases, journeyKey, phraseError, titleMatches } from './match.mjs';
import { observeBoard } from './observe.mjs';
import { readState, withStateOwner } from './state.mjs';

const BOARDS = new Set(['acxiom', 'acxiomllc', 'liveramp', 'liveramp-inc', 'liverampashby', 'liveramp-ashby', 'magnite', 'magnite-careers']);

function fail(code) {
  return Object.assign(new Error(code), { code });
}

function classify(observation) {
  if (!observation || observation.result !== 'observation') {
    return { kind: 'stop', outcome: 'reader_stopped', reason: observation?.result || observation?.reason || 'unreadable' };
  }
  if (observation.boardClaim === 'source_failure') return { kind: 'stop', outcome: 'source_failure', reason: observation.reason };
  if (observation.boardClaim === 'empty') return { kind: 'empty' };
  if (observation.boardClaim === 'complete' && observation.complete === true && observation.emptyBoard === false) return { kind: 'complete' };
  return { kind: 'stop', outcome: 'incomplete', reason: observation.boardClaim || observation.reason || 'incomplete' };
}

function rowsFrom(observation) {
  const rows = Array.isArray(observation.rows) ? observation.rows : [];
  const byUrl = new Map();
  let duplicateUrls = 0;
  let unknownRows = 0;
  for (const row of rows) {
    const url = typeof row?.url === 'string' ? row.url : '';
    const title = typeof row?.title === 'string' ? row.title : '';
    if (!url || !title) {
      unknownRows += 1;
      continue;
    }
    if (byUrl.has(url)) {
      duplicateUrls += 1;
      continue;
    }
    byUrl.set(url, {
      url,
      title,
      location: typeof row.location === 'string' && row.location ? row.location : null,
    });
  }
  return { rows: [...byUrl.values()], duplicateUrls, unknownRows };
}

function reportedDuplicates(observation, collected) {
  const reader = observation?.coverage?.duplicateCount;
  const fromReader = Number.isInteger(reader) && reader >= 0 ? reader : 0;
  return fromReader + collected.duplicateUrls;
}

function outcomeFor(notices, baselinedNow) {
  if (baselinedNow) return 'baseline';
  if (notices.length === 0) return 'unchanged';
  if (notices.some((notice) => notice.delivery === 'accepted')) return 'notice';
  if (notices.some((notice) => notice.delivery === 'ambiguous' || notice.delivery === 'unknown')) return 'notice_ambiguous';
  return 'notice_failed';
}

function baseResult(extra) {
  return {
    schema: 'board-notice.journey.v1',
    exactlyOnce: false,
    exactlyOnceMail: false,
    transport: 'loopback-http',
    employmentDecision: false,
    appliedPredicate: null,
    criteriaMode: 'phrase-or-casefold-substring',
    applyRequested: false,
    ...extra,
  };
}

function readerFields(observation) {
  return {
    seeded: observation?.seeded === true,
    sourceCoverage: typeof observation?.sourceCoverage === 'string' ? observation.sourceCoverage : null,
    requestCount: Array.isArray(observation?.coverage?.requests) ? observation.coverage.requests.length : null,
  };
}

export async function runJourney(options) {
  const board = options.board;
  if (!BOARDS.has(board)) throw fail('board_required');
  const criteriaError = phraseError(options.phrases);
  if (criteriaError) throw fail(criteriaError);
  const phrases = canonicalPhrases(options.phrases);
  assertLoopbackSink(options.sink);
  const timeoutMs = options.timeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw fail('timeout_rejected');
  const skill = resolve(options.skill);
  const seed = options.seed == null ? null : resolve(options.seed);
  if (seed) {
    try { await access(seed); }
    catch { throw fail('seed_rejected'); }
  }
  const stateFile = resolve(options.state);
  if (stateFile === skill || stateFile.startsWith(`${skill}${sep}`)) throw fail('state_rejected');
  await mkdir(resolve(stateFile, '..'), { recursive: true });
  const owned = await withStateOwner(stateFile, (owner) => ownedJourney({
    board, phrases, skill, seed, stateFile, sink: options.sink, timeoutMs, commit: owner.commit,
  }));
  if (owned.busy) {
    return {
      code: 0,
      body: baseResult({
        outcome: 'busy',
        reason: 'state_busy',
        notices: [],
        stateChanged: false,
        statePreserved: true,
        board: null,
        seeded: null,
        sourceCoverage: null,
        requestCount: null,
      }),
    };
  }
  return owned.value;
}

async function ownedJourney({ board, phrases, skill, seed, stateFile, sink, timeoutMs, commit }) {
  const loaded = await readState(stateFile);
  const observed = await observeBoard({ skill, board, seed, timeoutMs });
  if (observed.code !== 0 || !observed.body) {
    return {
      code: 0,
      body: baseResult({
        outcome: 'reader_refused',
        reason: observed.body?.reason || 'reader_exit',
        readerExit: observed.code,
        board: observed.body?.board || null,
        notices: [],
        stateChanged: false,
        statePreserved: true,
        ...readerFields(observed.body),
      }),
    };
  }
  const observation = observed.body;
  const claim = classify(observation);
  if (claim.kind === 'stop') {
    return {
      code: 0,
      body: baseResult({
        outcome: claim.outcome,
        reason: claim.reason,
        board: observation.board || null,
        reader: observation.reader || null,
        boardClaim: observation.boardClaim || null,
        emptyBoard: observation.emptyBoard === true,
        complete: observation.complete === true,
        notices: [],
        stateChanged: false,
        statePreserved: true,
        duplicateUrls: 0,
        ...readerFields(observation),
      }),
    };
  }
  const collected = rowsFrom(observation);
  if (claim.kind === 'empty' && collected.rows.length > 0) {
    return {
      code: 0,
      body: baseResult({
        outcome: 'incomplete',
        reason: 'empty_claim_has_rows',
        board: observation.board,
        reader: observation.reader,
        boardClaim: observation.boardClaim,
        emptyBoard: true,
        complete: false,
        notices: [],
        stateChanged: false,
        statePreserved: true,
        ...readerFields(observation),
      }),
    };
  }
  if (claim.kind === 'complete' && collected.unknownRows > 0) {
    return {
      code: 0,
      body: baseResult({
        outcome: 'incomplete',
        reason: 'row_shape',
        board: observation.board,
        reader: observation.reader,
        boardClaim: observation.boardClaim,
        emptyBoard: false,
        complete: false,
        notices: [],
        stateChanged: false,
        statePreserved: true,
        unknownRows: collected.unknownRows,
        ...readerFields(observation),
      }),
    };
  }
  const canonicalBoard = observation.board;
  if (typeof canonicalBoard !== 'string' || !canonicalBoard) throw fail('reader_unreadable');
  const key = journeyKey(canonicalBoard, phrases);
  const state = loaded.state;
  const prior = state.journeys[key] || {
    board: canonicalBoard,
    phrases,
    baselined: false,
    seen: [],
    pending: [],
  };
  const seen = new Set(Array.isArray(prior.seen) ? prior.seen : []);
  const pending = new Map((Array.isArray(prior.pending) ? prior.pending : []).map((item) => [item.url, item]));
  const urls = collected.rows.map((row) => row.url).sort();

  if (!prior.baselined) {
    prior.baselined = true;
    prior.board = canonicalBoard;
    prior.phrases = phrases;
    prior.seen = urls;
    prior.pending = [];
    state.journeys[key] = prior;
    await commit(state);
    return {
      code: 0,
      body: baseResult({
        outcome: 'baseline',
        reason: claim.kind === 'empty' ? 'empty_board' : 'initial_seen_set',
        board: canonicalBoard,
        reader: observation.reader,
        boardClaim: observation.boardClaim,
        emptyBoard: observation.emptyBoard === true,
        complete: observation.complete === true,
        notices: [],
        seenCount: prior.seen.length,
        duplicateUrls: reportedDuplicates(observation, collected),
        stateChanged: true,
        statePreserved: true,
        baselined: true,
        ...readerFields(observation),
      }),
    };
  }

  const byUrl = new Map(collected.rows.map((row) => [row.url, row]));
  const fresh = urls.filter((url) => !seen.has(url));
  let changed = false;
  for (const url of fresh) {
    if (!titleMatches(byUrl.get(url).title, phrases)) {
      seen.add(url);
      pending.delete(url);
      changed = true;
    }
  }
  prior.seen = [...seen].sort();
  prior.pending = [...pending.values()];
  state.journeys[key] = prior;
  if (changed) await commit(state);

  const matching = fresh.filter((url) => titleMatches(byUrl.get(url).title, phrases)).sort();
  const notices = [];
  for (const url of matching) {
    const row = byUrl.get(url);
    const payload = {
      schema: 'board-notice.notice.v1',
      board: canonicalBoard,
      title: row.title,
      location: row.location,
      url: row.url,
      phrases,
    };
    const sent = await postNotice(sink, payload, timeoutMs);
    const record = {
      url,
      title: row.title,
      delivery: sent.delivery,
      status: sent.status ?? null,
      reason: sent.reason ?? null,
    };
    notices.push(record);
    if (sent.delivery === 'accepted') {
      seen.add(url);
      pending.delete(url);
    } else {
      pending.set(url, { url, delivery: sent.delivery, status: sent.status ?? null });
    }
    prior.seen = [...seen].sort();
    prior.pending = [...pending.values()].sort((a, b) => a.url.localeCompare(b.url));
    state.journeys[key] = prior;
    await commit(state);
    changed = true;
  }

  return {
    code: 0,
    body: baseResult({
      outcome: outcomeFor(notices, false),
      reason: null,
      board: canonicalBoard,
      reader: observation.reader,
      boardClaim: observation.boardClaim,
      emptyBoard: observation.emptyBoard === true,
      complete: observation.complete === true,
      notices,
      seenCount: prior.seen.length,
      pendingCount: prior.pending.length,
      duplicateUrls: reportedDuplicates(observation, collected),
      stateChanged: changed,
      statePreserved: true,
      baselined: true,
      duplicatePossible: notices.some((notice) => notice.delivery !== 'accepted'),
      ...readerFields(observation),
    }),
  };
}
