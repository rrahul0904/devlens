import { headerObjectToLines, parseHeaderLines, toRestDraft } from './app-core.mjs';

const $ = (id) => document.getElementById(id);
const workspaces = {
  browser: { node: $('browserWorkspace'), title: 'Browser', subtitle: 'Preview a page and capture the navigation request.' },
  rest: { node: $('restWorkspace'), title: 'REST client', subtitle: 'Replay and modify captured requests without visual noise.' },
  network: { node: $('networkWorkspace'), title: 'Network', subtitle: 'Inspect captures and hand them directly to the REST client.' }
};

const state = {
  captures: [],
  selectedId: null,
  browserHistory: [],
  browserIndex: -1
};

function showWorkspace(name) {
  for (const [key, entry] of Object.entries(workspaces)) entry.node.classList.toggle('active', key === name);
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.workspace === name));
  $('workspaceTitle').textContent = workspaces[name].title;
  $('workspaceSubtitle').textContent = workspaces[name].subtitle;
}

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => showWorkspace(button.dataset.workspace)));

function withBaseTag(html, url) {
  const safeUrl = String(url).replace(/"/g, '&quot;');
  const base = `<base href="${safeUrl}">`;
  if (/<head[\s>]/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${base}`);
  return `<!doctype html><html><head>${base}</head><body>${html}</body></html>`;
}

function addCapture(capture) {
  const entry = { id: crypto.randomUUID(), createdAt: Date.now(), ...capture };
  state.captures.unshift(entry);
  $('networkCount').textContent = String(state.captures.length);
  renderNetwork();
  return entry;
}

function statusTone(status) {
  if (status >= 200 && status < 400) return 'var(--success)';
  if (status >= 400 && status < 500) return 'var(--warning)';
  if (status >= 500) return 'var(--danger)';
  return 'var(--muted)';
}

async function navigate(url, { fromHistory = false } = {}) {
  const target = String(url || '').trim();
  if (!target) return;
  $('browserGo').disabled = true;
  $('browserStatus').textContent = 'Loading…';
  $('browserTiming').textContent = '';
  try {
    const response = await fetch(`/api/browse?url=${encodeURIComponent(target)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Navigation failed.');
    $('browserUrl').value = data.finalUrl || target;
    $('browserStatus').textContent = `${data.status} ${data.statusText}`;
    $('browserStatus').style.color = statusTone(data.status);
    $('browserTiming').textContent = `${data.durationMs} ms · ${(data.contentType || 'unknown').split(';')[0]}`;
    const isHtml = (data.contentType || '').includes('text/html');
    $('browserFrame').srcdoc = isHtml ? withBaseTag(data.body, data.finalUrl || target) : `<pre style="white-space:pre-wrap;font-family:ui-monospace;padding:16px">${escapeHtml(data.body)}</pre>`;
    const capture = addCapture({
      source: 'browser',
      method: 'GET',
      url: data.requestUrl,
      finalUrl: data.finalUrl,
      status: data.status,
      statusText: data.statusText,
      durationMs: data.durationMs,
      contentType: data.contentType,
      responseHeaders: data.headers,
      responseBody: data.body,
      requestHeaders: {},
      requestBody: ''
    });
    state.selectedId = capture.id;
    if (!fromHistory) {
      state.browserHistory = state.browserHistory.slice(0, state.browserIndex + 1);
      state.browserHistory.push(data.finalUrl || target);
      state.browserIndex = state.browserHistory.length - 1;
    }
    $('browserBack').disabled = state.browserIndex <= 0;
  } catch (error) {
    $('browserStatus').textContent = error.message;
    $('browserStatus').style.color = 'var(--danger)';
    $('browserFrame').srcdoc = `<div style="font-family:system-ui;padding:24px;color:#a44">${escapeHtml(error.message)}</div>`;
  } finally {
    $('browserGo').disabled = false;
  }
}

$('browserGo').addEventListener('click', () => navigate($('browserUrl').value));
$('browserUrl').addEventListener('keydown', (event) => { if (event.key === 'Enter') navigate(event.currentTarget.value); });
$('browserRefresh').addEventListener('click', () => navigate($('browserUrl').value, { fromHistory: true }));
$('browserBack').addEventListener('click', () => {
  if (state.browserIndex <= 0) return;
  state.browserIndex -= 1;
  navigate(state.browserHistory[state.browserIndex], { fromHistory: true });
  $('browserBack').disabled = state.browserIndex <= 0;
});

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function tryPrettyBody(body, contentType = '') {
  if (!body) return '';
  if (contentType.includes('json')) {
    try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; }
  }
  return body;
}

$('restSend').addEventListener('click', async () => {
  $('restSend').disabled = true;
  $('restResponseMeta').textContent = 'Sending…';
  try {
    const requestHeaders = parseHeaderLines($('restHeaders').value);
    const payload = {
      method: $('restMethod').value,
      url: $('restUrl').value,
      headers: requestHeaders,
      body: $('restBody').value
    };
    const response = await fetch('/api/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    $('restResponseMeta').textContent = `${data.status} ${data.statusText} · ${data.durationMs} ms`;
    $('restResponseMeta').style.color = statusTone(data.status);
    $('restResponse').textContent = tryPrettyBody(data.body, data.contentType);
    const capture = addCapture({
      source: 'rest',
      method: payload.method,
      url: data.requestUrl,
      finalUrl: data.finalUrl,
      status: data.status,
      statusText: data.statusText,
      durationMs: data.durationMs,
      contentType: data.contentType,
      responseHeaders: data.headers,
      responseBody: data.body,
      requestHeaders,
      requestBody: payload.body
    });
    state.selectedId = capture.id;
  } catch (error) {
    $('restResponseMeta').textContent = 'Request failed';
    $('restResponseMeta').style.color = 'var(--danger)';
    $('restResponse').textContent = error.message;
  } finally {
    $('restSend').disabled = false;
  }
});

function renderNetwork() {
  const filter = $('networkFilter').value.trim().toLowerCase();
  const items = state.captures.filter((capture) => `${capture.method} ${capture.url}`.toLowerCase().includes(filter));
  if (!items.length) {
    $('networkList').innerHTML = '<div class="empty-state">No matching requests.</div>';
    return;
  }
  $('networkList').innerHTML = items.map((capture) => `
    <button class="network-row ${capture.id === state.selectedId ? 'selected' : ''}" data-id="${capture.id}">
      <span class="method ${capture.method.toLowerCase()}">${escapeHtml(capture.method)}</span>
      <span class="url-cell" title="${escapeHtml(capture.url)}">${escapeHtml(capture.url)}</span>
      <span class="status-cell">${capture.status}</span>
      <span class="timing-cell">${capture.durationMs} ms</span>
    </button>`).join('');
  document.querySelectorAll('.network-row').forEach((row) => row.addEventListener('click', () => selectCapture(row.dataset.id)));
}

function selectCapture(id) {
  state.selectedId = id;
  const capture = state.captures.find((item) => item.id === id);
  if (!capture) return;
  renderNetwork();
  $('sendToRest').disabled = false;
  $('networkDetail').innerHTML = `
    <div class="detail-block"><h3>Summary</h3><pre>${escapeHtml(`${capture.method} ${capture.url}\n${capture.status} ${capture.statusText}\n${capture.durationMs} ms\nSource: ${capture.source}`)}</pre></div>
    <div class="detail-block"><h3>Request headers</h3><pre>${escapeHtml(headerObjectToLines(capture.requestHeaders) || '—')}</pre></div>
    <div class="detail-block"><h3>Response headers</h3><pre>${escapeHtml(headerObjectToLines(capture.responseHeaders) || '—')}</pre></div>
    <div class="detail-block"><h3>Response preview</h3><pre>${escapeHtml(tryPrettyBody(capture.responseBody, capture.contentType).slice(0, 8000) || '—')}</pre></div>`;
}

$('networkFilter').addEventListener('input', renderNetwork);
$('clearNetwork').addEventListener('click', () => {
  state.captures = [];
  state.selectedId = null;
  $('networkCount').textContent = '0';
  $('sendToRest').disabled = true;
  $('networkDetail').innerHTML = '<div class="detail-empty">Select a request to inspect status, timing, headers and response.</div>';
  renderNetwork();
});
$('sendToRest').addEventListener('click', () => {
  const capture = state.captures.find((item) => item.id === state.selectedId);
  if (!capture) return;
  const draft = toRestDraft(capture);
  $('restMethod').value = draft.method;
  $('restUrl').value = draft.url;
  $('restHeaders').value = headerObjectToLines(draft.headers);
  $('restBody').value = draft.body;
  showWorkspace('rest');
});

renderNetwork();
