# DevLens

DevLens is a clean-room developer browser workspace inspired by the workflow class of tools that combine browsing, network inspection, and a REST client. This repository intentionally uses an independent implementation and identity.

## First vertical slice

- **Focus UI**: near-black/slate surfaces with a restrained cyan accent. Hover uses surface contrast; accent is reserved for focus, active navigation, and primary actions.
- **Browser preview**: fetch an HTTP(S) page through a local safety layer and render a sandboxed preview.
- **Network capture**: browser navigation and REST requests are recorded with method, URL, status, duration, headers, and response preview.
- **Network → REST replay**: select a capture and move its method, URL, headers, and body into the REST workspace with one action.
- **REST client**: replay arbitrary public HTTP(S) endpoints through the local server to avoid browser CORS limitations.
- **Safe defaults**: local, private, link-local, multicast, and metadata endpoints are blocked by default to reduce SSRF risk.

## Why the visual system changed

User feedback on the reference product called out excessive saturated color and too many competing emphasis states. DevLens makes color semantic instead of decorative: primary actions and keyboard focus get the brand accent; hover and selection rely primarily on surface contrast; HTTP methods retain low-saturation semantic badges.

## Run

Requires Node.js 22+.

```bash
npm install
npm start
```

Open `http://127.0.0.1:4317`.

## Verify

```bash
npm run check
npm test
```

## Architecture

```text
Browser UI (dependency-free HTML/CSS/JS)
        |
        | /api/browse, /api/request
        v
Node local gateway
  - URL policy / SSRF protections
  - request execution
  - bounded response previews
        |
        v
Public HTTP(S) endpoint
```

The local gateway is deliberately small so it can later be embedded behind an Electron or native desktop shell without changing the interaction model.

## Current limitations

This is the first vertical slice, not a full Chromium browser. Browser mode renders a server-fetched, sandboxed HTML preview and captures the top-level navigation, not every subresource request. The next desktop phase will use an embedded browser engine to provide full request instrumentation, tabs, cookies/storage, HAR capture, and request timing waterfalls.

## Roadmap

1. Desktop shell + embedded Chromium instrumentation.
2. Full request/subresource capture and waterfall timing.
3. HAR import/export and transaction viewer.
4. Cookies, localStorage, and sessionStorage inspector.
5. Collections, environments, encrypted secrets, cURL import/export.
6. Response diffing and browser-vs-REST comparison.
7. Optional debugging assistant, kept separate from the core UI.
