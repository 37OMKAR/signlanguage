# Changelog

All notable changes. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Two-bone arm IK with named body anchors (`R_at` / `L_at`) so signs reach the
  chin, forehead, chest and more. 35 signs annotated. See `docs/ARM_IK.md`.
- ESLint flat config, lint step in CI.
- `docs/AUDIT.md`, `docs/ARM_IK.md`, `CONTRIBUTING.md`, issue and PR templates.
- Screenshots in `docs/screenshots/` and a rewritten README.

### Fixed
- Repeated words ("yes yes yes") no longer freeze the sign queue.
- Queue side effects moved out of a React state updater (double-run under StrictMode).
- Stale sign loads can no longer overwrite a newer translation.
- Mojibake in two dictionary notes.

### Changed
- `WORKSTEP.md` moved to `docs/DEVLOG.md`.

## [0.1.0]

- Initial scaffold: rule-based gloss, rigged avatar, ASL/ISL dictionary,
  fingerspelling, Sign → Text recogniser, accessibility controls.
