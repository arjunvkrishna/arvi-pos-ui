# Frontend tools (build time only, never shipped in the image)

The app is still plain HTML + JavaScript served by nginx: no framework, no bundler at runtime. These tools only produce static
files that are committed to git, so deploying is unchanged.

## Layout

| File | What it is |
|---|---|
| `index.html`, `menu.html` | The pages. They load **no outside hosts** (CSP enforces this). |
| `app.js` | The always-loaded core: sign-in, POS, billing, printing, menu, inventory, bills, shifts, notifications. |
| `js/*.js` | On-demand files (suppliers, analytics, staff, expenses, attendance, audit, users, telegram, recipes). Loaded the first time one of their functions is used. |
| `tailwind.css` | **Generated** Tailwind CSS. Do not edit by hand. |
| `vendor/` | Font Awesome, Outfit font and Chart.js, downloaded once and verified. Directory names carry the version. |
| `style.css` | Hand-written CSS (loads before `tailwind.css`; keep that order). |
| `sw.js` | Service worker: offline app shell. Its file list and cache name must carry the release version. |

## Everyday workflow

```
# 1. edit app.js, js/*.js, index.html, style.css ...
# 2. if you added/changed any Tailwind class:
neram-pos-frontend/tools/build-css.sh          # regenerates tailwind.css  (commit it)
# 3. if you added/removed/renamed a function in js/*.js:
node neram-pos-frontend/tools/check-chunks.js --write   # regenerates the registry block inside app.js (commit it)
# 4. before building images:
neram-pos-frontend/tools/check-all.sh          # must say ALL CHECKS PASSED
```

## How the on-demand loading works (so you can reason about it)

* `app.js` contains `LAZY_REGISTRY`: for every function declared in a `js/*.js` file there is a small stub on `window`.
* Calling a stub (from an `onclick`, from `switchTab`, from another function) loads `js/<chunk>.js?v=<release>`, then runs the real
  function. After that the real function has replaced the stub, so later calls are direct.
* A stub cancels a `submit` event immediately, so a form is never submitted natively while its chunk is still loading.
* While idle after sign-in the browser prefetches the chunks the user's role can open, so the first click is normally instant.

Rules (enforced by `check-chunks.js`):

1. A `js/*.js` file contains **only function declarations and its own private variables**: no code that runs at load.
2. State that more than one file uses is declared in `app.js` (like `allSuppliers`), never in a chunk.
3. A function name is declared in exactly one file.
4. After adding/removing a function in a chunk, run `check-chunks.js --write`.

To move a screen out of the core, move its functions into a new `js/<name>.js`, add `<name>` to the prefetch lists in
`prefetchChunksForRole` if appropriate, add the file to the list in `sw.js`, and run the commands above.

## Updating a library

Edit the version numbers at the top of `tools/fetch-vendor.sh`, run it, then update the paths in `index.html`, `menu.html` and
`sw.js` (the directory name contains the version, which is what makes year-long caching safe).

## Caching rules (nginx.conf)

* `app.js`, `js/*.js`, `style.css`, `tailwind.css` requested **with `?v=`** are cached for a year (the release number is the `?v=`).
  This is why every release must bump the version everywhere. `check-all.sh` verifies it.
* `/vendor/` is cached for a year (versioned directory names). `index.html` and `sw.js` are always revalidated.
