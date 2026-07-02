# Repository Guidelines

## Project Structure & Module Organization

This is a static browser app for generating VK report `.xlsx` files.

- `index.html` contains the application markup and CDN script links.
- `css/styles.css` contains all page styling and responsive layout rules.
- `js/app.js` is the entry point: form handling, validation, file flow, and report generation orchestration.
- `js/ui.js` manages DOM-only behavior such as notifications, file labels, hints, and reset state.
- `js/reportProcessor.js` contains report business logic and aggregation.
- `js/excelGenerator.js` creates and styles the final workbook with ExcelJS.
- `js/fileReader.js`, `js/phoneUtils.js`, and `js/formatters.js` hold focused utility functions.
- `VK.html` is the original single-file source snapshot; avoid editing it unless explicitly updating the legacy version.

## Build, Test, and Development Commands

No build step is required. Run the app through a local HTTP server because `index.html` uses ES modules:

```bash
python -m http.server 8000
```

Open `http://127.0.0.1:8000/index.html`.

Check JavaScript syntax before handing off changes:

```bash
node --check js/app.js
node --check js/ui.js
node --check js/excelGenerator.js
node --check js/reportProcessor.js
```

## Coding Style & Naming Conventions

Use ES modules with explicit `import`/`export`. Keep functions small and grouped by responsibility. Use 4-space indentation in HTML, CSS, and JS. Prefer descriptive camelCase names for JavaScript variables and functions, for example `getExcelStyleSettings` or `normalizePhoneCached`.

Keep DOM manipulation in `ui.js` or `app.js`; keep calculation logic out of UI files. Preserve UTF-8 text and Russian UI labels.

## Testing Guidelines

There is no formal automated test suite yet. For each change, perform:

- JS syntax checks with `node --check`.
- Manual browser testing through the local server.
- A sample `.xlsx` generation using representative Ads, Groups, and optional Leads files.

If adding tests later, place them under `tests/` and name files after the module, for example `reportProcessor.test.js`.

## Commit & Pull Request Guidelines

This folder currently has no Git history, so no existing commit convention is available. Use concise imperative commit messages such as `Add Excel style controls` or `Refactor report aggregation`.

Pull requests should include a short description, changed files or modules, manual test notes, and screenshots for UI changes. Mention any changes to expected input columns or generated Excel formatting.

## Security & Configuration Tips

Input files are processed in the browser; do not add server upload behavior without explicit approval. External libraries are loaded from CDN in `index.html`, so keep versions pinned when updating dependencies.
