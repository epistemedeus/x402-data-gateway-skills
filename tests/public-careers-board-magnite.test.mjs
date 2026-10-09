import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARDS, USER_AGENT as RECIPE_UA, gateRequest, normalizeWorkday } from '../skills/public-careers-board/recipe/boards.mjs';
import { applyPredicates } from '../skills/public-careers-board/sources/predicates.mjs';
import {
  MAGNITE,
  USER_AGENT,
  agreeBoard,
  assertSourceIdentity,
  classifyStaleSuppliedList,
  collectWorkdayPages,
  endpointUsingHostnameLabel,
  fetchMagnite,
  gateMagnite,
  identityDecision,
  parseRobots,
  parseSearchJobsLinks,
  parseShell,
  robotsDecision,
} from '../skills/public-careers-board/sources/magnite.mjs';

const repoSkill = fileURLToPath(new URL('../skills/public-careers-board/', import.meta.url));
const BOARD = 'https://osv-rubicon.wd5.myworkdayjobs.com/MagniteCareers';
const JOBS = 'https://osv-rubicon.wd5.myworkdayjobs.com/wday/cxs/osv_rubicon/MagniteCareers/jobs';
const ROBOTS_ZERO = 'Crawl-delay: 0\nUser-agent: *\nDisallow:\n';
const ROBOTS_TEN = 'Crawl-delay: 10\n# START YOAST BLOCK\nUser-agent: *\nDisallow:\n\nSitemap: https://www.magnite.com/sitemap_index.xml\n';
const WORKDAY_ROBOTS = 'Sitemap: https://osv-rubicon.wd5.myworkdayjobs.com/MagniteCareers/siteMap.xml\n\nUser-agent: *\nAllow: /MagniteCareers/\nDisallow: /refreshFacet/\n';
const SHELL = 'tenant: "osv_rubicon",\nsiteId: "MagniteCareers",\nappName: "cxs",\nisExternal: true,\ntoken: "super-secret-token-value",\n';
const CAREERS = `<a href="${BOARD}">Search Jobs</a><a href="${BOARD}/">Search Jobs</a>`;
const job = (name, id) => ({ title: name, externalPath: `/job/City/${id}`, locationsText: 'Remote' });

function textResponse(body, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } });
}
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function world(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const href = String(url);
    const route = routes[href];
    if (!route) throw new Error(`unexpected ${href}`);
    return route(init);
  };
  return { calls, fetchImpl };
}

function baseRoutes(overrides = {}) {
  return {
    [MAGNITE.robotsUrl]: () => textResponse(ROBOTS_ZERO),
    [MAGNITE.careersPage]: () => textResponse(CAREERS),
    [MAGNITE.boardUrl]: () => textResponse(SHELL),
    [MAGNITE.endpoint]: () => jsonResponse({ total: 1, jobPostings: [job('Office Manager', 'Office-Manager_R-01429')] }),
    ...overrides,
  };
}

async function readBoard(routes, options = {}) {
  const { calls, fetchImpl } = world(routes);
  const sleeps = [];
  const result = await fetchMagnite({
    normalizeWorkday,
    fetchedAt: '2026-10-09T00:00:00.000Z',
    timeoutMs: options.timeoutMs ?? 30000,
    maxBytes: options.maxBytes ?? 1_000_000,
    fetchImpl,
    sleep: async (ms) => { sleeps.push(ms); },
    signal: options.signal,
  });
  return { result, calls, sleeps };
}

test('frozen recipe bytes still refuse the Magnite host', async () => {
  const pins = JSON.parse(await readFile(path.join(repoSkill, 'references/pins.json'), 'utf8'));
  assert.equal(pins.revision, '7d01bfb09c530430933dec1f07c5c0b8517cffa8');
  const boards = await readFile(path.join(repoSkill, 'recipe/boards.mjs'));
  const item = pins.files.find((entry) => entry.path === 'recipe/boards.mjs');
  assert.equal(createHash('sha256').update(boards).digest('hex'), item.sha256);
  assert.equal(boards.length, item.bytes);
  assert.deepEqual(gateRequest(JOBS), { ok: false, status: 'wrong_host', host: 'osv-rubicon.wd5.myworkdayjobs.com' });
  assert.equal(gateRequest(BOARDS.acxiom.endpoint).ok, true);
  assert.equal(Object.hasOwn(BOARDS, 'magnite'), false);
  assert.equal(USER_AGENT, RECIPE_UA);
  const sourcePins = JSON.parse(await readFile(path.join(repoSkill, 'references/source-pins.json'), 'utf8'));
  assert.equal(sourcePins.parent.recipeSha256, item.sha256);
  assert.equal(sourcePins.parent.reusedExport, 'normalizeWorkday');
  assert.equal(assertSourceIdentity(), true);
  assert.notEqual(endpointUsingHostnameLabel(), MAGNITE.endpoint);
  assert.equal(gateMagnite(endpointUsingHostnameLabel()).status, 'unknown_origin');
});

test('approved Magnite URLs stay exact and the stale host is not a company empty board', () => {
  for (const url of [MAGNITE.robotsUrl, MAGNITE.careersPage, MAGNITE.boardUrl, MAGNITE.endpoint]) {
    assert.equal(gateMagnite(url).ok, true, url);
  }
  assert.equal(gateMagnite('https://api.smartrecruiters.com/v1/companies/Magnite/postings').status, 'unknown_origin');
  assert.equal(gateMagnite(`${MAGNITE.boardUrl.replace('https://', 'http://')}`).status, 'rejected_url');
  assert.equal(gateMagnite('https://user:secret@osv-rubicon.wd5.myworkdayjobs.com/MagniteCareers').status, 'rejected_url');
  assert.equal(gateMagnite('https://osv-rubicon.wd5.myworkdayjobs.com/refreshFacet/location').status, 'forbidden_path');
  assert.equal(gateMagnite('https://osv-rubicon.wd5.myworkdayjobs.com/wday/cxs/osv-rubicon/MagniteCareers/jobs').status, 'unknown_origin');
  assert.equal(gateMagnite('https://169.254.1.1/jobs').status, 'unknown_origin');
  const stale = classifyStaleSuppliedList({ totalFound: 0, offset: 0, limit: 100, content: [] });
  assert.equal(stale.status, 'empty_for_this_source');
  assert.equal(stale.companyBoardEmpty, false);
  assert.equal(stale.emptyBoard, false);
  const shaped = normalizeWorkday({
    pages: [{ offset: 0, httpStatus: 200, body: { totalFound: 0, content: [] } }],
  }, { boardUrl: BOARD, source: JOBS, fetchedAt: '2026-10-09T00:00:00.000Z' });
  assert.equal(shaped.coverage.status, 'wrong_schema');
  assert.equal(shaped.coverage.emptyBoard, false);
  const failed = normalizeWorkday({
    pages: [{ offset: 0, httpStatus: 500, body: { total: 0, jobPostings: [] } }],
  }, { boardUrl: BOARD, source: JOBS, fetchedAt: '2026-10-09T00:00:00.000Z' });
  assert.equal(failed.coverage.status, 'source_failure');
  assert.equal(failed.coverage.emptyBoard, false);
});

test('handoff, shell identity, and retained robots text stay distinct from the hostname label', () => {
  const links = parseSearchJobsLinks(`<a href="${BOARD}"><span>Search Jobs</span></a><a href="${BOARD}">Search Jobs</a>`, MAGNITE.careersPage);
  assert.equal(agreeBoard(links, BOARD).status, 'confirmed');
  const ambiguous = parseSearchJobsLinks(`${CAREERS}<a href="/MagniteCareers">Search Jobs</a>`, MAGNITE.careersPage);
  assert.equal(agreeBoard(ambiguous, BOARD).status, 'ambiguous_handoff');
  const moved = parseSearchJobsLinks('<a href="https://jobs.smartrecruiters.com/Magnite">Search Jobs</a>', MAGNITE.careersPage);
  assert.equal(agreeBoard(moved, BOARD).status, 'unconfigured_handoff_target');
  const shell = parseShell(SHELL);
  assert.equal(shell.status, 'ok');
  assert.equal(shell.tenant, 'osv_rubicon');
  assert.equal(JSON.stringify(shell).includes('super-secret-token-value'), false);
  assert.equal(identityDecision(shell).ok, true);
  assert.equal(identityDecision(parseShell(SHELL.replace('osv_rubicon', 'osv-rubicon'))).reason, 'hostname_used_as_tenant');
  assert.equal(parseShell('tenant: "osv_rubicon", siteId: "MagniteCareers", appName: "cxs", isExternal: false').status, 'not_external');
  const magniteRobots = robotsDecision(parseRobots(ROBOTS_TEN), '/careers/');
  assert.equal(magniteRobots.allowed, true);
  assert.equal(magniteRobots.crawlDelaySec, 10);
  const workday = parseRobots(WORKDAY_ROBOTS);
  assert.equal(robotsDecision(workday, '/wday/cxs/osv_rubicon/MagniteCareers/jobs').allowed, true);
  assert.equal(robotsDecision(workday, '/refreshFacet/location').allowed, false);
});

test('predicates stay unselected', () => {
  const rows = [
    { title: 'Account Executive Advertising Solutions Engineer', location: 'Remote', url: 'https://example/a' },
    { title: 'Account Executive', location: 'NY', url: 'https://example/b' },
    { title: 'Senior Account Executive', location: null, url: 'https://example/c' },
    { title: 'Advertising Solutions Engineer', location: 'LA', url: 'https://example/d' },
    { title: 'Solutions Engineer', location: 'LA', url: 'https://example/e' },
    { title: 'Account Executive / Advertising Solutions Engineer', location: 'LA', url: 'https://example/f' },
  ];
  const result = applyPredicates(rows);
  assert.equal(result.appliedPredicate, null);
  assert.equal(result.employmentDecision, false);
  const byId = Object.fromEntries(result.alternatives.map((item) => [item.id, item.matchCount]));
  assert.deepEqual(byId, {
    exact_unpunctuated_phrase: 1,
    either_exact_title: 2,
    either_phrase_contained: 5,
    both_phrases_contained: 2,
    all_content_words: 2,
  });
  assert.equal(result.unknown.every((item) => item.status === 'unknown' && item.applied === false), true);
});

test('a crawl delay that does not fit does not skip the handoff or call jobs', async () => {
  const { result, calls, sleeps } = await readBoard(baseRoutes({
    [MAGNITE.robotsUrl]: () => textResponse(ROBOTS_TEN),
  }), { timeoutMs: 5000 });
  assert.equal(result.result, 'not_fetched');
  assert.equal(result.reason, 'crawl_delay_exceeds_deadline');
  assert.equal(result.emptyBoard, false);
  assert.equal(sleeps.length, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls.some((call) => call.url === JOBS), false);
});

test('Search Jobs disagreement and a hostname tenant do not post jobs', async () => {
  const moved = await readBoard(baseRoutes({
    [MAGNITE.careersPage]: () => textResponse('<a href="https://jobs.smartrecruiters.com/Magnite">Search Jobs</a>'),
  }));
  assert.equal(moved.result.result, 'source_moved');
  assert.equal(moved.result.emptyBoard, false);
  assert.equal(moved.calls.some((call) => call.url === JOBS), false);
  assert.equal(moved.calls.some((call) => call.url.includes('smartrecruiters.com')), false);

  const identity = await readBoard(baseRoutes({
    [MAGNITE.boardUrl]: () => textResponse(SHELL.replace('osv_rubicon', 'osv-rubicon')),
  }));
  assert.equal(identity.result.result, 'identity_mismatch');
  assert.equal(identity.result.reason, 'hostname_used_as_tenant');
  assert.equal(identity.result.identity.tenant, 'osv-rubicon');
  assert.equal(identity.result.emptyBoard, false);
  assert.equal(identity.calls.some((call) => call.url === JOBS), false);
  assert.equal(JSON.stringify(identity.result).includes('super-secret-token-value'), false);
});

test('later total zero still counts, the first page is not the board, and roleFilter stays null', async () => {
  const postings = {
    0: { total: 2, jobPostings: [job('Office Manager', 'Office-Manager_R-01429')] },
    1: { total: 0, jobPostings: [job('Account Executive, Agency Sales, UK', 'Account-Executive_R-01368')] },
    2: { total: 2, jobPostings: [job('Office Manager', 'Office-Manager_R-01429')] },
  };
  let sleptAt = null;
  const sleeps = [];
  const { calls, fetchImpl } = world(baseRoutes({
    [MAGNITE.robotsUrl]: () => textResponse(ROBOTS_TEN),
    [MAGNITE.endpoint]: (init) => {
      assert.equal(init.redirect, 'manual');
      assert.equal(init.headers.authorization, undefined);
      assert.equal(init.headers.cookie, undefined);
      const payload = JSON.parse(init.body);
      assert.equal(payload.searchText, '');
      assert.deepEqual(payload.appliedFacets, {});
      assert.equal(payload.limit, 20);
      return jsonResponse(postings[payload.offset]);
    },
  }));
  const result = await fetchMagnite({
    normalizeWorkday,
    fetchedAt: '2000-01-01T00:00:00.000Z',
    timeoutMs: 30000,
    maxBytes: 1_000_000,
    fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
      sleptAt = new Date().toISOString();
    },
  });
  assert.deepEqual(sleeps, [10000]);
  assert.ok(result.rows[0].fetchedAt >= sleptAt);
  assert.notEqual(result.rows[0].fetchedAt, '2000-01-01T00:00:00.000Z');
  assert.equal(result.kind, 'observation');
  assert.equal(result.coverage.status, 'complete_for_declared_total');
  assert.equal(result.coverage.laterPageTotalUnreliable, true);
  assert.equal(result.coverage.pastEnd.behavior, 'repeated_prior_paths');
  assert.equal(result.coverage.roleFilter, null);
  assert.equal(result.coverage.searchText, '');
  assert.equal(result.coverage.tenant, 'osv_rubicon');
  assert.equal(result.coverage.hostnameLabel, 'osv-rubicon');
  assert.equal(result.coverage.handoff, 'confirmed');
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].url, `${BOARD}/job/City/Office-Manager_R-01429`);
  assert.equal(JSON.stringify(result).includes('super-secret-token-value'), false);
  const predicates = applyPredicates(result.rows);
  assert.equal(predicates.appliedPredicate, null);
  assert.equal(predicates.alternatives.find((item) => item.id === 'either_phrase_contained').matchCount, 1);
  assert.equal(predicates.alternatives.find((item) => item.id === 'exact_unpunctuated_phrase').matchCount, 0);
  const jobs = calls.filter((call) => call.url === JOBS);
  assert.equal(jobs.length, 3);
  assert.equal(jobs.every((call) => !new URL(call.url).pathname.includes('/osv-rubicon/')), true);
  assert.equal(jobs.every((call) => new URL(call.url).pathname.includes('/osv_rubicon/')), true);
});

test('a short page budget and a failed or stale jobs body are not a complete empty board', async () => {
  const collected = await collectWorkdayPages({
    maxPages: 1,
    load: async (offset) => ({
      offset,
      httpStatus: 200,
      error: null,
      body: { total: 40, jobPostings: [job('Role', `Role-${offset}_R-1`)] },
    }),
  });
  assert.equal(collected.stopReason, 'page_budget');
  assert.equal(collected.pages.length, 1);
  assert.equal(collected.probe, null);

  const partial = await readBoard(baseRoutes({
    [MAGNITE.endpoint]: (init) => {
      const payload = JSON.parse(init.body);
      if (payload.offset === 0) return jsonResponse({ total: 37, jobPostings: [job('Only First', 'Only-First_R-1')] });
      return jsonResponse({ message: 'later failed' }, 500);
    },
  }));
  assert.equal(partial.result.coverage.status, 'partial');
  assert.equal(partial.result.coverage.emptyBoard, false);
  assert.equal(partial.result.coverage.declaredTotal, 37);
  assert.equal(partial.result.coverage.uniqueRows, 1);
  assert.equal(partial.result.coverage.remaining, 36);
  assert.equal(partial.result.coverage.roleFilter, null);

  const staleBody = await readBoard(baseRoutes({
    [MAGNITE.endpoint]: () => jsonResponse({ totalFound: 0, content: [] }),
  }));
  assert.equal(staleBody.result.coverage.status, 'wrong_schema');
  assert.equal(staleBody.result.coverage.emptyBoard, false);

  const failed = await readBoard(baseRoutes({
    [MAGNITE.endpoint]: () => jsonResponse({ total: 0, jobPostings: [] }, 500),
  }));
  assert.equal(failed.result.coverage.status, 'source_failure');
  assert.equal(failed.result.coverage.emptyBoard, false);

  const blocked = await readBoard(baseRoutes({
    [MAGNITE.robotsUrl]: () => textResponse('User-agent: *\nDisallow: /careers/\n'),
  }));
  assert.equal(blocked.result.result, 'not_fetched');
  assert.equal(blocked.result.reason, 'robots_disallow');
  assert.equal(blocked.calls.length, 1);
});

test('a redirect is not followed and an oversized body is not an empty board', async () => {
  const redirected = await readBoard(baseRoutes({
    [MAGNITE.careersPage]: () => new Response('moved', {
      status: 302,
      headers: { location: 'https://evil.example/board', 'content-type': 'text/plain' },
    }),
  }));
  assert.equal(redirected.result.result, 'not_fetched');
  assert.equal(redirected.result.reason, 'unexpected_redirect');
  assert.equal(redirected.result.emptyBoard, false);
  assert.equal(redirected.result.rows, undefined);
  assert.equal(redirected.calls.length, 2);
  assert.equal(redirected.calls.some((call) => call.url === JOBS || call.url.includes('evil.example')), false);

  const jobsRedirect = await readBoard(baseRoutes({
    [MAGNITE.endpoint]: () => new Response('', {
      status: 307,
      headers: { location: 'https://evil.example/jobs' },
    }),
  }));
  assert.equal(jobsRedirect.result.result, 'not_fetched');
  assert.equal(jobsRedirect.result.reason, 'unexpected_redirect');
  assert.equal(jobsRedirect.calls.filter((call) => call.url === JOBS).length, 1);
  assert.equal(jobsRedirect.calls.some((call) => call.url.includes('evil.example')), false);

  const laterRedirect = await readBoard(baseRoutes({
    [MAGNITE.endpoint]: (init) => {
      const payload = JSON.parse(init.body);
      if (payload.offset === 0) return jsonResponse({ total: 40, jobPostings: [job('Kept Row', 'Kept-Row_R-1')] });
      return new Response('', { status: 302, headers: { location: 'https://evil.example/more' } });
    },
  }));
  assert.equal(laterRedirect.result.coverage.status, 'partial');
  assert.equal(laterRedirect.result.coverage.emptyBoard, false);
  assert.equal(laterRedirect.result.rows.length, 1);
  assert.equal(laterRedirect.result.rows[0].title, 'Kept Row');
  assert.equal(laterRedirect.calls.some((call) => call.url.includes('evil.example')), false);

  const oversized = await readBoard(baseRoutes(), { maxBytes: 8 });
  assert.equal(oversized.result.coverage.status, 'source_failure');
  assert.equal(oversized.result.coverage.error, 'response_too_large');
  assert.equal(oversized.result.coverage.emptyBoard, false);
  assert.equal(oversized.result.rows.length, 0);
});

test('an empty Workday board stays empty and a crawl delay that expires does not skip ahead', async () => {
  const empty = await readBoard(baseRoutes({
    [MAGNITE.endpoint]: (init) => {
      const payload = JSON.parse(init.body);
      assert.equal(payload.offset, 0);
      assert.equal(init.redirect, 'manual');
      assert.equal(String(init.body).includes('osv-rubicon'), false);
      return jsonResponse({ total: 0, jobPostings: [] });
    },
  }));
  assert.equal(empty.result.kind, 'observation');
  assert.equal(empty.result.coverage.status, 'empty_board');
  assert.equal(empty.result.coverage.emptyBoard, true);
  assert.equal(empty.result.rows.length, 0);
  assert.equal(empty.result.coverage.roleFilter, null);
  assert.equal(empty.calls.filter((call) => call.url === JOBS).length, 1);
  assert.equal(classifyStaleSuppliedList({ totalFound: 0, content: [] }).companyBoardEmpty, false);

  let jobsCalls = 0;
  const capped = await readBoard(baseRoutes({
    [MAGNITE.endpoint]: (init) => {
      jobsCalls += 1;
      const payload = JSON.parse(init.body);
      assert.ok(payload.offset < 80);
      return jsonResponse({ total: 100, jobPostings: [job(`Role ${payload.offset}`, `Role-${payload.offset}_R-1`)] });
    },
  }));
  assert.equal(jobsCalls, 4);
  assert.equal(capped.result.coverage.status, 'partial');
  assert.equal(capped.result.coverage.stopReason, 'page_budget');
  assert.equal(capped.result.coverage.emptyBoard, false);
  assert.equal(capped.result.coverage.uniqueRows, 4);
  assert.equal(capped.result.rows.length, 4);
  assert.equal(MAGNITE.maxPages, 4);
  assert.equal(MAGNITE.limit, 20);

  const expired = await fetchMagnite({
    normalizeWorkday,
    fetchedAt: '2000-01-01T00:00:00.000Z',
    timeoutMs: 30000,
    fetchImpl: world(baseRoutes({
      [MAGNITE.robotsUrl]: () => textResponse(ROBOTS_TEN),
    })).fetchImpl,
    sleep: async () => {
      throw Object.assign(new Error('deadline'), { code: 'deadline' });
    },
  });
  assert.equal(expired.result, 'not_fetched');
  assert.equal(expired.reason, 'crawl_delay_exceeds_deadline');
  assert.equal(expired.emptyBoard, false);
  assert.equal(expired.requests.some((entry) => entry.url === MAGNITE.careersPage), false);
  assert.equal(expired.requests.some((entry) => entry.url === JOBS), false);
});

test('the candidate bundle exports the declared source pins', async () => {
  const skill = await readFile(path.join(repoSkill, 'SKILL.md'), 'utf8');
  assert.match(skill, /version: "0\.1\.1"/);
  assert.match(skill, /not a published release/);
  const bundle = skill.split('## Bundle files')[1];
  for (const rel of [
    'references/source-pins.json',
    'references/source-notice.txt',
    'sources/magnite.mjs',
    'sources/predicates.mjs',
    'scripts/cli.mjs',
    'scripts/predicates.mjs',
    'recipe/boards.mjs',
  ]) {
    assert.match(bundle, new RegExp(rel.replaceAll('/', '\\/')));
    const bytes = await readFile(path.join(repoSkill, rel));
    assert.ok(bytes.length > 0, rel);
  }
  const notice = await readFile(path.join(repoSkill, 'references/source-notice.txt'), 'utf8');
  assert.match(notice, /Redirects are not followed/);
  assert.match(notice, /SmartRecruiters URL is\nnot that board/);
  const sourcePins = JSON.parse(await readFile(path.join(repoSkill, 'references/source-pins.json'), 'utf8'));
  assert.equal(sourcePins.files.length, 2);
  for (const item of sourcePins.files) {
    const bytes = await readFile(path.join(repoSkill, item.path));
    assert.equal(bytes.length, item.bytes, item.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path);
  }
});

function run(cli, args, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: path.dirname(path.dirname(cli)),
      env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      clearTimeout(timer);
      let body = null;
      try { body = JSON.parse(stdout); } catch { /* refusal */ }
      resolve({ code, stdout, stderr, body });
    });
  });
}

async function installedCopy() {
  const dir = await mkdtemp(path.join(tmpdir(), 'careers-magnite-'));
  const dest = path.join(dir, 'public-careers-board');
  await new Promise((resolve, reject) => {
    const child = spawn('cp', ['-a', repoSkill, dest], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error('cp failed'))));
  });
  return { dir, dest, cli: path.join(dest, 'scripts/cli.mjs'), predicates: path.join(dest, 'scripts/predicates.mjs') };
}

async function writeSeed(dir, responses) {
  const file = path.join(dir, `seed-${Math.random().toString(16).slice(2)}.json`);
  await writeFile(file, JSON.stringify({ schema: 'public-careers-board.supplied-seed.v1', responses }));
  return file;
}

const robotsSeed = { httpStatus: 200, raw: ROBOTS_ZERO };
const careersSeed = { httpStatus: 200, raw: CAREERS };
const shellSeed = { httpStatus: 200, raw: SHELL };
const page0 = { httpStatus: 200, body: { total: 2, jobPostings: [job('Office Manager', 'Office-Manager_R-01429')] } };
const page1 = { httpStatus: 200, body: { total: 0, jobPostings: [job('Account Executive, Agency Sales, UK', 'Account-Executive_R-01368')] } };
const probe = { httpStatus: 200, body: { total: 2, jobPostings: [job('Office Manager', 'Office-Manager_R-01429')] } };

test('installed Magnite command keeps handoff, identity, coverage, and predicates outside the fetch', async () => {
  const copy = await installedCopy();
  try {
    const seed = await writeSeed(copy.dir, [robotsSeed, careersSeed, shellSeed, page0, page1, probe]);
    const result = await run(copy.cli, ['run', '--board', 'magnite-careers', '--source', 'magnite-workday', '--seed', seed, '--timeout-ms', '30000']);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.body.result, 'observation');
    assert.equal(result.body.reader, 'fetchMagnite');
    assert.equal(result.body.boardClaim, 'complete');
    assert.equal(result.body.complete, true);
    assert.equal(result.body.emptyBoard, false);
    assert.equal(result.body.coverage.roleFilter, null);
    assert.equal(result.body.coverage.tenant, 'osv_rubicon');
    assert.equal(result.body.coverage.hostnameLabel, 'osv-rubicon');
    assert.equal(result.body.coverage.searchText, '');
    assert.equal(result.body.rows.length, 2);
    assert.equal(result.body.seeded, true);
    assert.equal(result.body.paymentSent, false);
    assert.equal(result.stdout.includes('super-secret-token-value'), false);
    assert.equal(result.body.recipeRevision, '7d01bfb09c530430933dec1f07c5c0b8517cffa8');
    const hosts = result.body.coverage.requests.map((entry) => new URL(entry.url).host);
    assert.deepEqual([...new Set(hosts)].sort(), ['osv-rubicon.wd5.myworkdayjobs.com', 'www.magnite.com']);

    const observation = path.join(copy.dir, 'observation.json');
    await writeFile(observation, JSON.stringify({ rows: result.body.rows }));
    const selected = await run(copy.predicates, [observation]);
    assert.equal(selected.code, 0, selected.stdout);
    assert.equal(selected.body.appliedPredicate, null);
    assert.equal(selected.body.employmentDecision, false);
    assert.equal(selected.body.alternatives.find((item) => item.id === 'either_phrase_contained').matchCount, 1);
    assert.equal(selected.body.alternatives.find((item) => item.id === 'either_exact_title').matchCount, 0);

    const paid = await run(copy.predicates, ['--pay', observation]);
    assert.equal(paid.code, 2);
    assert.equal(paid.body.reason, 'payment_refused');
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('installed Magnite refusals do not invent rows or widen the frozen boards', async () => {
  const copy = await installedCopy();
  try {
    const movedSeed = await writeSeed(copy.dir, [
      robotsSeed,
      { httpStatus: 200, raw: '<a href="https://jobs.smartrecruiters.com/Magnite">Search Jobs</a>' },
      { httpStatus: 200, body: { total: 1, jobPostings: [job('SHOULD NOT APPEAR', 'Hidden_R-1')] } },
    ]);
    const moved = await run(copy.cli, ['run', '--board', 'magnite', '--seed', movedSeed, '--timeout-ms', '30000']);
    assert.equal(moved.code, 0, moved.stdout);
    assert.equal(moved.body.result, 'source_moved');
    assert.equal(moved.body.emptyBoard, false);
    assert.equal(moved.body.complete, false);
    assert.equal(moved.body.rows, null);
    assert.equal(moved.stdout.includes('SHOULD NOT APPEAR'), false);
    assert.equal(moved.body.requests.some((entry) => entry.url === JOBS), false);

    const identitySeed = await writeSeed(copy.dir, [
      robotsSeed,
      careersSeed,
      { httpStatus: 200, raw: SHELL.replace('osv_rubicon', 'osv-rubicon') },
      { httpStatus: 200, body: { total: 1, jobPostings: [job('SHOULD NOT APPEAR', 'Hidden_R-1')] } },
    ]);
    const identity = await run(copy.cli, ['run', '--board', 'magnite', '--seed', identitySeed, '--timeout-ms', '30000']);
    assert.equal(identity.code, 0, identity.stdout);
    assert.equal(identity.body.result, 'identity_mismatch');
    assert.equal(identity.body.reason, 'hostname_used_as_tenant');
    assert.equal(identity.stdout.includes('SHOULD NOT APPEAR'), false);

    const delaySeed = await writeSeed(copy.dir, [{ httpStatus: 200, raw: ROBOTS_TEN }, careersSeed]);
    const delayed = await run(copy.cli, ['run', '--board', 'magnite', '--seed', delaySeed, '--timeout-ms', '1000']);
    assert.equal(delayed.code, 0, delayed.stdout);
    assert.equal(delayed.body.result, 'not_fetched');
    assert.equal(delayed.body.reason, 'crawl_delay_exceeds_deadline');
    assert.equal(delayed.body.emptyBoard, false);
    assert.equal(delayed.body.requests.length, 1);

    const stale = await run(copy.cli, ['run', '--board', 'magnite', '--source', 'https://api.smartrecruiters.com/v1/companies/Magnite/postings?limit=100&offset=0']);
    assert.equal(stale.code, 0, stale.stdout);
    assert.equal(stale.body.result, 'wrong_source');
    assert.equal(stale.body.rows, null);
    const generic = await run(copy.cli, ['run', '--board', 'magnite', '--source', 'workday']);
    assert.equal(generic.body.result, 'wrong_source');
    const exact = await run(copy.cli, ['run', '--board', 'magnite', '--source', JOBS, '--seed', await writeSeed(copy.dir, [robotsSeed, careersSeed, shellSeed, page0, page1, probe]), '--timeout-ms', '30000']);
    assert.equal(exact.code, 0, exact.stdout);
    assert.equal(exact.body.result, 'observation');

    const paid = await run(copy.cli, ['run', '--pay', '--board', 'magnite']);
    assert.equal(paid.code, 2);
    assert.equal(paid.body.reason, 'payment_refused');
    assert.equal(paid.body.rows, null);

    const boardsPath = path.join(copy.dest, 'sources/magnite.mjs');
    const original = await readFile(boardsPath);
    const flipped = Buffer.from(original);
    flipped[flipped.length - 2] ^= 0x01;
    await writeFile(boardsPath, flipped);
    const tampered = await run(copy.cli, ['run', '--board', 'magnite']);
    assert.equal(tampered.code, 2, tampered.stdout);
    assert.equal(tampered.body.reason, 'tampered_source');
    assert.equal(tampered.body.rows, null);
    await writeFile(boardsPath, original);

    await unlink(boardsPath);
    const acxiomSeed = await writeSeed(copy.dir, [
      { httpStatus: 200, body: { total: 0, jobPostings: [] } },
    ]);
    const acxiom = await run(copy.cli, ['run', '--board', 'acxiom', '--seed', acxiomSeed]);
    assert.equal(acxiom.code, 0, acxiom.stdout);
    assert.equal(acxiom.body.reader, 'fetchAcxiom');
    assert.equal(acxiom.body.boardClaim, 'empty');
    assert.equal(acxiom.body.emptyBoard, true);
    const missingMagnite = await run(copy.cli, ['run', '--board', 'magnite', '--seed', acxiomSeed]);
    assert.equal(missingMagnite.code, 2, missingMagnite.stdout);
    assert.equal(missingMagnite.body.reason, 'tampered_source');
    assert.equal(missingMagnite.body.rows, null);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('installed Magnite command separates empty, partial, and redirect from a stale source', async () => {
  const copy = await installedCopy();
  try {
    const started = new Date().toISOString();
    const emptySeed = await writeSeed(copy.dir, [robotsSeed, careersSeed, shellSeed, { httpStatus: 200, body: { total: 0, jobPostings: [] } }]);
    const empty = await run(copy.cli, ['run', '--board', 'magnite', '--seed', emptySeed, '--timeout-ms', '30000']);
    assert.equal(empty.code, 0, empty.stdout);
    assert.equal(empty.body.result, 'observation');
    assert.equal(empty.body.boardClaim, 'empty');
    assert.equal(empty.body.emptyBoard, true);
    assert.equal(empty.body.complete, false);
    assert.equal(empty.body.rows.length, 0);
    assert.equal(empty.body.coverage.roleFilter, null);
    assert.equal(empty.body.coverage.requests.filter((entry) => entry.url === JOBS).length, 1);

    const redirectSeed = await writeSeed(copy.dir, [
      robotsSeed,
      { httpStatus: 302, raw: 'moved', headers: { location: 'https://evil.example/board' } },
      { httpStatus: 200, body: { total: 1, jobPostings: [job('SHOULD NOT APPEAR', 'Hidden_R-1')] } },
    ]);
    const redirect = await run(copy.cli, ['run', '--board', 'magnite', '--seed', redirectSeed, '--timeout-ms', '30000']);
    assert.equal(redirect.code, 0, redirect.stdout);
    assert.equal(redirect.body.result, 'not_fetched');
    assert.equal(redirect.body.reason, 'unexpected_redirect');
    assert.equal(redirect.body.emptyBoard, false);
    assert.equal(redirect.body.rows, null);
    assert.equal(redirect.stdout.includes('evil.example'), false);
    assert.equal(redirect.stdout.includes('SHOULD NOT APPEAR'), false);

    const partialSeed = await writeSeed(copy.dir, [
      robotsSeed,
      careersSeed,
      shellSeed,
      { httpStatus: 200, body: { total: 37, jobPostings: [job('Only First', 'Only-First_R-1')] } },
      { httpStatus: 500, body: { total: 0, jobPostings: [] } },
    ]);
    const partial = await run(copy.cli, ['run', '--board', 'magnite', '--seed', partialSeed, '--timeout-ms', '30000']);
    assert.equal(partial.code, 0, partial.stdout);
    assert.equal(partial.body.boardClaim, 'partial');
    assert.equal(partial.body.emptyBoard, false);
    assert.equal(partial.body.complete, false);
    assert.equal(partial.body.rows.length, 1);
    assert.equal(partial.body.coverage.declaredTotal, 37);
    assert.ok(partial.body.rows[0].fetchedAt >= started);
    assert.equal(partial.body.rows[0].source, JOBS);

    const stale = await run(copy.cli, ['run', '--board', 'magnite', '--source', MAGNITE.staleSuppliedSource]);
    assert.equal(stale.body.result, 'wrong_source');
    assert.equal(stale.body.emptyBoard, false);
    assert.equal(stale.body.rows, null);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});
