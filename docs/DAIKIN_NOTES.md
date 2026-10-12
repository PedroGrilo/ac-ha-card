# Daikin integrations: research notes for ACHA

Verified on 2026-10-12 against the source code, not the docs:
- HA core `daikin` (`home-assistant/core@dev`, uses `pydaikin==2.20.0`)
- `daikin_onecta` v5.0.1 (`jwillemsen/daikin_onecta@master`, needs HA >= 2026.10.0). Its syrupy test snapshots give real state dumps.
- Faikout (formerly Faikin, ESP32 MQTT discovery; the repo moved to codeberg.org/RevK/ESP32-Faikout)
- ESPHome `daikin` IR

Rule for the card: **always send back the exact raw string from the `*_modes` list.** HA checks it case-sensitively (`_valid_mode_or_raise` raises `ServiceValidationError`). Normalise only for labels and icons.

## 1. HA climate API (current)

### ClimateEntityFeature bits
| Bit | Name | Gates attributes/services |
|---|---|---|
| 1 | TARGET_TEMPERATURE | `temperature`; `set_temperature{temperature}` |
| 2 | TARGET_TEMPERATURE_RANGE | `target_temp_low/high` |
| 4 | TARGET_HUMIDITY | `humidity`, `min/max_humidity` |
| 8 | FAN_MODE | `fan_mode`, `fan_modes`; `set_fan_mode` |
| 16 | PRESET_MODE | `preset_mode`, `preset_modes`; `set_preset_mode` |
| 32 | SWING_MODE | `swing_mode`, `swing_modes`; `set_swing_mode` |
| 64 | (unused, old AUX_HEAT, removed) | – |
| 128 | TURN_OFF | `climate.turn_off` |
| 256 | TURN_ON | `climate.turn_on` |
| 512 | SWING_HORIZONTAL_MODE | `swing_horizontal_mode(s)`; `set_swing_horizontal_mode{swing_horizontal_mode}` |

- The mode/fan/swing/preset attributes are present **only when their bit is set**. `hvac_modes`, `min_temp`, `max_temp` are always present. `target_temp_step` only appears when it is not None.
- `hvac_action` is present **only when it is truthy**. A missing attribute means the integration does not report it.
- `current_humidity` only appears when it is not None.
- Services: `turn_on` needs bit 256, `turn_off` needs bit 128, `toggle` needs 128 **and** 256 (`services.py`). `set_temperature` with `temperature` but without bit 1 raises an error. Out-of-range values raise `temp_out_of_range`. `set_temperature` also accepts `hvac_mode`.
- When an integration does not override them, the base `turn_on` falls back to `set_hvac_mode` (first of heat_cool/heat/cool, or the only non-off mode) and `turn_off` falls back to `set_hvac_mode: off`. Both Daikin integrations override them.
- Defaults: min 7, max 35 (°C).
- `HVACAction` values: `cooling, defrosting, drying, fan, heating, idle, off, preheating`.
- Constants: `SWING_ON/OFF/BOTH/VERTICAL/HORIZONTAL` = `on/off/both/vertical/horizontal`; `SWING_HORIZONTAL_ON/OFF` = `on/off`.
- Presets: `none, eco, away, boost, comfort, home, sleep, activity`.
- Fans: `on, off, auto, low, medium, high, top, middle, focus, diffuse`. ESPHome adds `quiet`.

### Frontend registry (best detection source)
- `hass.entities[eid]` = `{entity_id, name, icon, device_id, area_id, labels, hidden, entity_category, translation_key, platform, display_precision, has_entity_name}`. **`platform`** is the integration domain.
- `hass.devices[device_id]` = `{manufacturer, model, model_id, name, name_by_user, identifiers, ...}`.
- Sibling entities: filter `Object.values(hass.entities)` by the same `device_id`. Onecta splits entities across sub-devices (see 3.2), so also match on the entity_id prefix.

## 2. HA core `daikin` (local API, BRP069/BRP072C/BRP084/AirBase/SkyFi)

`platform: 'daikin'`. Device manufacturer is `"Daikin"`, model comes from the unit. Polls every 120 s. Platforms: climate, sensor, switch.

### 2.1 Climate attributes (raw values)
| Attribute | Value |
|---|---|
| `hvac_modes` | **Always** `['fan_only','dry','cool','heat','heat_cool','off']`, in that order, for every model. Unknown device modes (`auto-1`, `auto-7`) show as `heat_cool`. |
| `fan_modes` | `pydaikin.fan_rate` = Title-cased values: **BRP069/072C**: `['Auto','Silence','1','2','3','4','5']`. **BRP084** (fw 2.8): `['Auto','Quiet','1','2','3','4','5']`. **AirBase**: `['Auto','Low','Mid','High','Low/Auto','Mid/Auto','High/Auto']`. If `en_frate_auto=0`: `['Low','Mid','High']`. If `frate_steps=2`: `['Low','High']` or (auto) `['Auto','Mid','High','Mid/Auto']`. **SkyFi**: `['Low','Medium','High','Low/Auto','Medium/Auto','High/Auto']`. |
| `fan_mode` | Title-case, e.g. `'Auto'`, `'Silence'`, `'3'`. |
| `swing_modes` | BRP069/072C/084: `['Off','Vertical','Horizontal','3D']`. AirBase/SkyFi: none (no bit 32). |
| `swing_horizontal_modes` | **Never** (one combined swing list; `3D` = both). |
| `preset_modes` | `['none']` + `'away'` (if `en_hol` present) + `'eco','boost'` (if `adv` present). Typical list: `['none','away','eco','boost']`. BRP084/AirBase/SkyFi: no away/adv. |
| `preset_mode` | `away` > `boost` (adv has `powerful`) > `eco` (adv has `econo`) > `none` |
| `target_temp_step` | `1` (values are rounded to 0.5 when sent) |
| `min_temp` / `max_temp` | HA defaults, 7 / 35 |
| `current_humidity`, `humidity` | not on climate (use sensors) |
| `hvac_action` | `heat`→`heating`, `cool`→`cooling`, `off`→`off`. `idle` if the unit has `cmpfreq` and it is 0. **Missing** in `dry`/`fan_only`/`heat_cool`. |
| `supported_features` | base `1\|128\|256` = **385**. +16 preset (away or adv), +8 fan (`f_rate`; AirBase needs `en_frate!=0`), +32 swing (`f_dir`). Typical BRP069: **441**. No range, no 512. |

- Turn on/off: `turn_on` sends power on with the last mode. `turn_off` sends `mode: off`.
- Zone climates (AirBase with `lztemp_h/c`): `climate.<dev>_<zone>_temperature`. `hvac_modes = [main_mode,'off']` (or `['off']`), features 385, extra attr **`zone_id`**. Target is the system target ±2.

### 2.2 Extra entities (`has_entity_name`, `<dev>` = slug of the unit name)
| Entity | entity_id | Created when | Notes |
|---|---|---|---|
| Climate | `climate.<dev>` | always | name None, unique_id = MAC |
| Inside temp | `sensor.<dev>_inside_temperature` | always | °C |
| Outside temp | `sensor.<dev>_outside_temperature` | `otemp` present (AirBase: != '-') | °C |
| Humidity | `sensor.<dev>_humidity` | humidity sensor present | % |
| Target humidity | `sensor.<dev>_target_humidity` | same | % |
| Power | `sensor.<dev>_compressor_estimated_power_consumption` | energy support | kW, measurement |
| Energy today | `sensor.<dev>_energy_consumption_today` | energy support | kWh, total_increasing |
| Cool energy (last hour) | `sensor.<dev>_cool_energy_consumption_last_hour` | energy support | kWh, **disabled by default** |
| Heat energy (last hour) | `sensor.<dev>_heat_energy_consumption_last_hour` | energy support | kWh, **disabled by default** |
| Compressor energy today | `sensor.<dev>_compressor_energy_consumption_today` | energy support | kWh, **disabled by default** |
| Compressor freq | `sensor.<dev>_compressor_frequency` | `cmpfreq` present | Hz, **disabled by default** |
| Power switch | `switch.<dev>_power` | always | mirrors climate on/off |
| Streamer | `switch.<dev>_streamer` | `adv` present (assumed) | on/off |
| Zones | `switch.<dev>_<zone_name>` | AirBase zones | unique `<mac>-zone<N>` |

## 3. `daikin_onecta` (cloud, custom integration via HACS)

`platform: 'daikin_onecta'`. The climate entity hangs off the gateway device (manufacturer `"Daikin"`, `model_id` = device model). The climate registry `translation_key` is **`roomtemperature`** (Altherma: `leavingwateroffset`, `leavingwatertemperature`). There is **one climate per setpoint**.

### 3.1 Climate attributes (raw values, taken from the test snapshots)
| Attribute | Value |
|---|---|
| entity_id | `climate.<dev>_room_temperature` (Altherma: also `climate.<dev>_leaving_water_offset`, `climate.<dev>_leaving_water_temperature`) |
| `hvac_modes` | Always starts with `'off'`, then device order mapped. Seen: `['off','fan_only','heat','cool','heat_cool','dry']`, `['off','heat_cool','dry','cool','heat','fan_only']`, `['off','fan_only','cool','dry']`, Altherma `['off','heat','cool','heat_cool']`. Maps: `fanOnly`→fan_only, `cooling`→cool, `heating/heatingDay/heatingNight`→heat, `auto`→heat_cool, `dry/humidification`→dry. |
| `fan_modes` | lowercase API values; `fixed` expands to its numeric range: `['auto','quiet','1','2','3','4','5']`, `['quiet','auto','1'..'5']`, `['auto','1','2','3','4','5']`, SkyAir `['auto','1','2','3']`. With the HomeKit alias option, `'low','middle','medium','high'` are appended (low=quiet, middle=2, medium=3, high=5). |
| `fan_mode` | `'auto'`, `'quiet'`, or the fixed value as a string (`'3'`). It is **None/missing in modes without fan control** (e.g. dry). |
| `swing_modes` (vertical) | lowercased: `['stop','swing']`, `['stop','swing','windnice']`, `['stop','swing','floorheatingairflow']`, `['swing','fixed']`. An unknown value is sent as `stop`. |
| `swing_horizontal_modes` | `['stop','swing']` when the unit has a horizontal axis (bit 512) |
| `preset_modes` | `['none']` + those available out of `boost, away, comfort, eco`, **sorted alphabetically**. So `'none'` usually comes last: `['away','boost','eco','none']`, `['away','boost','none']`, `['away','none']`. Mapping: away=`holidayMode` (sets 60 days from today), boost=`powerfulMode`, comfort=`comfortMode`, eco=`econoMode`. Only one is active at a time. |
| `target_temp_step` | from the API, typically `0.5` (Altherma LWT `1`). **Missing when the setpoint is read-only** (e.g. dry mode). |
| `min_temp` / `max_temp` | per mode from the API (e.g. 10/30, 10/31, 16/32, 18/33, offsets -10/10). Falls back to 7/35. |
| `hvac_action` | **never reported** |
| `current_humidity` | not on the climate entity (use the `room_humidity` sensor) |
| `supported_features` | **Dynamic, changes with hvac mode.** Base 384 (TURN_OFF\|TURN_ON). +1 if the setpoint is settable, +16 if more than one preset, +8 fan, +32 vertical, +512 horizontal. Seen: **953** (full), 441 (no H-swing), 409 (SkyAir, no swing), 432/400 (dry mode, no temp/fan). |

- Turn on/off: `turn_on`/`turn_off` toggle `onOffMode` only (they keep the operation mode). `set_hvac_mode` sets power and mode.
- `set_preset_mode` turns off the current preset first. `boost` while the unit is off turns it on first.
- The Daikin cloud enforces a daily request limit (remaining quota: `sensor.<dev>_gateway_ratelimit_remaining_day`; current limits are listed under System Health). Debounce writes. The integration writes optimistically and ignores refreshes for N seconds after a command.

### 3.2 Extra entities
Most of them sit on sub-devices named `"<dev> <ManagementPointType>"`, so the slug is `<dev>_climatecontrol_…`, `<dev>_outdoorunit_…`, `<dev>_indoorunit_…`, `<dev>_gateway_…`. They are generated dynamically from whatever the API exposes.

| Entity | entity_id pattern | Notes |
|---|---|---|
| Room temp | `sensor.<dev>_climatecontrol_room_temperature` | °C |
| Outdoor temp | `sensor.<dev>_climatecontrol_outdoor_temperature` | °C (sits on climateControl, not outdoorunit) |
| Room humidity | `sensor.<dev>_climatecontrol_room_humidity` | % |
| Streamer | `switch.<dev>_climatecontrol_streamer_mode` | any settable on/off characteristic becomes a switch |
| Econo | `switch.<dev>_climatecontrol_econo_mode` | duplicates preset `eco` |
| Powerful | `binary_sensor.<dev>_climatecontrol_is_powerful_mode_active` | read-only (no switch; use preset `boost`) |
| Holiday | `binary_sensor.<dev>_climatecontrol_is_holiday_mode_active` | diagnostic |
| Schedule | `select.<dev>_climatecontrol_schedule` | options e.g. `['0','1','2','off']` or schedule names + `off` |
| Energy (AC) | `sensor.<dev>_climatecontrol_{cooling\|heating}_{daily\|weekly\|monthly\|yearly}_electrical_consumption` | kWh. "daily" = today's value |
| Energy (outdoor unit, some models) | `sensor.<dev>_outdoorunit_current_power_consumption` (W), `…_current_thermal_output`, `…_{heating\|cooling}_{monthly\|yearly}_{electrical_consumption\|thermal_output}` | – |
| Other sensoryData | `sensor.<dev>_<mp>_heat_exchanger_temperature`, `_suction_temperature`, `_fan_motor_rotation_speed` (rpm), `_deltad`, `_leaving_water_temperature`, `_pm1/pm2_5/pm10_concentration` | only if the API exposes them |
| Errors | `binary_sensor.<dev>_{climatecontrol\|outdoorunit\|gateway}_is_in_{error\|warning\|caution}_state`, `sensor.<dev>_<mp>_error_code` | diagnostic |
| Air purifier | `fan.<dev>_climatecontrol` | purifier models only |
| Refresh | `button.<dev>_refresh` | forces a cloud poll |
| Rate limit | `sensor.<dev>_gateway_ratelimit_remaining_day` | – |
| Altherma DHW | `water_heater.*` | out of scope |

**There is no compressor frequency** in Onecta: the cloud API does not expose it.

## 4. Other Daikin paths (generic profile, but known values)
| | Faikout/Faikin (ESP32, MQTT discovery) | ESPHome `daikin` IR (`climate_ir`) |
|---|---|---|
| `platform` | `mqtt`. Device manufacturer **`"RevK"`**, model = Daikin model | `esphome` |
| `hvac_modes` | `['heat_cool','off','cool','heat','dry','fan_only']` (`heat_cool` omitted if `noauto`) | per config: off, cool, heat, dry, fan_only, heat_cool |
| `fan_modes` | 5-level: `['auto','night','low','lowMedium','medium','mediumHigh','high']`. 3-level: `['auto','quiet','low','medium','high']` | `['quiet','auto','low','medium','high']` |
| `swing_modes` | `SWING_OFF` + (`SWING_HORIZONTAL`,`SWING_VERTICAL`,`SWING_BOTH` if both axes, else `SWING_ON`) + `SWING_COMFORT` | `['off','vertical','horizontal','both']` |
| `preset_modes` | `['none', 'eco'?, 'boost'?, 'home']` (MQTT puts `none` first) | `eco, boost, comfort, sleep, activity, none` |
| `hvac_action` | yes: `off, preheating, heating, cooling, drying, fan, idle, defrosting` | no |
| extras | `sensor.<dev>_outside`, `_inlet`, `_liquid`, `_humidity`, `_compressor` (Hz/rpm), `_fan`, `_power_consumption` (W), `_lifetime_{outside\|heating\|cooling}_energy`; `switch.<dev>_{power,streamer,powerful,econo_mode,comfort_mode,quiet_outdoor,sensor_mode,led}` (only with `haswitches`) | – |

## 5. Auto-detection (`profile: auto`)
Check in this order. The first match wins.

1. **Registry** (reliable). `const reg = hass.entities?.[eid]`:
   - `reg.platform === 'daikin_onecta'` → `daikin_onecta`
   - `reg.platform === 'daikin'` → `daikin` (local)
   - `reg.platform === 'mqtt'` and `hass.devices[reg.device_id]?.manufacturer === 'RevK'` → `faikin` (or `generic` with the Faikin label map)
   - `hass.devices[reg.device_id]?.manufacturer` matches `/daikin/i` (any other platform) → `daikin` labels, generic behaviour
2. **Attributes** (fallback when there is no registry entry, e.g. in the demo or for YAML entities):
   - **Onecta** if any of these hold: `swing_modes`/`swing_horizontal_modes` contain `stop`, `windnice` or `floorheatingairflow`; or the entity_id ends in `_room_temperature`/`_leaving_water_offset`/`_leaving_water_temperature` **and** `hvac_modes[0]==='off'`; or `preset_modes` is sorted with `'none'` last and `fan_modes` are all lowercase with `quiet` or digits.
   - **Daikin local** if any of these hold (case-sensitive): `fan_modes` contains `Silence`, or Title-case `Auto`, `Quiet`, `Low/Auto` or `Mid`; or `swing_modes` contains `3D`/`Off`; or `hvac_modes` equals `['fan_only','dry','cool','heat','heat_cool','off']` exactly, with `target_temp_step===1`; or the `zone_id` attribute is present (zone climate).
   - **Faikin** if `swing_modes` contains a value starting with `SWING_`, or `fan_modes` contains `lowMedium` or `night`.
   - otherwise **generic**.
3. Feature gating always uses `supported_features` live, on every update. **Do not cache it**: Onecta changes the bits with the mode.

## 6. Normalisation for labels and icons (`normKey` = lowercase, strip `/ _ -` and spaces)
| Kind | Raw values → canonical |
|---|---|
| fan | `auto`→auto. `silence`,`quiet`,`night`→quiet. `1..5`→level n/5. `low`→1, `lowmedium`→2, `mid`/`medium`/`middle`→3, `mediumhigh`→4, `high`→5 (for a 3-step list, map low/mid/high to 1/3/5). `lowauto`/`midauto`/`mediumauto`/`highauto`→level + auto badge. |
| swing (V) | `off`,`stop`,`fixed`,`swingoff`→off. `vertical`,`swing`,`on`,`swingon`,`swingvertical`→vertical (Onecta `swing` on the vertical list = vertical). `horizontal`,`swinghorizontal`→horizontal. `3d`,`both`,`swingboth`→both (animate V+H). `windnice`,`swingcomfort`→comfort airflow. `floorheatingairflow`→floor airflow. |
| swing (H) | `stop`/`off`→off. `swing`/`on`→horizontal. |
| preset | `none`, `away` (Daikin label "Holiday"), `eco` ("Econo"), `boost` ("Powerful"), `comfort` ("Comfort airflow"), `home` (Faikin: no preset), `sleep`, `activity`. |
| hvac | `heat_cool` = Daikin "Auto". `fan_only` = "Fan". `dry` = "Dry". |

UI implications:
- Local Daikin: show 3D as "both". There is no separate horizontal tile. `hvac_action` is missing in auto/dry/fan, so fall back to the mode colour.
- Onecta: hide the temperature dial when bit 1 is missing (dry mode). Hide the fan tile when `fan_mode` is null. Never expect `hvac_action`. Put `none` first in the preset list for display only.
- Turn on/off: use `climate.turn_on/off` when bits 256/128 are set (both Daikin integrations set them). Otherwise use `set_hvac_mode`.
- Streamer chip: local `switch.<dev>_streamer`; Onecta `switch.<dev>_climatecontrol_streamer_mode`; Faikin `switch.<dev>_streamer`.
- Outside temp: local `sensor.<dev>_outside_temperature`; Onecta `sensor.<dev>_climatecontrol_outdoor_temperature`; Faikin `sensor.<dev>_outside`.

## 7. Sources
- https://github.com/home-assistant/core/tree/dev/homeassistant/components/daikin (climate.py, switch.py, sensor.py, const.py, strings.json, manifest.json)
- https://github.com/fredrike/pydaikin (daikin_base.py, daikin_brp069.py, daikin_brp084.py, daikin_airbase.py, daikin_skyfi.py; v2.20.0 = master for TRANSLATIONS)
- https://github.com/home-assistant/core/tree/dev/homeassistant/components/climate (const.py, __init__.py, services.py, services.yaml); mqtt/climate.py; esphome/climate.py
- https://github.com/jwillemsen/daikin_onecta (custom_components/daikin_onecta/*, tests/__snapshots__/test_init/*.ambr, hacs.json)
- https://codeberg.org/RevK/ESP32-Faikout (ESP/main/Faikout.c, send_ha_config)
- https://github.com/esphome/esphome/blob/dev/esphome/components/daikin/daikin.h
- https://github.com/home-assistant/frontend (src/data/entity/entity_registry.ts, device_registry.ts)
