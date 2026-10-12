# ACHA Climate Card

A Lovelace card for controlling air conditioners in Home Assistant, inspired by the **Daikin Onecta** app:
a large circular dial, per-mode colours, bottom-sheet pickers and an animated indoor unit with live airflow.
It works with any `climate` entity and ships dedicated profiles for **Daikin (local)** and **Daikin Onecta**.

**[▶ Live demo](https://pedrogrilo.github.io/ac-ha-card/demo/)**

## Preview

<img width="297" height="605" alt="image" src="https://github.com/user-attachments/assets/d6b3c6cb-bc26-4ccf-8370-faad986951e0" />
<img width="308" height="607" alt="image" src="https://github.com/user-attachments/assets/69a0b687-6c18-4ab8-9842-dd30b9479d02" />

## Features

- Several ACs in one card: pill switcher with swipe between units, or stacked / grid layouts.
- 270° dial with drag, keyboard support, animated value and range mode (`heat_cool` with low/high).
- − / + buttons with hold-to-repeat; requests are debounced (700 ms) to save the Onecta cloud quota.
- Tiles for Mode, Fan speed, Vertical/Horizontal swing and Preset, plus Econo / Powerful shortcuts.
- Extra entities (Streamer, schedules, buttons, sensors) as tiles. Long-press opens "More info".
- Dark (glass) and light (Onecta-style) themes; `auto` follows Home Assistant's dark mode.
- Portuguese (pt-PT) and English. Respects `prefers-reduced-motion`. No external dependencies.

## Installation

### HACS (custom repository)
1. HACS → ⋮ menu → **Custom repositories** → add this repository's URL, category **Dashboard**.
2. Install **ACHA Climate Card** and reload the browser.

### Manual
1. Run `npm run build` (or use the prebuilt file) and copy `dist/acha-card.js` to `/config/www/acha-card.js`.
2. In **Settings → Dashboards → ⋮ → Resources**, add `/local/acha-card.js` as a **JavaScript module**.
3. Reload the browser (Ctrl+F5).

## Configuration

The visual editor covers every option. In YAML:

```yaml
type: custom:acha-card
title: Climate               # optional
profile: auto                # auto | daikin | daikin_onecta | generic
theme: auto                  # auto | dark | light
layout: tabs                 # tabs | stack | grid
show_unit: true              # animated indoor unit
language: auto               # auto | pt | en
entities:
  - entity: climate.ac_sala
    name: Sala
    icon: mdi:sofa
    indoor_temperature: sensor.ac_sala_inside_temperature
    outdoor_temperature: sensor.ac_sala_outside_temperature
    humidity: sensor.ac_sala_humidity
    power: sensor.ac_sala_compressor_estimated_power_consumption
    extras:
      - entity: switch.ac_sala_streamer
        name: Streamer
        icon: mdi:shimmer
    hide: [swing_horizontal]
    min_temp: 18
    max_temp: 30
    step: 0.5
    labels:
      fan_mode: { Silence: Noite }
    colors: { cool: '#3fa9f5' }
  - climate.ac_quarto        # a plain entity id also works
```

You can also use `entity: climate.ac_sala` instead of `entities` when there is only one AC.

### Card options

| Option | Values | Default | Description |
|---|---|---|---|
| `title` | text | "Climatização" (with 2+ ACs) | Header title |
| `profile` | `auto`, `daikin`, `daikin_onecta`, `generic` | `auto` | Brand profile (labels, icons, mode order). `auto` detects from the entity registry and attributes |
| `theme` | `auto`, `dark`, `light` | `auto` | `auto` follows `hass.themes.darkMode` |
| `layout` | `tabs`, `stack`, `grid` | `tabs` | `tabs`: one panel at a time with pills and swipe; `stack`: all stacked; `grid`: side by side |
| `show_unit` | `true` / `false` | `true` | Show the animated indoor unit |
| `language` | `auto`, `pt`, `en` | `auto` | `auto` uses Home Assistant's language |

### Per-AC options (`entities[]`)

| Option | Description |
|---|---|
| `entity` | `climate` entity (required) |
| `name`, `icon` | Name and icon (`mdi:...`) |
| `indoor_temperature` | Indoor temperature sensor (otherwise `current_temperature`) |
| `outdoor_temperature` | Outdoor temperature sensor |
| `humidity` | Humidity sensor (otherwise `current_humidity`) |
| `power` | Power (W/kW) or energy (kWh) sensor, shown in the footer |
| `extras` | Extra entities: `switch`, `input_boolean`, `fan`, `light` (toggle), `select`/`input_select` (list), `button`/`input_button`/`script`/`scene` (press), `sensor`/`binary_sensor` (read-only) |
| `hide` | Hide controls: `modes`, `fan`, `swing`, `swing_horizontal`, `preset`, `power_btn` |
| `min_temp`, `max_temp`, `step` | Dial limits and step (otherwise from attributes and profile) |
| `labels` | Custom labels per raw value: `labels: { fan_mode: { Silence: Night } }` |
| `icons` | Custom icons per raw value: `icons: { preset_mode: { eco: mdi:leaf } }` |
| `colors` | Colours per mode: `colors: { cool: '#3fa9f5', heat: '#ff8a3d' }` |
| `profile` | Profile for this AC only |

Values are always sent to Home Assistant exactly as they appear in the entity's lists
(`fan_modes`, `swing_modes`, …). Normalisation is only used for labels and icons.

## Daikin

- **Daikin local** (`daikin` integration): fan speeds `Auto`, `Silence`, `1`–`5`; swing `Off`, `Vertical`,
  `Horizontal`, `3D`; presets `away`, `eco`, `boost`. Streamer is `switch.<ac>_streamer`.
- **Daikin Onecta** (`daikin_onecta`, HACS): lowercase values (`quiet`, `stop`, `swing`, `windnice`),
  separate horizontal swing, and features change with the mode (Dry has no temperature or fan speed; the card
  adapts). Streamer is `switch.<ac>_climatecontrol_streamer_mode`.
- The Onecta cloud has a daily request limit: the card batches temperature changes and shows the requested
  value immediately (optimistic) while waiting for confirmation.

More details in [`docs/DAIKIN_NOTES.md`](docs/DAIKIN_NOTES.md).

## Development

No dependencies, just Node ≥ 18.

```bash
npm run build     # bundles src/*.js into dist/acha-card.js (IIFE) and validates with node --check
npm run check     # same, also validating each file in src/
npm run demo      # local server at http://localhost:8765/demo/
```

The demo (`demo/index.html`) uses a mocked `hass` with two ACs (Sala: Daikin local cooling at 22 °C;
Quarto: Onecta off at 21 °C). Its toolbar switches theme, layout, language, width, unit visibility and can make
Quarto unavailable; it also shows a service-call log and the visual editor. MDI icons come from
`cdn.jsdelivr.net` (`@mdi/js`). Add `?dist=1` to the URL to test the bundled file instead of `src/`.

The live demo is deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.

Architecture and bundling rules: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/FILE_SPECS.md`](docs/FILE_SPECS.md).

## License

MIT
