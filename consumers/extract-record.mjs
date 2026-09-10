// Pure interpretation of delivered records. No fetch, payment, or source execution.
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const sources = ['content-type', 'html-meta', 'default-utf-8', 'invalid-charset-fallback'];
function captureKnown(c) {
  return object(c) && c.method === 'http-get-no-javascript' && c.javascriptExecuted === false
    && typeof c.textTruncated === 'boolean' && typeof c.bodyTruncated === 'boolean'
    && Number.isInteger(c.maxBodyBytes) && Number.isInteger(c.bodyBytes)
    && sources.includes(c.charsetSource) && (typeof c.charset === 'string' || c.charset === null);
}
export function interpretSingle(record, { merchantStatus = 200 } = {}) {
  const r = object(record) ? record : {};
  const statusKnown = Number.isInteger(r.status) && r.status >= 100 && r.status <= 599;
  const sourceAccepted = r.sourceOk === true && statusKnown && r.status >= 200 && r.status < 300 && r.error === null;
  const identityKnown = typeof r.requestedUrl === 'string' && typeof r.finalUrl === 'string' && r.url === r.finalUrl;
  const known = captureKnown(r.capture);
  const text = typeof r.markdown === 'string' ? r.markdown : r.text;
  const truncated = r.truncated === true || r.capture?.textTruncated === true || r.capture?.bodyTruncated === true;
  return {
    merchantStatus,
    merchantDelivered: merchantStatus === 200,
    recordOk: r.ok === true,
    sourceOk: typeof r.sourceOk === 'boolean' ? r.sourceOk : null,
    status: statusKnown ? r.status : null,
    sourceAccepted,
    requestedUrl: typeof r.requestedUrl === 'string' ? r.requestedUrl : null,
    finalUrl: typeof r.finalUrl === 'string' ? r.finalUrl : null,
    identityKnown,
    errorCode: typeof r.error?.code === 'string' ? r.error.code : null,
    capture: known ? { ...r.capture } : null,
    coverage: !known ? 'unknown' : truncated ? 'partial' : 'bounded_no_completeness_proof',
    usableCandidate: merchantStatus === 200 && r.ok === true && sourceAccepted && identityKnown && known && typeof text === 'string' && text.trim().length > 0,
    acceptance: 'buyer_criteria_not_evaluated',
    paymentVerified: false,
    executionAuthorized: false,
  };
}
export function interpretBatch(record, { merchantStatus = 200 } = {}) {
  const r = object(record) ? record : {};
  const rows = Array.isArray(r.sources) ? r.sources : [];
  const states = ['pending', 'success', 'partial', 'failure', 'unknown', 'skipped_duplicate'];
  const valid = r.product === 'samedaydesk-extract-batch' && r.schemaVersion === 'samedaydesk.extract-batch.v0'
    && typeof r.ok === 'boolean' && typeof r.partial === 'boolean' && rows.length > 0 && rows.length <= 5;
  return {
    merchantStatus,
    recordOk: r.ok === true,
    contractRecognized: valid,
    partial: typeof r.partial === 'boolean' ? r.partial : null,
    stopReason: r.stopReason ?? null,
    sources: rows.map((s, index) => ({
      index,
      id: s?.id ?? null,
      // Batch uses source, not the single-record requestedUrl field.
      requestedUrl: typeof s?.source === 'string' ? s.source : null,
      finalUrl: typeof s?.finalUrl === 'string' ? s.finalUrl : null,
      httpStatus: Number.isInteger(s?.httpStatus) ? s.httpStatus : null,
      responseObserved: Number.isInteger(s?.httpStatus) && s.httpStatus >= 100 && s.httpStatus <= 599,
      status: states.includes(s?.status) ? s.status : 'unknown',
      errorCode: s?.error?.code ?? null,
      capture: captureKnown(s?.provenance?.capture) ? { ...s.provenance.capture } : null,
      outputTruncated: s?.provenance?.outputTruncated === true,
      usableCandidate: valid && merchantStatus === 200 && ['success', 'partial'].includes(s?.status)
        && Number.isInteger(s?.httpStatus) && s.httpStatus >= 200 && s.httpStatus < 300
        && typeof s?.id === 'string' && typeof s?.source === 'string' && typeof s?.finalUrl === 'string'
        && captureKnown(s?.provenance?.capture) && object(s?.data) && Object.keys(s.data).length > 0
        && s?.provenance?.outputTruncated !== true,
    })),
    accounting: object(r.accounting) ? { ...r.accounting } : null,
    chargedClaim: typeof r.charged === 'boolean' ? r.charged : null,
    paymentVerified: false,
    automaticRetry: false,
    acceptance: 'buyer_criteria_not_evaluated',
    completeness: 'not_proven',
    executionAuthorized: false,
  };
}
