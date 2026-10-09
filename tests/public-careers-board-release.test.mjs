import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const skillDir = path.join(root, 'skills/public-careers-board');
const provenancePath = path.join(root, 'provenance/public-careers-board-0.1.2.json');
const publishedDescription = 'Fetch current public job openings from one supported company careers board and report coverage. The rows are job listings of the board\'s current public vacancies: title, location, and the board\'s job URL, with source and fetch time. Supply Acxiom Workday, LiveRamp Ashby, or Magnite Workday to scripts/cli.mjs. Magnite is read only after its official careers handoff confirms the declared Workday board. Role selection stays outside the fetch. A source failure is not an empty or complete board. No wallet, signup, API key, or payment.';
const fingerprints = {
  '0.1.0': '1438f01260365fecaa818241a29563b5300e7bbe8ad686261f6d42799de55d46',
  '0.1.1': 'ad500aaa699578ee5ddbb98b5b761aae196005b48384ac7140059c55aeaf5fc3',
  '0.1.2': 'd46596baaf240d7213e7b4d3a0623418644919d73c3388d0bb5efad91512e46a',
};
const skillMarkdown = {
  '0.1.0': 'e2ef74d2fb27e1ccc0254cf1216cce62fccc6cd34af7a970b0d566adc43956db',
  '0.1.1': 'b85e210688e447e7f2ae1ba7a1b3eb74f16abffd67b6c837c8c0cdf3dec1cd2c',
  '0.1.2': 'd5c5b528f296b46ea37dad9cf635751e5102acbf2b1898366cfa4e361086194f',
};

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function gitArchiveGzip(spec, mtime) {
  const tar = execFileSync('git', ['archive', '--format=tar', `--mtime=${mtime}`, spec], {
    cwd: root,
    maxBuffer: 8 * 1024 * 1024,
  });
  return execFileSync('gzip', ['-n'], { input: tar, maxBuffer: 8 * 1024 * 1024 });
}

function readArchive(rel) {
  const abs = path.join(root, rel);
  const stored = statSync(abs).isDirectory()
    ? readdirSync(abs)
        .filter((name) => name.endsWith('.b64part'))
        .sort()
        .map((name) => readFileSync(path.join(abs, name), 'utf8'))
        .join('')
    : readFileSync(abs, 'utf8');
  return Buffer.from(stored.replace(/\s+/g, ''), 'base64');
}

function extract(bytes) {
  const dir = mkdtempSync(path.join(tmpdir(), 'careers-archive-'));
  const archive = path.join(dir, 'archive.tar.gz');
  writeFileSync(archive, bytes);
  const out = mkdtempSync(path.join(tmpdir(), 'careers-archive-'));
  execFileSync('tar', ['-xzf', archive, '-C', out]);
  rmSync(dir, { recursive: true, force: true });
  return out;
}

function walk(dir, prefix = '') {
  const found = [];
  for (const name of readdirSync(dir)) {
    const rel = prefix ? `${prefix}/${name}` : name;
    const abs = path.join(dir, name);
    const stat = statSync(abs);
    if (stat.isSymbolicLink()) throw new Error(`symlink ${rel}`);
    if (stat.isDirectory()) found.push(...walk(abs, rel));
    else found.push({ path: rel, bytes: readFileSync(abs), sha256: sha256(readFileSync(abs)) });
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

function fingerprint(files) {
  const payload = files.map((file) => `${file.path}:${file.sha256}`).join('\n');
  return sha256(payload);
}

function descriptionOf(skill) {
  const front = skill.match(/^---\n([\s\S]+?)\n---\n/);
  assert.ok(front, 'frontmatter');
  const line = front[1].split('\n').find((entry) => entry.startsWith('description: '));
  assert.ok(line, 'description');
  const raw = line.slice('description: '.length);
  const value = raw.startsWith('"') ? JSON.parse(raw) : raw;
  return { front: front[1], value };
}

test('published careers archives stay the git trees that were published', () => {
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
  assert.equal(provenance.schema, 'public-careers-board.release-candidate.v1');
  assert.equal(provenance.separatedFromSkillBundle, true);
  assert.equal(provenance.candidate.published, false);
  assert.equal(provenance.clawhubCli, '0.23.3');
  for (const version of ['0.1.0', '0.1.1']) {
    const item = provenance.predecessors.find((entry) => entry.version === version);
    assert.ok(item, version);
    const bytes = readArchive(item.archive);
    assert.equal(sha256(bytes), item.archiveSha256, version);
    assert.deepEqual(bytes, gitArchiveGzip(`${item.commit}:skills/public-careers-board`, item.archiveMtime));
    const dir = extract(bytes);
    try {
      const files = walk(dir);
      assert.equal(files.length, item.fileCount, version);
      assert.equal(fingerprint(files), fingerprints[version], version);
      assert.equal(fingerprint(files), item.fingerprint, version);
      const skill = files.find((file) => file.path === 'SKILL.md');
      assert.equal(skill.sha256, skillMarkdown[version], version);
      assert.equal(skill.sha256, item.skillMarkdownSha256, version);
      const parsed = descriptionOf(skill.bytes.toString('utf8'));
      assert.equal(parsed.value.includes('canonical job url'), false, version);
      if (version === '0.1.0') {
        assert.equal(parsed.value.includes('Magnite'), false);
        assert.match(parsed.front, /version: "0\.1\.0"/);
      }
      if (version === '0.1.1') {
        assert.match(parsed.value, /Magnite is read only after its official careers handoff/);
        assert.equal(parsed.value.includes('The rows are job listings'), false);
        assert.match(parsed.front, /version: "0\.1\.1"/);
        assert.equal(skill.bytes.includes('not a published release'), false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('the 0.1.2 candidate archive changes only the skill metadata', () => {
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
  const candidate = provenance.candidate;
  assert.equal(candidate.version, '0.1.2');
  assert.equal(candidate.published, false);
  assert.equal(candidate.archiveEncoding, 'base64-parts');
  assert.equal(candidate.archivePartCount, 12);
  assert.deepEqual(
    readdirSync(path.join(root, candidate.archive)).filter((name) => name.endsWith('.b64part')).sort(),
    Array.from({ length: 12 }, (_, index) => `${String(index).padStart(2, '0')}.b64part`),
  );
  assert.deepEqual(candidate.changedPaths, ['SKILL.md']);
  assert.deepEqual(candidate.tags, ['careers', 'jobs', 'coverage', 'no-spend']);
  assert.equal(candidate.description, publishedDescription);
  assert.equal(candidate.fingerprint, fingerprints['0.1.2']);
  const bytes = readArchive(candidate.archive);
  assert.equal(sha256(bytes), candidate.archiveSha256);
  assert.equal(candidate.sourceCommit, 'd65b8688c2ba72a965c12520c20bd4c20852469d');
  assert.equal(candidate.localMetadataCommit, '484ff23a063c9bffc755ee63ee2d297bad8939ce');
  assert.deepEqual(bytes, gitArchiveGzip(`${candidate.sourceCommit}:skills/public-careers-board`, candidate.archiveMtime));
  const predecessor = provenance.predecessors.find((entry) => entry.version === '0.1.1');
  const previousDir = extract(readArchive(predecessor.archive));
  const candidateDir = extract(bytes);
  try {
    const previous = walk(previousDir);
    const current = walk(candidateDir);
    assert.equal(current.length, 13);
    assert.equal(fingerprint(current), fingerprints['0.1.2']);
    const previousByPath = new Map(previous.map((file) => [file.path, file]));
    const changed = [];
    for (const file of current) {
      const prior = previousByPath.get(file.path);
      assert.ok(prior, file.path);
      if (prior.sha256 !== file.sha256) changed.push(file.path);
    }
    assert.deepEqual(changed, ['SKILL.md']);
    const live = walk(skillDir);
    assert.deepEqual(live.map((file) => file.path), current.map((file) => file.path));
    for (const file of current) {
      const onDisk = live.find((entry) => entry.path === file.path);
      if (file.path === 'SKILL.md') {
        assert.equal(onDisk.bytes.toString('utf8'), file.bytes.toString('utf8').replace(
          'This 0.1.2 source is a candidate. It is not a published release. ', '',
        ), file.path);
        assert.doesNotMatch(onDisk.bytes.toString('utf8'), /not a published release/);
        assert.equal(descriptionOf(onDisk.bytes.toString('utf8')).value, publishedDescription);
      } else {
        assert.equal(onDisk.sha256, file.sha256, file.path);
      }
    }
    const skill = current.find((file) => file.path === 'SKILL.md').bytes.toString('utf8');
    const parsed = descriptionOf(skill);
    assert.equal(parsed.value, publishedDescription);
    assert.equal(parsed.value.includes('canonical job url'), false);
    assert.match(parsed.front, /version: "0\.1\.2"/);
    assert.match(parsed.front, /tags: \[careers, jobs, coverage, no-spend\]/);
    assert.match(skill, /This 0\.1\.2 source is a candidate\. It is not a published release\./);
    assert.match(skill, /A source failure is not an empty or complete board\./);
    const pins = JSON.parse(readFileSync(path.join(skillDir, 'references/pins.json'), 'utf8'));
    const sourcePins = JSON.parse(readFileSync(path.join(skillDir, 'references/source-pins.json'), 'utf8'));
    for (const item of [...pins.files, ...sourcePins.files]) {
      const packed = current.find((file) => file.path === item.path);
      const prior = previousByPath.get(item.path);
      assert.equal(packed.sha256, item.sha256, item.path);
      assert.equal(packed.bytes.length, item.bytes, item.path);
      assert.equal(prior.sha256, item.sha256, item.path);
    }
  } finally {
    rmSync(previousDir, { recursive: true, force: true });
    rmSync(candidateDir, { recursive: true, force: true });
  }
});
