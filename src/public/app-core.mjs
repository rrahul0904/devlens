export function normalizeMethod(method) {
  const value = String(method || 'GET').trim().toUpperCase();
  return value || 'GET';
}

export function parseHeaderLines(text) {
  const headers = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const index = line.indexOf(':');
    if (index <= 0) throw new Error(`Invalid header line: ${line}`);
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    headers[key] = value;
  }
  return headers;
}

export function toRestDraft(capture) {
  return {
    method: normalizeMethod(capture?.method || 'GET'),
    url: capture?.url || capture?.requestUrl || '',
    headers: capture?.requestHeaders || {},
    body: capture?.requestBody || ''
  };
}

export function headerObjectToLines(headers = {}) {
  return Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\n');
}
