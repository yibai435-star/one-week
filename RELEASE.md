# One Week 1.6.1 release checks

## Package

- Public product name: One Week. English and Simplified Chinese interfaces.
- Keep plugin ID `baiyi-weekly-planner` for compatible upgrades.
- Desktop Obsidian 1.14.5 or newer. Mobile is intentionally not enabled in this first release.
- MIT license; public author is yibai435-star.
- No personal timetable, teacher names, PDF paths, `data.json`, or vault backups in source or release assets.
- No telemetry, accounts, runtime network dependencies or paid services.

## Verification

- 94 automated local checks pass, including original recurrence, rollover, persistence and backup behavior and new independent locale/import tests.
- Chinese browser regressions pass for short events, note links, one-off class changes, preserved class duration, routines, layout, imports, and undo.
- English browser checks pass for week/month/matrix editors, semester settings, English CSV, routines, backup UI, language changes, and preserving raw Chinese user content.
- User HTML is displayed as text. The Obsidian view uses the public `sanitizeHTMLToDom` API for HTML rendering.
- Product screenshots use invented examples only.

## Publishing

The GitHub release must attach `main.js`, `manifest.json`, and `styles.css` with tag `1.6.1`. Community installation is available only after the Obsidian directory accepts the listing. See [the official submission guide](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin).

## 1.6.1 review corrections

The original 1.6.0 scan reported an incomplete npm lockfile and could not install
its review/build dependencies. Regenerate the lockfile in an empty directory;
all 26 platform dependency records are now present, including darwin-arm64.
The root package license now matches package.json.

Build from plugin.js into the root main.js and mirror the result into dist/.
The two output files have identical SHA-256 hashes. A fresh npm ci, 26 public
tests, syntax checks, and production build pass. The private legacy suite
brings local automated checks to 94. Browser regressions pass for short
completion controls, note links, layout, import/undo, themes, and both languages.

Scoped selector specificity replaces !important declarations. Unused :has and
partial compatibility declarations are removed. New releases attach only
main.js, manifest.json, and styles.css. Optional GitHub attestations are not
claimed; the community scanner must evaluate the new release independently.
