# Per-file specs (read with docs/ARCHITECTURE.md)

Quality bar: this must look like a premium native app (Daikin Onecta / Apple Home level). Smooth 60fps CSS
animations, no layout jank, no full re-renders on hass updates. Portuguese (pt) is the user's language.

## utils.js
`fireEvent(node,type,detail)` (bubbles+composed), `debounce(fn,ms)` (with `.cancel()` and `.flush()`),
`clamp`, `roundToStep(v,step)`, `prettify('fan_only')→'Fan only'`, `normKey(v)` (lowercase, strip space/_/-),
`stateObj(hass,id)`, `callClimate(hass,service,entityId,data)`, `isOn(st)` (not off/unavailable/unknown),
`numAttr(st,name)`, `formatTemp(v,step)` → `{int:'22', dec:'.5'|'' , text:'22.5'}`, `lerpColor(a,b,t)` hex,
`hexToRgb(hex)` → `'r, g, b'`. Plus `SUPPORT` const with climate feature bits:
TARGET_TEMPERATURE 1, TARGET_TEMPERATURE_RANGE 2, TARGET_HUMIDITY 4, FAN_MODE 8, PRESET_MODE 16, SWING_MODE 32,
TURN_OFF 128, TURN_ON 256, SWING_HORIZONTAL_MODE 512. `supports(st,bit)`.

## i18n.js
PT (pt-PT wording, Daikin terms: Arrefecer, Aquecer, Automático, Desumidificar, Ventilar, Desligado; fan: Automático,
Silencioso, Nível 1..5; swing: Fixo, Vertical, Horizontal, 3D; presets: Nenhum, Econo, Potente, Ausente, Conforto,
Noite) + EN. Keys: `mode.*`, `action.*` (cooling, heating, drying, fan, idle, off, preheating, defrosting),
`fan.*`, `swing.*`, `preset.*`, `ui.*` (mode, fan_speed, swing, swing_horizontal, preset, inside, outside, humidity,
power, energy, connected, unavailable, target, turn_on, turn_off, all_off, n_on '{n} ligados', all_off_state
'tudo desligado', range, low, high, select, close, extras, eco, boost, streamer...). Editor labels `editor.*`.

## profiles.js
`ACHA_PROFILES = { generic, daikin, daikin_onecta }`. Each: `{ id, name, step, colors:{cool,heat,heat_cool,auto,dry,fan_only,off},
modeOrder:[...], options:{ hvac_mode:{normKey:{key,icon,color}}, fan_mode:{normKey:{key,icon,level}}, swing_mode:{...},
swing_horizontal_mode:{...}, preset_mode:{...} }, toggles: [preset values that behave as on/off chips e.g. eco, boost] }`.
Daikin specifics come from research in docs/DAIKIN_NOTES.md (fan 'Auto','Silence','1'..'5'; swing 'Off','Vertical',
'Horizontal','3D'; presets none/eco/boost/away). Detection for `profile: auto`: Onecta vs local Daikin vs generic by
attribute fingerprints documented in DAIKIN_NOTES.md. `resolveProfile` merges user `labels/icons/colors/min_temp/max_temp/step`.
`fanIntensity` → 0..1 (auto≈0.6, quiet≈0.25, levels spread 0.3..1). Every option has an mdi icon.

## styles.js
`ACHA_CARD_CSS` (card host, theme token definitions for dark+light, header with title + summary chip + "all off"
button, AC switcher pills with colour dot/status/current temp and sliding active indicator, panel track with slide
transition between ACs, stack/grid layouts) and `ACHA_PANEL_CSS` (panel: header, power button with glow ring,
hero, ± buttons, status chips (inside/outside/humidity), tile grid (icon bubble tinted with accent when active,
label + value, chevron, pressed scale .96, ripple), footer). Ambient background: soft radial accent glow that
breathes when on. Keyframes: acha-pulse, acha-breathe, acha-ripple, acha-fade-up. `@media (prefers-reduced-motion)`.
Container queries (`container-type:inline-size`) for narrow (<360px) vs wide layouts.

## dial.js — `acha-dial`
SVG 270° arc (gap at bottom). Layers: tick ring (60 ticks, active ticks lit in accent), track, progress arc
(gradient accent→lighter, glow filter), current-temperature marker (small dot on track), thumb (white knob
with accent ring + shadow, scales on grab). Centre (HTML overlay): `label` (mode), big setpoint (int large +
decimal/unit small) with count-up tween (requestAnimationFrame, 400ms ease-out), `sublabel` (e.g. 🌡 23 °C).
Drag: pointer events on an invisible thick ring path only (`touch-action:none` only there so page scroll still works),
pointer capture, snapping to step, haptic `navigator.vibrate?.(5)` per step. Keyboard: arrows/PageUp/Down, role=slider,
aria-*. `disabled`/off: desaturated, thumb hidden, centre shows label only + setpoint dimmed. `dual`: two thumbs
(low/high) with min gap = step. Events `acha-input` (while dragging) and `acha-change` (release). Properties with
setters → `_render()` patch only. Size: responsive (width 100%, max 320px, aspect 1).

## unit.js — `acha-unit`
Beautiful SVG wall-mounted split unit (rounded body with subtle gradient, top intake grille lines, small status
LED in accent, brand-less). Louver flap rotates open (0°→~38°) when on, closed when off (CSS transition 800ms).
Airflow below the unit (height ~110px): 7–9 curved stream paths with animated stroke-dashoffset flowing outward,
opacity/speed from `fan` (0..1) via CSS vars `--acha-flow-speed`, `--acha-flow-opacity`. Mode particles: cool →
tiny snow/ice sparkles drifting down; heat → warm wavy shimmer lines rising & orange tint; dry → droplets;
fan_only → neutral swirl streams; heat_cool/auto → blend. `swingV` → flap + streams oscillate (rotate) slowly;
`swingH` → streams sway left/right (skewX). `special`: boost → faster & brighter + small "power" glint; eco → gentle,
leaf badge; streamer → faint blue ion dots. Off → everything fades out gracefully. Only patch classes/vars on update.

## sheet.js — `acha-sheet`
`open(title, options, selected, {layout:'grid'|'list'})` → Promise. Absolute overlay (see Overlay rule) with backdrop
fade + blur, sheet slides up with spring (cubic-bezier(.2,.9,.25,1.15)), grab handle, title, options as large chips
(icon bubble + label, selected = accent filled + check), staggered fade-in of options, closes with slide-down,
Esc/backdrop/close button → resolves null. Focus management & aria-modal.

## panel.js — `acha-panel`
Builds its shadow DOM once (`ACHA_PANEL_CSS`), contains `acha-unit`, `acha-dial`, `acha-sheet`, tiles. On `hass` set:
compute view-model from the climate state (+ optional sensors) and patch. Behaviour:
- Accent = profile colour of current hvac_mode (off → off colour); set `--acha-accent` + `--acha-accent-soft` on host.
- Header: entry icon/name; status line from `hvac_action` (via i18n `action.*`) or mode; power button
  (TURN_ON/TURN_OFF support → turn_on/turn_off, else set_hvac_mode to remembered last mode / first non-off mode).
- Dial: min/max/step from entry overrides → attributes → profile; `heat_cool` + range support → dual.
  Optimistic local value while dragging/debouncing; ignore incoming hass target updates for 2.5s after a user change
  unless they match. ± buttons with press-and-hold auto-repeat.
- Chips row: inside temp (sensor or current_temperature), outside temp (sensor), humidity (sensor or current_humidity),
  power/energy (sensor, unit from attributes). Hidden when missing.
- Tiles: Mode (hvac_modes ordered by profile.modeOrder), Fan (fan_modes), Swing (swing_modes), Horizontal swing
  (swing_horizontal_modes), Preset (preset_modes). Each tile hidden if list empty or in `entry.hide`. Tap → sheet.
  Profile toggles (eco/boost) also rendered as quick toggle chips (tap → preset or back to 'none').
  Extras: per entity domain → switch/input_boolean/fan/light toggle (`homeassistant.toggle`), select/input_select → sheet
  with options, button/input_button/script → press/turn_on, sensor → read-only tile. Long-press/hold on any tile →
  `hass-more-info` event for that entity.
- Unavailable entity → whole panel dimmed with "Desligado da rede" banner, controls disabled.
- Unit props: mode, on, fan intensity (profiles.fanIntensity), swingV (swing not off and not horizontal-only),
  swingH (horizontal/3d or swing_horizontal not off), special (boost/eco preset or streamer extra on).
- Everything i18n via `t(lang, ...)`. Never throw on missing attributes.

## editor.js — `acha-card-editor`
Uses `ha-form` (HA provides it) for card-level fields: title, profile (select), theme, layout, show_unit, language.
Per-AC entries list: each entry rendered as an `ha-expansion-panel` (fallback `<details>`) with its own `ha-form`
(entity climate selector, name, icon, indoor_temperature/outdoor_temperature/humidity/power sensor selectors,
min/max/step numbers, hide multi-select). Buttons: add AC, remove, move up/down. Emits `config-changed`.
Must not crash when `hass` arrives after `setConfig` or when ha-form is not yet defined (await
`customElements.whenDefined('ha-form')` with timeout fallback; trigger HA's lazy load via `window.loadCardHelpers?.()`).

## acha-card.js — `acha-card` (entry point)
`setConfig`: accept `entity` (string) or `entities` (strings or objects), throw helpful Error if none; normalise.
`set hass`: forward to panels; update header summary ("2 ligados" / "tudo desligado") and switcher pills.
Layouts: `tabs` (pills switcher + horizontal slide between panels, swipe gesture with pointer events, remembers
selected AC in localStorage try/catch), `stack`, `grid`. Header "Desligar todos" button when ≥1 on (turn_off each).
Theme: `auto` → `hass.themes?.darkMode`, else forced. `getCardSize()`, `getGridOptions()` ({columns:12, min_columns:6,
rows:'auto'}), `static getConfigElement()`, `static getStubConfig(hass)` (first 2 climate entities). Register in
`window.customCards` (`type:'acha-card', name:'ACHA Climate Card', preview:true, description`), console banner with version.
Imports dial/unit/sheet/panel/editor files so the module graph loads everything.

## Tooling (integration agent)
- `scripts/build.mjs` (no deps): concatenate in the documented order, strip the single-line relative imports and the
  `export ` keyword, fail loudly on any leftover `import`/`export`, wrap in an IIFE with a banner, write `dist/acha-card.js`.
  Also `node --check` it. Add `package.json` with `"build"` script (no dependencies).
- `demo/index.html` + `demo/mock-hass.js`: standalone preview of the card with a fake `hass` that has two Daikin-like ACs
  (Sala: cool 22, inside 23, outside 31; Quarto: off, 21) with realistic attributes, `callService` that mutates state after
  250ms and re-assigns a new hass object; `ha-icon` polyfill that renders MDI via `https://cdn.jsdelivr.net/npm/@mdi/js@7.4.47/+esm`
  (`mdi:fan-auto` → `mdiFanAuto`). Toolbar to switch theme (dark/light), layout (tabs/stack/grid), language, and
  `?dist=1` to load the bundle instead of `src/`. Photo-like blurred background like a HA dashboard.
- `hacs.json` (`{"name":"ACHA Climate Card","filename":"acha-card.js","render_readme":true}`), `README.md` in PT.
