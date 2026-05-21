# AGENTS.md

## Snapshot
- Hexo blog (`hexo@7.3.0`) with theme `butterfly`; deploy target is GitHub Pages (`main`) via `hexo-deployer-git`.
- Site URL and language are set in `_config.yml` (`https://superbigmango.top`, `zh-CN`).

## Commands That Matter
- `npm run server` - local preview (Hexo dev server).
- `npm run clean` - removes generated state (`public/`, `db.json` via Hexo clean).
- `npm run build` - generate static site into `public/`.
- `npm run deploy` - deploy with configured git deployer.
- `node generate-holidays.js` - regenerates `source/holidays.json` used by holiday popup script.

## Source of Truth for Config
- Core/site/plugin config: `_config.yml`.
- Theme behavior/customization: `_config.butterfly.yml` (this overrides most theme-level behavior; avoid editing `themes/butterfly/_config.yml` unless intentionally patching vendored theme).
- Post scaffold: `scaffolds/post.md` (current front-matter keys include `Author`, `tags`, `categories`, `cover`, `top_img`).

## Repo-Specific Wiring (Easy to Miss)
- `post_asset_folder: true` in `_config.yml`: post assets are expected alongside each post folder.
- Permalink format is `posts/:abbrlink.html` with `abbrlink` `crc32 + hex`; do not assume slug-based URLs.
- Custom CSS is injected from `_config.butterfly.yml` `inject.head` -> `/css/custom.css` (`source/css/custom.css`).
- Holiday popup script is injected from `_config.butterfly.yml` `inject.bottom` -> `/js/holiday-popup.js` with `data-pjax`; data file is `/holidays.json`.
- PJAX is enabled (`_config.butterfly.yml`), so custom JS should be PJAX-safe (bind init on `pjax:complete` or equivalent).
- Homepage category shortcuts come from `magnet` in `_config.yml`; category cards are separately configured under `categories` in `_config.butterfly.yml`. Keep these category sets consistent.

## Editing Boundaries
- Never edit generated artifacts manually: `public/`, `db.json`, `.deploy_git/`.
- `themes/butterfly/` is vendored upstream theme code; prefer root configs and `source/` overrides for normal site changes.
- If changing category taxonomy, update both:
  - `_config.yml` -> `magnet.display`
  - `_config.butterfly.yml` -> `categories`

## Fast Verification
- For config/CSS/JS changes: run `npm run clean` then `npm run build` (clean build catches stale Hexo cache issues).
- For content-only post edits: `npm run server` is usually enough for spot checks.
