# ACHA Card — architecture contract

Custom Lovelace card for Home Assistant to control air conditioners (Daikin-first, any `climate` entity works).
Look & feel inspired by the Daikin Onecta app (big circular dial, mode colours, bottom-sheet pickers) plus a
dark-glass "control centre" panel with an animated indoor-unit illustration.

Element: `custom:acha-card`. Vanilla Web Components + Shadow DOM. **No external deps, no Lit, no CDN.**
Icons: use HA's global `<ha-icon icon="mdi:...">` (works inside shadow roots). In the demo it is polyfilled.

## Files (ES modules, relative imports, all in `src/`)

| File | Exports | Role |
|---|---|---|
| `utils.js` | `fireEvent, debounce, clamp, roundToStep, prettify, normKey, stateObj, callClimate, isOn, numAttr, formatTemp, lerpColor` | helpers |
| `i18n.js` | `ACHA_STRINGS, resolveLang(hass, pref), t(lang, key, vars?)` | PT + EN strings. `resolveLang` → `'pt'\|'en'` from config `language` or `hass.locale.language \|\| hass.language`; `t` keys are dot paths (`mode.cool`), `{n}` interpolation, fallback en → key |
| `profiles.js` | `ACHA_PROFILES, resolveProfile(entryConfig, stateObj), describeOption(kind, value, profile, lang), fanIntensity(value, fanModes, profile)` | brand profiles + label/icon/colour mapping |
| `styles.js` | `ACHA_CARD_CSS, ACHA_PANEL_CSS` | CSS strings (theme tokens, animations) |
| `dial.js` | class `AchaDial` → `acha-dial` | circular setpoint dial |
| `unit.js` | class `AchaUnit` → `acha-unit` | SVG indoor unit + airflow animation |
| `sheet.js` | class `AchaSheet` → `acha-sheet` | animated bottom-sheet option picker |
| `panel.js` | class `AchaPanel` → `acha-panel` | one AC's full control UI |
| `editor.js` | class `AchaCardEditor` → `acha-card-editor` | visual editor (ha-form) |
| `acha-card.js` | class `AchaCard` → `acha-card` | entry: config, multi-AC switcher, registration |

### Bundling rules (a dependency-free bundler concatenates files — MUST follow)
- Only named exports: `export const`, `export function`, `export class`. **No** `export default`, no `export { a as b }`, no `import * as`, no re-exports, no dynamic import.
- Imports only of the form `import { a, b } from './file.js';` on a single line.
- Every top-level identifier must be unique across ALL files → prefix private top-level helpers with the file name (e.g. `_dial_angleFor`, `UNIT_PATHS`).
- `customElements.define` guarded: `if (!customElements.get('acha-dial')) customElements.define('acha-dial', AchaDial);`
- Bundle order: utils, i18n, profiles, styles, dial, unit, sheet, panel, editor, acha-card → `dist/acha-card.js`.

## Data flow
- `AchaCard.setConfig(config)` validates & normalises; `set hass(h)` forwards to each `acha-panel` (`panel.hass = h`).
- Components are **built once and patched** on update (never `innerHTML` the whole tree on each hass update — it kills animations).
- `AchaPanel` props: `hass`, `config` (one normalised AC entry + card-level options merged), `active` (bool).
- Children receive plain props (no hass): `AchaDial`: `value, min, max, step, mode, color, disabled, current, low, high, dual`;
  emits `acha-change` `{detail:{value}}` on release (and `acha-input` while dragging); with `dual` emits `{detail:{low,high}}`.
  `AchaUnit`: `mode, on, fan (0..1 intensity), swingV (bool), swingH (bool), color, special ('boost'|'eco'|'streamer'|null)`.
  `AchaSheet`: `open(title, options:[{value,label,icon,color?}], selected)` → `Promise<value|null>`; closes on backdrop/Esc.

## Service calls (HA climate)
- power: `climate.turn_off` / `climate.turn_on` (fallback: `set_hvac_mode` to last non-off mode stored in `attributes`/memory).
- mode: `climate.set_hvac_mode {hvac_mode}`; fan: `set_fan_mode {fan_mode}`; vertical swing: `set_swing_mode {swing_mode}`;
  horizontal swing (HA ≥2024.12, attr `swing_horizontal_modes`): `set_swing_horizontal_mode {swing_horizontal_mode}`;
  preset: `set_preset_mode {preset_mode}`; target: `set_temperature {temperature}` or `{target_temp_low,target_temp_high}`
  when `supported_features & 2` (TARGET_TEMPERATURE_RANGE) and mode is `heat_cool` with low/high attrs present.
- Setpoint changes are optimistic + debounced (700 ms); +/- buttons step by `target_temp_step || profile.step || 0.5`.
- Extra entities (switch/input_boolean/select/fan/button) → `homeassistant.toggle`, `select.select_option`, `button.press`.

## Config (YAML)
```yaml
type: custom:acha-card
profile: daikin            # daikin | daikin_onecta | generic | auto (default auto: detect by attributes)
theme: auto                # auto | dark | light
layout: tabs               # tabs (one card, AC switcher pills) | stack (all panels stacked) | grid (side by side)
show_unit: true            # animated indoor unit
language: auto             # auto | pt | en
entities:
  - entity: climate.ac_sala
    name: Sala
    icon: mdi:sofa
    indoor_temperature: sensor.ac_sala_inside_temperature     # optional, else current_temperature attr
    outdoor_temperature: sensor.ac_sala_outside_temperature   # optional
    humidity: sensor.ac_sala_humidity                         # optional
    power: sensor.ac_sala_power                               # optional (W) or energy today (kWh)
    extras:                                                   # optional extra tiles
      - entity: switch.ac_sala_streamer
        name: Streamer
        icon: mdi:shimmer
    hide: [swing_horizontal]                                  # optional: modes|fan|swing|swing_horizontal|preset|power_btn
    min_temp: 18
    max_temp: 30
    step: 0.5
    labels:                                                   # optional overrides, keyed by raw value
      fan_mode: { Silence: Noite }
    colors: { cool: '#3fa9f5' }
```

## Visual language
- Mode palette: cool `#3fa9f5`, heat `#ff8a3d`, heat_cool/auto `#9b7cff`, dry `#2ec4b6`, fan_only `#9aa5b1`, off `#6b7280`.
- Accent colour of the active panel animates (CSS custom property `--acha-accent`, transition 600ms).
- Dark glass default: background `rgba(16,18,24,.82)` + `backdrop-filter: blur(24px)`, radius 28px, soft border.
- Light theme: frosted white like Onecta. `theme: auto` follows `hass.themes.darkMode`.
- Typography: `var(--ha-font-family-body, var(--paper-font-body1_-_font-family, system-ui))`; big setpoint 64px weight 300.
- Motion: respect `prefers-reduced-motion`. Number tween on setpoint change; ripples on tiles; sheet slides up with spring easing.

## Panel layout (top → bottom)
1. Header: icon + name, status line ("A arrefecer · 23 °C dentro · 15 °C fora"), power button (glows in accent when on).
2. Hero: `acha-unit` (if `show_unit`) above `acha-dial`; dial centre shows mode label, big setpoint, current temp.
3. − / + round buttons flanking a compact slider-free row (dial is the main control).
4. Tile grid (2–4 cols responsive): Mode, Fan speed, Swing (vertical), Swing (horizontal, if supported), Preset/Special (Eco/Powerful), extras.
   Tapping a tile opens `acha-sheet`. Boolean-like presets (eco/boost) can be toggled directly.
5. Footer: connection status (entity `unavailable` → "Desligado da rede"), optional power usage.

## Theme tokens (set by `acha-card` host via `[data-theme=dark|light]`; inherit into child shadow roots)
`--acha-bg, --acha-surface, --acha-surface-strong, --acha-border, --acha-text, --acha-muted, --acha-track,
--acha-shadow, --acha-radius (28px), --acha-accent (per panel, set on acha-panel host), --acha-accent-soft`.
Children only *consume* tokens (with sensible fallbacks), never define theme colours themselves.

## Overlay rule
`backdrop-filter` ancestors break `position: fixed`, so `acha-sheet` is `position:absolute; inset:0` inside the
panel (panel host is `position:relative; overflow:hidden`). The sheet slides up from the panel bottom.

## describeOption result
`{ value, label, icon, color|null, level|null }` — `kind` ∈ `hvac_mode | fan_mode | swing_mode | swing_horizontal_mode | preset_mode`.
Matching is case/space/underscore-insensitive (`normKey`). Unknown values → `prettify(value)` + generic icon.
User overrides: `entry.labels[kind][rawValue]`, `entry.icons[kind][rawValue]`, `entry.colors[hvacMode]` (merged in `resolveProfile`).
