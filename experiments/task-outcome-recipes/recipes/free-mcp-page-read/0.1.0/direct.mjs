// Once the tool result is in hand, the page text is the markdown field.
// This baseline does not open a second MCP call and does not GET the public URL.

export function directDeliveredBody(judged) {
  const markdown = judged?.structured?.markdown;
  const text = typeof markdown === 'string' ? markdown : null;
  return {
    baseline: 'delivered-tool-body',
    liveGetPerformed: false,
    markdown: text,
    sufficientForText: judged?.outcome === 'useful' && Boolean(text),
    enforcesOneCall: false,
  };
}
