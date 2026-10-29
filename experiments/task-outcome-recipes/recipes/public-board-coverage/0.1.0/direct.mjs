// Strong direct baseline for a caller who already holds the board JSON.
// It reads listed titles and reports a non-200 response as transport failure.
// It does not build absolute URLs, dedupe pages, or compute coverage.

export function directBoardRead(seed) {
  if (!seed || seed.schema !== 'public-careers-board.supplied-seed.v1' || !Array.isArray(seed.responses)) {
    return { baseline: 'caller-held-board-json', accepted: false, reason: 'not_board_json' };
  }
  const rawTitles = [];
  const paths = [];
  let non200 = 0;
  for (const response of seed.responses) {
    if (!response || response.httpStatus !== 200 || !response.body || typeof response.body !== 'object') {
      non200 += 1;
      continue;
    }
    const body = response.body;
    const rows = Array.isArray(body.jobPostings) ? body.jobPostings : Array.isArray(body.jobs) ? body.jobs : [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      if (typeof row.title === 'string' && row.title.trim()) rawTitles.push(row.title);
      if (typeof row.externalPath === 'string') paths.push(row.externalPath);
      else if (typeof row.jobUrl === 'string') paths.push(row.jobUrl);
    }
  }
  return {
    baseline: 'caller-held-board-json',
    accepted: true,
    rawTitles,
    titles: [...new Set(rawTitles)],
    paths,
    non200,
    transportNotOk: non200 > 0,
    emptyBoard: null,
    classifiesCoverage: false,
    buildsAbsoluteUrl: false,
  };
}
