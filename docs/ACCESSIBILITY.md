# Accessibility

Target: WCAG 2.2 AA.

## Features shipped

| Feature | Where | WCAG |
|---|---|---|
| Large captions overlay | `CaptionOverlay` | 1.4.4 |
| Adjustable caption font (16-64px) | `ControlsPanel` | 1.4.4 |
| Screen-reader `aria-live` on captions | `CaptionOverlay` | 4.1.2 |
| Descriptive label on textarea | `TextInput` | 3.3.2 |
| Text-to-speech of input | `a11y/tts.ts` | 1.2.1 (audio alt) |
| Keyboard submit (Ctrl/Cmd+Enter) | `TextInput` | 2.1.1 |
| Visible focus ring | `index.css` | 2.4.7 |
| High-contrast mode toggle | `ControlsPanel` + `index.css` | 1.4.11 |
| Dyslexia-friendly font toggle (OpenDyslexic) | `ControlsPanel` | 1.4.8 |
| Playback speed 0.25×-2.0× | `ControlsPanel` → player | 2.2.2 |
| Reduced-motion mode | `ControlsPanel` → player | 2.3.3 |
| TTS on/off | `ControlsPanel` | user control |

## Feature detection

- `speechSynthesis` is feature-detected; unsupported browsers get a
  silent no-op instead of an error.
- WebGL is required for the 3D view. A future non-3D fallback can render
  fingerspelling as static images if WebGL is unavailable.

## What we do NOT claim yet

- No formal Lighthouse audit run in CI (planned in `.github/workflows/ci.yml`).
- No screen-reader announcement of every 3D frame (would be noisy). The
  caption `aria-live="polite"` region announces each gloss instead.
- No facial-expression grammar in the placeholder rig. Head model is
  present, blendshape hooks exist in the type system, but authoring is
  Phase 3 work.

## Reduced-motion behaviour

When `settings.reducedMotion === true`:

- Playback speed is fixed at ~0.67× (durations extended by 1.5×).
- Sign transitions skip cross-fade blending.
- Wrist-wag characters (J, Z) still animate — those *are* the letter.

## Testing checklist for PRs touching UI

- Tab through all controls; every one reachable and visible focus.
- Every input has a `<label>` or `aria-label`.
- Color contrast ≥ 4.5:1 in default and high-contrast modes.
- Turn off CSS: the page still communicates the current gloss and controls.
- Zoom to 200%: no clipped content or horizontal scroll on desktop.
