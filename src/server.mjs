import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateExternalUrl } from './url-policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 4317);
const maxRequestBody = 1024 * 1024;
const maxResponseBody = 2 * 1024 * 1024;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function json(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxRequestBody) throw new Error('Request payload is too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sanitizeHeaders(headers = {}) {
  const blocked = new Set(['host', 'connection', 'content-length', 'transfer-encoding']);
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([key]) => !blocked.has(String(key).toLowerCase()))
      .map(([key, value]) => [key, String(value)])
  );
}

async function readLimitedText(response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxResponseBody) {
      await reader.cancel();
      throw new Error('Response exceeded the 2 MB preview limit.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

async function fetchExternal(rawUrl, options = {}) {
  const target = await validateExternalUrl(rawUrl);
  const started = performance.now();
  const response = await fetch(target, {
    ...options,
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000)
  });
  const body = await readLimitedText(response);
  return {
    requestUrl: target.toString(),
    finalUrl: response.url,
    status: response.status,
    statusText: response.statusText,
    durationMs: Math.round(performance.now() - started),
    contentType: response.headers.get('content-type') || '',
    headers: Object.fromEntries(response.headers.entries()),
    body
  };
}

async function handleBrowse(req, res, url) {
  const target = url.searchParams.get('url');
  if (!target) return json(res, 400, { error: 'Missing url parameter.' });
  try {
    const result = await fetchExternal(target, {
      method: 'GET',
      headers: { 'user-agent': 'DevLens/0.1 (+clean-room developer browser)' }
    });
    json(res, 200, result);
  } catch (error) {
    json(res, 502, { error: error.message });
  }
}

async function handleRequest(req, res) {
  try {
    const input = await readJson(req);
    const method = String(input.method || 'GET').toUpperCase();
    const hasBody = !['GET', 'HEAD'].includes(method) && typeof input.body === 'string' && input.body.length > 0;
    const result = await fetchExternal(input.url, {
      method,
      headers: sanitizeHeaders(input.headers),
      body: hasBody ? input.body : undefined
    });
    json(res, 200, result);
  } catch (error) {
    json(res, 502, { error: error.message });
  }
}

async function serveStatic(res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const normalized = path.normalize(relative);
  const filePath = path.join(publicDir, normalized);
  if (!filePath.startsWith(publicDir + path.sep) && filePath !== path.join(publicDir, 'index.html')) {
    return json(res, 403, { error: 'Forbidden.' });
  }
  try {
    const contents = await fs.readFile(filePath);
    res.writeHead(200, {
      'content-type': mime[path.extname(filePath)] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'self'; frame-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: https: http:"
    });
    res.end(contents);
  } catch (error) {
    if (error.code === 'ENOENT') return json(res, 404, { error: 'Not found.' });
    throw error;
  }
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/browse') return await handleBrowse(req, res, url);
    if (req.method === 'POST' && url.pathname === '/api/request') return await handleRequest(req, res);
    if (req.method === 'GET') return await serveStatic(res, url.pathname);
    json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(port, '127.0.0.1', () => {
    console.log(`DevLens running at http://127.0.0.1:${port}`);
  });
}
