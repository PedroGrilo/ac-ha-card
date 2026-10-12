/*
 * ACHA Card — styles.js
 * Exports: ACHA_CARD_CSS (acha-card shadow root), ACHA_PANEL_CSS (acha-panel shadow root).
 *
 * Theme: acha-card host gets [data-theme="dark"|"light"]; tokens below are custom properties
 * and inherit into every child shadow root (acha-panel, acha-dial, acha-unit, acha-sheet).
 * acha-panel sets --acha-accent (+ --acha-accent-soft) on its host; all accent tints derive from --acha-accent
 * via color-mix(), so no rgb triplet is required. acha-card may set --acha-card-accent (active panel accent)
 * on ha-card for the card-level glow, and --acha-pill-color on each .acha-pill.
 *
 * Card class map:  ha-card.acha-card[.layout-tabs|.layout-stack|.layout-grid]
 *   .acha-header > .acha-title-wrap > .acha-title, .acha-summary(.on) > .acha-summary-dot ; .acha-alloff(.show)
 *   .acha-switcher > .acha-pill-indicator (uses --acha-ind-x / --acha-ind-w / --acha-ind-color)
 *                  > .acha-pill(.active)(.on)(.unavailable) > .acha-pill-dot, .acha-pill-name, .acha-pill-temp
 *   .acha-viewport > .acha-track(.dragging) (uses --acha-index, --acha-drag px) > acha-panel
 * Panel class map: :host([on]) / :host([unavailable]) / :host([active]) or .acha-panel.is-on/.is-unavailable
 *   .acha-ambient ; .acha-panel > .acha-p-header > .acha-p-icon, .acha-p-titles > .acha-p-name, .acha-p-status ; .acha-power(.on)
 *   .acha-hero > .acha-unit-wrap, .acha-dial-wrap ; .acha-stepper > .acha-step-btn(.minus|.plus), .acha-step-mid
 *   .acha-chips > .acha-chip > ha-icon, .acha-chip-value, .acha-chip-label
 *   .acha-toggles > .acha-toggle(.active)
 *   .acha-tiles > .acha-tile(.active)(.disabled)(.readonly) > .acha-tile-icon, .acha-tile-text > .acha-tile-label,
 *                 .acha-tile-value ; .acha-tile-chev ; .acha-ripple (span, positioned via --x/--y)
 *   .acha-banner ; .acha-footer > .acha-conn(.ok|.bad) > .acha-conn-dot ; .acha-energy
 */

const _styles_TOKENS = `
:host {
  --acha-font: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif));
  --acha-radius: 28px;
  --acha-radius-md: 20px;
  --acha-radius-sm: 14px;
  --acha-ease: cubic-bezier(.22, .8, .24, 1);
  --acha-spring: cubic-bezier(.2, .9, .25, 1.15);
  --acha-accent: #3fa9f5;
  --acha-accent-soft: color-mix(in srgb, var(--acha-accent) 16%, transparent);

  /* dark glass (default) */
  --acha-bg: rgba(16, 18, 24, .82);
  --acha-bg-grad: linear-gradient(160deg, rgba(34, 38, 50, .70) 0%, rgba(16, 18, 24, .86) 55%, rgba(10, 11, 16, .92) 100%);
  --acha-surface: rgba(255, 255, 255, .055);
  --acha-surface-hover: rgba(255, 255, 255, .085);
  --acha-surface-strong: rgba(255, 255, 255, .11);
  --acha-border: rgba(255, 255, 255, .085);
  --acha-border-strong: rgba(255, 255, 255, .16);
  --acha-highlight: rgba(255, 255, 255, .07);
  --acha-text: #f4f6fb;
  --acha-muted: rgba(226, 232, 245, .58);
  --acha-faint: rgba(226, 232, 245, .34);
  --acha-track: rgba(255, 255, 255, .09);
  --acha-shadow: 0 24px 60px -18px rgba(0, 0, 0, .65), 0 8px 22px -10px rgba(0, 0, 0, .5);
  --acha-shadow-sm: 0 6px 18px -8px rgba(0, 0, 0, .55);
  --acha-knob: #ffffff;
  --acha-danger: #ff5d6c;
  --acha-ok: #34d399;
  --acha-glow-strength: .55;
  --acha-ripple: 32%;
  color-scheme: dark;
}

:host([data-theme="light"]) {
  --acha-sheet-backdrop: rgba(30, 40, 60, .22);
  --acha-bg: rgba(248, 250, 253, .80);
  --acha-bg-grad: linear-gradient(160deg, rgba(255, 255, 255, .92) 0%, rgba(244, 247, 252, .84) 55%, rgba(232, 237, 245, .86) 100%);
  --acha-surface: rgba(255, 255, 255, .72);
  --acha-surface-hover: rgba(255, 255, 255, .92);
  --acha-surface-strong: rgba(15, 23, 42, .06);
  --acha-border: rgba(15, 23, 42, .07);
  --acha-border-strong: rgba(15, 23, 42, .13);
  --acha-highlight: rgba(255, 255, 255, .9);
  --acha-text: #0f172a;
  --acha-muted: rgba(30, 41, 59, .60);
  --acha-faint: rgba(30, 41, 59, .38);
  --acha-track: rgba(15, 23, 42, .08);
  --acha-shadow: 0 22px 50px -20px rgba(30, 41, 80, .28), 0 6px 18px -10px rgba(30, 41, 80, .18);
  --acha-shadow-sm: 0 6px 16px -8px rgba(30, 41, 80, .22);
  --acha-knob: #ffffff;
  --acha-danger: #e5484d;
  --acha-ok: #12a26b;
  --acha-glow-strength: .32;
  --acha-ripple: 22%;
  color-scheme: light;
}
`;

const _styles_CARD_BASE = `
:host {
  display: block;
  font-family: var(--acha-font);
  color: var(--acha-text);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  container-type: inline-size;
  container-name: acha-card;
}
*, *::before, *::after { box-sizing: border-box; }
button { font: inherit; color: inherit; }

ha-card.acha-card, .acha-card {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 16px 16px;
  border-radius: var(--acha-radius);
  background: var(--acha-bg-grad), var(--acha-bg);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid var(--acha-border);
  box-shadow: var(--acha-shadow), inset 0 1px 0 var(--acha-highlight);
  color: var(--acha-text);
  font-family: var(--acha-font);
}
.acha-card::before {
  content: "";
  position: absolute;
  inset: -40% -20% auto -20%;
  height: 80%;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--acha-card-accent, var(--acha-accent)) calc(var(--acha-glow-strength) * 45%), transparent), transparent 75%);
  filter: blur(18px);
  opacity: .9;
  transition: background 600ms var(--acha-ease);
}

/* ---------- header ---------- */
.acha-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px;
  min-height: 36px;
}
.acha-title-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
.acha-title {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.acha-summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 4px 10px 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--acha-muted);
  background: var(--acha-surface);
  border: 1px solid var(--acha-border);
  transition: color 300ms var(--acha-ease), background 300ms var(--acha-ease);
}
.acha-summary-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--acha-faint);
  transition: background 300ms var(--acha-ease), box-shadow 300ms var(--acha-ease);
}
.acha-summary.on { color: var(--acha-text); }
.acha-summary.on .acha-summary-dot {
  background: var(--acha-ok);
  box-shadow: 0 0 0 3px rgba(52, 211, 153, .18), 0 0 10px rgba(52, 211, 153, .6);
  animation: acha-pulse 2.4s var(--acha-ease) infinite;
}
.acha-alloff {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  height: 34px;
  padding: 0 14px 0 10px;
  border: 1px solid var(--acha-border);
  border-radius: 999px;
  background: var(--acha-surface);
  color: var(--acha-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  opacity: 0;
  transform: scale(.9);
  pointer-events: none;
  transition: opacity 260ms var(--acha-ease), transform 260ms var(--acha-spring), background 200ms, border-color 200ms, color 200ms;
}
.acha-alloff ha-icon { --mdc-icon-size: 18px; color: var(--acha-danger); }
.acha-alloff.show { opacity: 1; transform: none; pointer-events: auto; }
.acha-alloff:hover { background: var(--acha-surface-hover); border-color: var(--acha-border-strong); }
.acha-alloff:active { transform: scale(.95); }
.acha-alloff:focus-visible, .acha-pill:focus-visible { outline: 2px solid color-mix(in srgb, var(--acha-accent) 80%, transparent); outline-offset: 2px; }
`;

const _styles_CARD_SWITCHER = `
/* ---------- AC switcher pills ---------- */
.acha-switcher {
  position: relative;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--acha-surface-strong);
  border: 1px solid var(--acha-border);
  overflow-x: auto;
  scrollbar-width: none;
  scroll-snap-type: x proximity;
  isolation: isolate;
}
.acha-switcher::-webkit-scrollbar { display: none; }
.acha-pill-indicator {
  position: absolute;
  top: 4px; bottom: 4px; left: 0;
  width: var(--acha-ind-w, 0px);
  transform: translateX(var(--acha-ind-x, 0px));
  border-radius: 999px;
  z-index: -1;
  background: var(--acha-surface-hover);
  border: 1px solid var(--acha-border-strong);
  box-shadow: var(--acha-shadow-sm), 0 0 18px -6px var(--acha-ind-color, transparent), inset 0 1px 0 var(--acha-highlight);
  transition: transform 460ms var(--acha-spring), width 460ms var(--acha-spring), box-shadow 600ms var(--acha-ease);
}
:host([data-theme="light"]) .acha-pill-indicator { background: #fff; }
.acha-pill {
  position: relative;
  flex: 1 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--acha-muted);
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  scroll-snap-align: center;
  transition: color 240ms var(--acha-ease), transform 160ms var(--acha-ease);
}
.acha-pill:hover { color: var(--acha-text); }
.acha-pill:active { transform: scale(.96); }
.acha-pill.active { color: var(--acha-text); font-weight: 600; }
.acha-pill ha-icon { --mdc-icon-size: 18px; opacity: .85; }
.acha-pill-dot {
  width: 8px; height: 8px; flex: none;
  border-radius: 50%;
  background: var(--acha-pill-color, var(--acha-faint));
  transition: background 600ms var(--acha-ease), box-shadow 600ms var(--acha-ease);
}
.acha-pill.on .acha-pill-dot { box-shadow: 0 0 0 3px color-mix(in srgb, var(--acha-pill-color, #fff) 22%, transparent), 0 0 10px var(--acha-pill-color, transparent); }
.acha-pill:not(.on) .acha-pill-dot { background: var(--acha-faint); }
.acha-pill.unavailable { opacity: .55; }
.acha-pill.unavailable .acha-pill-dot { background: var(--acha-danger); box-shadow: none; }
.acha-pill-name { overflow: hidden; text-overflow: ellipsis; max-width: 14ch; }
.acha-pill-temp {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 500;
  color: var(--acha-faint);
  transition: color 240ms var(--acha-ease);
}
.acha-pill.active .acha-pill-temp { color: var(--acha-muted); }

/* ---------- panel track (tabs layout) ---------- */
.acha-viewport {
  position: relative;
  overflow: hidden;
  border-radius: calc(var(--acha-radius) - 6px);
  margin: 0 -4px;
  touch-action: pan-y;
}
.acha-track {
  display: flex;
  width: 100%;
  transform: translate3d(calc(var(--acha-index, 0) * -100% + var(--acha-drag, 0px)), 0, 0);
  transition: transform 560ms var(--acha-spring);
  will-change: transform;
}
.acha-track.dragging { transition: none; }
.acha-track > acha-panel {
  flex: 0 0 100%;
  min-width: 0;
  padding: 0 4px;
  transition: opacity 420ms var(--acha-ease), transform 560ms var(--acha-spring), filter 420ms var(--acha-ease), --acha-accent 600ms var(--acha-ease);
}
.layout-tabs .acha-track > acha-panel:not([active]) { opacity: .35; transform: scale(.96); filter: saturate(.6); }

/* ---------- stack / grid layouts ---------- */
.layout-stack .acha-track, .layout-grid .acha-track { transform: none; transition: none; }
.layout-stack .acha-viewport, .layout-grid .acha-viewport { overflow: visible; margin: 0; }
.layout-stack .acha-track { flex-direction: column; gap: 14px; }
.layout-stack .acha-track > acha-panel, .layout-grid .acha-track > acha-panel { padding: 0; opacity: 1; transform: none; filter: none; }
.layout-grid .acha-track {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: 14px;
}
.layout-stack .acha-track > acha-panel, .layout-grid .acha-track > acha-panel {
  animation: acha-fade-up 520ms var(--acha-ease) backwards;
}
.layout-stack .acha-track > acha-panel:nth-child(2), .layout-grid .acha-track > acha-panel:nth-child(2) { animation-delay: 70ms; }
.layout-stack .acha-track > acha-panel:nth-child(3), .layout-grid .acha-track > acha-panel:nth-child(3) { animation-delay: 140ms; }
.layout-stack .acha-track > acha-panel:nth-child(n+4), .layout-grid .acha-track > acha-panel:nth-child(n+4) { animation-delay: 200ms; }
.layout-stack .acha-switcher, .layout-grid .acha-switcher { display: none; }

@container acha-card (max-width: 360px) {
  .acha-card { padding: 14px 10px 12px; gap: 12px; }
  .acha-title { font-size: 17px; }
  .acha-pill { padding: 0 10px; gap: 6px; font-size: 13px; }
  .acha-pill-temp, .acha-pill ha-icon { display: none; }
  .acha-alloff .acha-alloff-label { display: none; }
  .acha-alloff { padding: 0 10px; }
}
@container acha-card (min-width: 620px) {
  .acha-card { padding: 22px 20px 20px; }
  .acha-switcher { align-self: flex-start; }
  .acha-pill { flex: 0 0 auto; }
}
`;

const _styles_PANEL_BASE = `
:host {
  position: relative;
  display: block;
  overflow: hidden;
  isolation: isolate;
  border-radius: calc(var(--acha-radius) - 4px);
  font-family: var(--acha-font);
  color: var(--acha-text);
  container-type: inline-size;
  container-name: acha-panel;
  -webkit-tap-highlight-color: transparent;
  --acha-accent-soft: color-mix(in srgb, var(--acha-accent) 16%, transparent);
  transition: --acha-accent 600ms var(--acha-ease);
}
*, *::before, *::after { box-sizing: border-box; }
button { font: inherit; color: inherit; -webkit-tap-highlight-color: transparent; }
ha-icon { display: inline-flex; flex: none; }

/* ambient breathing accent glow behind everything */
.acha-ambient {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  border-radius: inherit;
}
.acha-ambient::before, .acha-ambient::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  transition: background 600ms var(--acha-ease), opacity 800ms var(--acha-ease);
}
.acha-ambient::before {
  width: 120%; aspect-ratio: 1; left: -10%; top: -38%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--acha-accent) calc(var(--acha-glow-strength) * 55%), transparent), transparent 72%);
  opacity: .35;
}
.acha-ambient::after {
  width: 70%; aspect-ratio: 1; right: -25%; bottom: -30%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--acha-accent) calc(var(--acha-glow-strength) * 35%), transparent), transparent 70%);
  opacity: 0;
}
:host([on]) .acha-ambient::before, .is-on .acha-ambient::before { opacity: 1; }
:host([on]) .acha-ambient::after, .is-on .acha-ambient::after { opacity: .8; }
/* breathe only on the visible panel (tabs: off-screen panels are inert and lack [active]) */
:host([on][active]) .acha-ambient::before { animation: acha-breathe 6s ease-in-out infinite; }
:host([on][active]) .acha-ambient::after { animation: acha-breathe 8s ease-in-out -3s infinite; }

.acha-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 14px 14px;
  min-height: 100%;
  transition: filter 500ms var(--acha-ease), opacity 500ms var(--acha-ease);
}
:host([unavailable]) .acha-panel > :not(.acha-banner):not(.acha-footer):not(acha-sheet),
.acha-panel.is-unavailable > :not(.acha-banner):not(.acha-footer):not(acha-sheet) {
  filter: grayscale(.9);
  opacity: .42;
  pointer-events: none;
}

/* ---------- header ---------- */
.acha-p-header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
}
.acha-p-icon {
  display: grid;
  place-items: center;
  width: 44px; height: 44px; flex: none;
  border-radius: 15px;
  background: var(--acha-surface);
  border: 1px solid var(--acha-border);
  color: var(--acha-muted);
  --mdc-icon-size: 24px;
  transition: background 600ms var(--acha-ease), color 600ms var(--acha-ease), box-shadow 600ms var(--acha-ease);
}
:host([on]) .acha-p-icon, .is-on .acha-p-icon {
  color: var(--acha-accent);
  background: var(--acha-accent-soft);
  border-color: color-mix(in srgb, var(--acha-accent) 22%, transparent);
  box-shadow: 0 0 22px -8px color-mix(in srgb, var(--acha-accent) 70%, transparent);
}
.acha-p-titles { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.acha-p-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -.012em;
  line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.acha-p-status {
  font-size: 13px;
  color: var(--acha-muted);
  line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.acha-p-status b, .acha-p-status strong { color: var(--acha-accent); font-weight: 600; transition: color 600ms var(--acha-ease); }

/* ---------- power button with glow ring ---------- */
.acha-power {
  position: relative;
  display: grid;
  place-items: center;
  width: 48px; height: 48px; flex: none;
  border-radius: 50%;
  border: 1px solid var(--acha-border-strong);
  background: var(--acha-surface);
  color: var(--acha-muted);
  cursor: pointer;
  --mdc-icon-size: 24px;
  box-shadow: var(--acha-shadow-sm), inset 0 1px 0 var(--acha-highlight);
  transition: background 400ms var(--acha-ease), color 400ms var(--acha-ease), box-shadow 600ms var(--acha-ease), border-color 400ms var(--acha-ease), transform 180ms var(--acha-spring);
}
.acha-power::before {
  content: "";
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--acha-accent) 55%, transparent);
  opacity: 0;
  transform: scale(.85);
  transition: opacity 400ms var(--acha-ease), transform 500ms var(--acha-spring);
  pointer-events: none;
}
.acha-power:hover { background: var(--acha-surface-hover); color: var(--acha-text); }
.acha-power:active { transform: scale(.92); }
.acha-power:focus-visible { outline: 2px solid color-mix(in srgb, var(--acha-accent) 80%, transparent); outline-offset: 4px; }
.acha-power.on {
  color: #fff;
  border-color: transparent;
  background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--acha-accent) 70%, #fff), var(--acha-accent) 70%);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--acha-accent) 35%, transparent), 0 8px 24px -6px color-mix(in srgb, var(--acha-accent) 75%, transparent), 0 0 36px -6px color-mix(in srgb, var(--acha-accent) 60%, transparent);
}
.acha-power.on::before { opacity: 1; transform: none; animation: acha-pulse 2.8s var(--acha-ease) infinite; }
.acha-power[disabled] { opacity: .45; cursor: default; pointer-events: none; }
`;

const _styles_PANEL_HERO = `
/* ---------- hero: unit above dial ---------- */
.acha-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-top: 2px;
}
.acha-unit-wrap {
  width: 100%;
  max-width: 340px;
  margin-bottom: -18px;
  animation: acha-fade-up 600ms var(--acha-ease) backwards;
}
.acha-unit-wrap acha-unit { display: block; width: 100%; }
.acha-dial-wrap {
  position: relative;
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
}
.acha-dial-wrap::before {
  content: "";
  position: absolute;
  inset: 14%;
  border-radius: 50%;
  z-index: -1;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--acha-accent) calc(var(--acha-glow-strength) * 40%), transparent), transparent 70%);
  opacity: 0;
  transition: opacity 700ms var(--acha-ease), background 600ms var(--acha-ease);
}
:host([on]) .acha-dial-wrap::before, .is-on .acha-dial-wrap::before { opacity: 1; }
.acha-dial-wrap acha-dial { display: block; width: 100%; }

/* ---------- - / + stepper ---------- */
.acha-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: -6px;
}
.acha-step-btn {
  position: relative;
  display: grid;
  place-items: center;
  width: 56px; height: 56px; flex: none;
  border-radius: 50%;
  border: 1px solid var(--acha-border);
  background: var(--acha-surface);
  color: var(--acha-text);
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  --mdc-icon-size: 26px;
  box-shadow: var(--acha-shadow-sm), inset 0 1px 0 var(--acha-highlight);
  transition: background 200ms var(--acha-ease), border-color 200ms var(--acha-ease), transform 160ms var(--acha-spring), box-shadow 300ms var(--acha-ease), color 600ms var(--acha-ease);
}
.acha-step-btn:hover { background: var(--acha-surface-hover); border-color: var(--acha-border-strong); }
.acha-step-btn:active, .acha-step-btn.pressed {
  transform: scale(.9);
  background: var(--acha-accent-soft);
  border-color: color-mix(in srgb, var(--acha-accent) 35%, transparent);
  color: var(--acha-accent);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--acha-accent) 8%, transparent), 0 0 24px -6px color-mix(in srgb, var(--acha-accent) 60%, transparent);
}
.acha-step-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--acha-accent) 80%, transparent); outline-offset: 3px; }
.acha-step-btn[disabled] { opacity: .35; pointer-events: none; }
.acha-step-mid {
  min-width: 96px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--acha-faint);
  font-variant-numeric: tabular-nums;
}

/* ---------- status chips (inside / outside / humidity / power) ---------- */
.acha-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.acha-chips:empty { display: none; }
.acha-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 12px 0 10px;
  border-radius: 999px;
  background: var(--acha-surface);
  border: 1px solid var(--acha-border);
  font-size: 13px;
  white-space: nowrap;
  animation: acha-fade-up 480ms var(--acha-ease) backwards;
  --mdc-icon-size: 17px;
}
.acha-chip[hidden] { display: none; }
.acha-chip ha-icon { color: var(--acha-muted); }
.acha-chip-value { font-weight: 600; font-variant-numeric: tabular-nums; }
.acha-chip-label { color: var(--acha-muted); font-size: 12px; }
.acha-chip:nth-child(2) { animation-delay: 50ms; }
.acha-chip:nth-child(3) { animation-delay: 100ms; }
.acha-chip:nth-child(4) { animation-delay: 150ms; }

/* ---------- quick toggle chips (eco / boost / streamer) ---------- */
.acha-toggles {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.acha-toggles:empty { display: none; }
.acha-toggle {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 16px 0 12px;
  border-radius: 999px;
  border: 1px solid var(--acha-border);
  background: var(--acha-surface);
  color: var(--acha-muted);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  --mdc-icon-size: 18px;
  transition: background 300ms var(--acha-ease), color 300ms var(--acha-ease), border-color 300ms var(--acha-ease), box-shadow 400ms var(--acha-ease), transform 160ms var(--acha-spring);
}
.acha-toggle:hover { color: var(--acha-text); background: var(--acha-surface-hover); }
.acha-toggle:active { transform: scale(.96); }
.acha-toggle:focus-visible { outline: 2px solid color-mix(in srgb, var(--acha-accent) 80%, transparent); outline-offset: 2px; }
.acha-toggle.active {
  color: var(--acha-toggle-color, var(--acha-accent));
  background: color-mix(in srgb, var(--acha-toggle-color, var(--acha-accent)) 16%, transparent);
  border-color: color-mix(in srgb, var(--acha-toggle-color, var(--acha-accent)) 38%, transparent);
  box-shadow: 0 0 20px -8px var(--acha-toggle-color, var(--acha-accent));
}
.acha-toggle[disabled] { opacity: .4; pointer-events: none; }
`;

const _styles_PANEL_TILES = `
/* ---------- tile grid ---------- */
.acha-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.acha-tile {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 68px;
  padding: 12px 12px 12px 12px;
  border-radius: var(--acha-radius-md);
  border: 1px solid var(--acha-border);
  background: var(--acha-surface);
  color: var(--acha-text);
  text-align: left;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  box-shadow: inset 0 1px 0 var(--acha-highlight);
  animation: acha-fade-up 520ms var(--acha-ease) backwards;
  transition: background 240ms var(--acha-ease), border-color 300ms var(--acha-ease), box-shadow 400ms var(--acha-ease), transform 200ms var(--acha-spring);
}
.acha-tile:nth-child(2) { animation-delay: 40ms; }
.acha-tile:nth-child(3) { animation-delay: 80ms; }
.acha-tile:nth-child(4) { animation-delay: 120ms; }
.acha-tile:nth-child(5) { animation-delay: 160ms; }
.acha-tile:nth-child(n+6) { animation-delay: 200ms; }
.acha-tile[hidden] { display: none; }
.acha-tile:hover { background: var(--acha-surface-hover); border-color: var(--acha-border-strong); }
.acha-tile:active, .acha-tile.pressed { transform: scale(.96); }
.acha-tile:focus-visible { outline: 2px solid color-mix(in srgb, var(--acha-accent) 80%, transparent); outline-offset: 2px; }
.acha-tile.disabled, .acha-tile[disabled] { opacity: .45; pointer-events: none; }
.acha-tile.readonly { cursor: default; }
.acha-tile.readonly:active { transform: none; }
.acha-tile.active {
  border-color: color-mix(in srgb, var(--acha-accent) 28%, transparent);
  background: linear-gradient(135deg, color-mix(in srgb, var(--acha-accent) 13%, transparent), color-mix(in srgb, var(--acha-accent) 3%, transparent) 70%), var(--acha-surface);
  box-shadow: inset 0 1px 0 var(--acha-highlight), 0 10px 26px -18px color-mix(in srgb, var(--acha-accent) 90%, transparent);
}
.acha-tile-icon {
  display: grid;
  place-items: center;
  width: 42px; height: 42px; flex: none;
  border-radius: 14px;
  background: var(--acha-surface-strong);
  color: var(--acha-muted);
  --mdc-icon-size: 22px;
  transition: background 400ms var(--acha-ease), color 400ms var(--acha-ease), box-shadow 500ms var(--acha-ease), transform 300ms var(--acha-spring);
}
.acha-tile.active .acha-tile-icon {
  color: #fff;
  background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--acha-tile-color, var(--acha-accent)) 68%, #fff), var(--acha-tile-color, var(--acha-accent)) 75%);
  box-shadow: 0 6px 16px -6px var(--acha-tile-color, var(--acha-accent)), 0 0 0 1px rgba(255, 255, 255, .08) inset;
}
.acha-tile:active .acha-tile-icon { transform: scale(.94); }
.acha-tile-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.acha-tile-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--acha-muted);
  letter-spacing: .01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.acha-tile-value {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -.005em;
  line-height: 1.25;
  overflow: hidden;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  transition: color 300ms var(--acha-ease);
}
@container acha-panel (max-width: 479px) {
  .acha-tile-chev { display: none; }
}
.acha-tile-chev {
  flex: none;
  color: var(--acha-faint);
  --mdc-icon-size: 20px;
  margin-right: -4px;
  transition: transform 260ms var(--acha-spring), color 260ms var(--acha-ease);
}
.acha-tile:hover .acha-tile-chev { transform: translateX(2px); color: var(--acha-muted); }

/* ripple: span.acha-ripple appended on pointerdown, left/top via --x/--y (px), removed on animationend */
.acha-ripple {
  position: absolute;
  left: var(--x, 50%);
  top: var(--y, 50%);
  width: 12px; height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--acha-accent) var(--acha-ripple, 32%), transparent);
  pointer-events: none;
  z-index: -1;
  transform: scale(0);
  animation: acha-ripple 620ms var(--acha-ease) forwards;
}

/* ---------- unavailable banner ---------- */
.acha-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--acha-radius-sm);
  background: color-mix(in srgb, var(--acha-danger) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--acha-danger) 30%, transparent);
  color: var(--acha-danger);
  font-size: 13.5px;
  font-weight: 600;
  --mdc-icon-size: 18px;
  animation: acha-fade-up 400ms var(--acha-ease) backwards;
}
.acha-banner[hidden] { display: none; }

/* ---------- footer ---------- */
.acha-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 6px 0;
  font-size: 12px;
  color: var(--acha-faint);
  font-variant-numeric: tabular-nums;
}
.acha-conn, .acha-energy { display: inline-flex; align-items: center; gap: 6px; --mdc-icon-size: 15px; }
.acha-conn-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--acha-faint); }
.acha-conn.ok .acha-conn-dot { background: var(--acha-ok); box-shadow: 0 0 8px rgba(52, 211, 153, .55); }
.acha-conn.bad { color: var(--acha-danger); }
.acha-conn.bad .acha-conn-dot { background: var(--acha-danger); animation: acha-pulse 1.6s var(--acha-ease) infinite; }
.acha-energy[hidden] { display: none; }
`;

const _styles_KEYFRAMES = `
@keyframes acha-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .55; transform: scale(1.06); }
}
@keyframes acha-breathe {
  0%, 100% { transform: scale(1) translate3d(0, 0, 0); opacity: .78; }
  50% { transform: scale(1.12) translate3d(0, 2%, 0); opacity: 1; }
}
@keyframes acha-ripple {
  0% { transform: scale(0); opacity: 1; }
  100% { transform: scale(34); opacity: 0; }
}
@keyframes acha-fade-up {
  from { opacity: 0; transform: translate3d(0, 10px, 0); }
  to { opacity: 1; transform: none; }
}
`;

const _styles_REDUCED_MOTION = `
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
`;

const _styles_PANEL_RESPONSIVE = `
@container acha-panel (max-width: 359px) {
  .acha-panel { padding: 12px 8px 10px; gap: 12px; }
  .acha-p-header { gap: 10px; }
  .acha-p-icon { width: 38px; height: 38px; border-radius: 13px; --mdc-icon-size: 21px; }
  .acha-p-name { font-size: 16px; }
  .acha-p-status { font-size: 12px; }
  .acha-power { width: 42px; height: 42px; --mdc-icon-size: 21px; }
  .acha-stepper { gap: 12px; }
  .acha-step-btn { width: 48px; height: 48px; --mdc-icon-size: 22px; }
  .acha-step-mid { min-width: 64px; }
  .acha-tiles { gap: 8px; }
  /* ~115px tiles: stack icon above text so labels/values get the full tile width */
  .acha-tile { flex-direction: column; align-items: flex-start; justify-content: flex-start; min-height: 92px; padding: 10px; gap: 8px; border-radius: 17px; }
  .acha-tile-icon { width: 36px; height: 36px; border-radius: 12px; --mdc-icon-size: 19px; }
  .acha-tile-text { width: 100%; flex: none; }
  .acha-tile-value {
    font-size: 14px;
    line-height: 1.25;
    white-space: normal;
    overflow-wrap: break-word;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .acha-tile-chev { display: none; }
  .acha-chip { height: 30px; padding: 0 10px 0 8px; font-size: 12px; }
  .acha-chip-label { display: none; }
}
@container acha-panel (min-width: 560px) {
  .acha-panel { padding: 20px 18px 16px; gap: 18px; }
  .acha-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .acha-p-name { font-size: 20px; }
}
@container acha-panel (min-width: 780px) {
  .acha-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
`;

/*
 * Registered custom properties (@property is ignored inside shadow roots, so this is done in JS):
 * - --acha-accent as <color> so `transition: --acha-accent 600ms` really interpolates every accent gradient;
 * - --acha-drag / --acha-index non-inheriting, so swipe updates on .acha-track don't restyle the whole subtree.
 */
function _styles_registerProps() {
  if (typeof CSS === 'undefined' || typeof CSS.registerProperty !== 'function') return;
  const defs = [
    { name: '--acha-accent', syntax: '<color>', inherits: true, initialValue: '#3fa9f5' },
    { name: '--acha-drag', syntax: '<length>', inherits: false, initialValue: '0px' },
    { name: '--acha-index', syntax: '<number>', inherits: false, initialValue: '0' },
  ];
  for (const d of defs) {
    try {
      CSS.registerProperty(d);
    } catch (e) {
      /* already registered (second bundle copy) or unsupported */
    }
  }
}
_styles_registerProps();

export const ACHA_CARD_CSS = _styles_TOKENS + _styles_CARD_BASE + _styles_CARD_SWITCHER + _styles_KEYFRAMES + _styles_REDUCED_MOTION;

export const ACHA_PANEL_CSS = _styles_PANEL_BASE + _styles_PANEL_HERO + _styles_PANEL_TILES + _styles_PANEL_RESPONSIVE + _styles_KEYFRAMES + _styles_REDUCED_MOTION;
