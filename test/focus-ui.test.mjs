import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Focus UI removes the upstream neon-lime accent', async () => {
  const css = await fs.readFile(new URL('../src/public/styles.css', import.meta.url), 'utf8');
  assert.equal(css.toLowerCase().includes('#c6fe1e'), false);
  assert.match(css, /--accent:\s*#57a9d8/i);
});

test('hover states are surface-led while focus gets the accent ring', async () => {
  const css = await fs.readFile(new URL('../src/public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.icon-button:hover[^}]*background:\s*var\(--surface-hover\)/s);
  assert.match(css, /:focus-visible[^}]*box-shadow:\s*0 0 0 3px var\(--focus-ring\)/s);
});
