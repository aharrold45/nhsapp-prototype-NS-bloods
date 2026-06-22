# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The **NHS App prototype** — a customised fork of the [NHS prototype kit](https://prototype-kit.service-manual.nhs.uk/) (itself based on the GOV.UK prototype kit) for building interactive HTML prototypes of NHS App screens for user research. It is **not production software**: prototypes fake behaviour with session data and Nunjucks templates, not real backends. Components come from `nhsuk-frontend` plus `nhsapp-frontend` (NHS App-specific components).

Requires Node `^20.9.0 || ^22.11.0` (`.nvmrc` pins 20).

## Commands

```bash
npm run watch        # PRIMARY dev command — gulp build + nodemon + browser-sync auto-reload
npm start            # plain node app.js (no rebuild/reload — avoid for local dev)
npm run build        # gulp build: clean public/, compile Sass + Babel JS + copy assets
npm test             # jest (tests live in tests/lib/)
npm test -- core_filters         # run a single test file by name
npm run lint         # eslint + prettier --check
npm run lint:fix     # auto-fix both
```

`npm run watch` serves on `localhost:2000` (proxied by browser-sync at `:3000`). `findAvailablePort` bumps the port if taken. There is no separate watch for CSS/JS beyond gulp — editing Sass/JS in `app/assets/` recompiles into `public/`; `public/` is generated, never edit it directly.

## Architecture

**`app.js`** is the Express entrypoint. Key behaviours that explain most of the kit's "magic":

- **Auto-routing** (`lib/middleware/auto-routing.js`): any GET path with no extension is resolved to a template — `/foo` tries `app/views/foo.html` then `app/views/foo/index.html`, else 404. So **most pages need no route code**; just add a `.html` view. Explicit routes in `app/routes.js` only exist for pages needing server logic.
- **POST→GET redirect**: all POSTs to extensionless paths are 302-redirected to the GET of the same path (carrying query string). Forms therefore "submit" by storing data and re-rendering — see auto-store-data.
- **autoStoreData** (`lib/utils.js`): when `useAutoStoreData` is on (default, `app/config.js`), every form field in POST body / GET query is merged into `req.session.data` and exposed to all views as `data`. Inputs prefixed `_` are ignored; `_unchecked` sentinel removes unselected checkbox values. Defaults come from `app/data/session-data-defaults.js` (auto-created on first run from `lib/template.session-data-defaults.js` — gitignored, do not commit).
- **Nunjucks view resolution order** is set in `app.js` and matters when names collide: `app/views/` → `lib/example-templates/` → `lib/prototype-admin/` → `lib/templates/` → the `nhsuk-frontend` and `nhsapp-frontend` component/macro dirs in `node_modules`.

**Three layers of routing/apps:**
1. `app/routes.js` — your custom prototype routes (mounted at `/`).
2. `lib/example-templates/` (mounted at `/example-templates`) and `lib/prototype-admin/` (at `/prototype-admin`) — kit-provided pages, generally leave alone.
3. Auto-routing catch-all for everything else.

### Views and the p5/p9 convention

Pages live in `app/views/pages/`. Many screens have **`-p5` and `-p9` variants** (e.g. `home-p5.html`, `home-p9.html`) representing different design iterations/phases — `/` renders `home-p9` (the current default). When editing a screen, check which variant is actually wired up before changing the wrong one. Layouts in `app/views/`:

- `layout.html` — base; `layout-app.html` extends it and switches between **native** (in-app webview) and **web** styling based on `data['web'] === "yes"`, plus splash-screen / not-signed-in / iOS-locked-screen variants.

### Adding behaviour

- **Custom server logic**: add a route in `app/routes.js` above `module.exports`.
- **Nunjucks filters**: add to `app/filters.js` (custom) — merged with `lib/core_filters.js` via `addNunjucksFilters`. Use as `{{ value | filterName }}`.
- **Styling**: edit `app/assets/sass/main.scss` and partials under `app/assets/sass/{components,prototype-specific}/`. Sass `loadPaths` includes `node_modules`, so `@use`/`@import` of nhsuk-frontend works.
- **Client JS**: `app/assets/javascript/` (Babel-compiled to `public/js/`).

### The availability / clinic-finder feature

The main bespoke server logic is the appointment-availability flow:
- `app/routes.js` handles `/pages/your-health/view-availability-results?postcode=...`.
- `app/data/postcode-map.json` maps a postcode (with progressive-shortening fallback: full → 5 → 3 → 2 chars → `DEFAULT`) to clinic IDs.
- `app/data/clinics.json` holds clinic records (array or `{clinics: {...}}` — both shapes handled). Read fresh per request so edits show immediately without restart.
- `lib/availability.js` deterministically generates appointment slot times from a postcode+clinic seed (so the same inputs always produce the same fake times). A clinic's own `times` in JSON, if present, takes precedence.

## Conventions / gotchas

- `app/` files use semicolons and tabs in places; `lib/` and root files are 2-space no-semi (prettier-managed). Run `npm run lint:fix` before committing — lint is the source of truth, don't hand-match style.
- `.env` and `app/data/session-data-defaults.js` are auto-created on startup and gitignored — they are local config, not source.
- Prototypes are throwaway demo code; prioritise matching existing page patterns and NHS frontend components over abstraction or "correctness" of fake logic.
