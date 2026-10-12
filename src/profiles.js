// ACHA Card — brand profiles + option label/icon/colour mapping.
// Exports: ACHA_PROFILES, resolveProfile(entryConfig, stateObj, hass?), describeOption(kind, value, profile, lang),
//          fanIntensity(value, fanModes, profile).
// Bundling rules: named exports only, private top-level names prefixed `_prof_` / `PROF_`.
// Rule (docs/DAIKIN_NOTES.md): the raw value is always sent back unchanged; normalisation is only for labels/icons.

import { normKey, prettify } from './utils.js';
import { t } from './i18n.js';

const PROF_PALETTE = Object.freeze({
  cool: '#3fa9f5',
  heat: '#ff8a3d',
  heat_cool: '#9b7cff',
  auto: '#9b7cff',
  dry: '#2ec4b6',
  fan_only: '#9aa5b1',
  off: '#6b7280',
});

const PROF_KINDS = ['hvac_mode', 'fan_mode', 'swing_mode', 'swing_horizontal_mode', 'preset_mode'];

const PROF_GENERIC_ICON = Object.freeze({
  hvac_mode: 'mdi:thermostat',
  fan_mode: 'mdi:fan',
  swing_mode: 'mdi:arrow-oscillating',
  swing_horizontal_mode: 'mdi:arrow-oscillating',
  preset_mode: 'mdi:star-four-points-outline',
});

/** Matching key: normKey + strip '/' and '.' ('Low/Auto' → 'lowauto', 'Fan_Only' → 'fanonly'). */
function _prof_key(v) {
  return normKey(v).replace(/[/.]+/g, '');
}

/** Build a lookup table { normKey: def } from [[aliases...], def] pairs. */
function _prof_table(pairs) {
  const out = {};
  for (const [aliases, def] of pairs) for (const a of aliases) out[_prof_key(a)] = def;
  return Object.freeze(out);
}

const PROF_HVAC = _prof_table([
  [['off'], { key: 'mode.off', icon: 'mdi:power', color: PROF_PALETTE.off }],
  [['cool', 'cooling'], { key: 'mode.cool', icon: 'mdi:snowflake', color: PROF_PALETTE.cool }],
  [['heat', 'heating'], { key: 'mode.heat', icon: 'mdi:fire', color: PROF_PALETTE.heat }],
  [['heat_cool'], { key: 'mode.heat_cool', icon: 'mdi:sun-snowflake-variant', color: PROF_PALETTE.heat_cool }],
  [['auto'], { key: 'mode.auto', icon: 'mdi:thermostat-auto', color: PROF_PALETTE.auto }],
  [['dry'], { key: 'mode.dry', icon: 'mdi:water-percent', color: PROF_PALETTE.dry }],
  [['fan_only', 'fan'], { key: 'mode.fan_only', icon: 'mdi:fan', color: PROF_PALETTE.fan_only }],
]);

const PROF_FAN = _prof_table([
  [['auto'], { key: 'fan.auto', icon: 'mdi:fan-auto', level: null, intensity: 0.6 }],
  [['quiet', 'silence', 'silent', 'night', 'sleep'], { key: 'fan.quiet', icon: 'mdi:weather-night', level: null, intensity: 0.25 }],
  [['off'], { key: 'fan.off', icon: 'mdi:fan-off', level: null, intensity: 0 }],
  [['on'], { key: 'fan.on', icon: 'mdi:fan', level: null, intensity: 0.6 }],
  [['1', 'level_1', 'level 1'], { key: 'fan.1', icon: 'mdi:fan-speed-1', level: 1 }],
  [['2', 'level_2', 'level 2'], { key: 'fan.2', icon: 'mdi:fan-speed-1', level: 2 }],
  [['3', 'level_3', 'level 3'], { key: 'fan.3', icon: 'mdi:fan-speed-2', level: 3 }],
  [['4', 'level_4', 'level 4'], { key: 'fan.4', icon: 'mdi:fan-speed-3', level: 4 }],
  [['5', 'level_5', 'level 5'], { key: 'fan.5', icon: 'mdi:fan-speed-3', level: 5 }],
  [['low', 'lowest'], { key: 'fan.low', icon: 'mdi:fan-speed-1', level: 1 }],
  [['lowmedium', 'medium_low', 'low_medium'], { key: 'fan.medium_low', icon: 'mdi:fan-speed-1', level: 2 }],
  [['medium', 'mid', 'middle'], { key: 'fan.medium', icon: 'mdi:fan-speed-2', level: 3 }],
  [['mediumhigh', 'medium_high'], { key: 'fan.medium_high', icon: 'mdi:fan-speed-3', level: 4 }],
  [['high'], { key: 'fan.high', icon: 'mdi:fan-speed-3', level: 5 }],
  [['highest', 'max', 'top'], { key: 'fan.highest', icon: 'mdi:fan-plus', level: 5 }],
  [['turbo', 'powerful', 'boost'], { key: 'fan.turbo', icon: 'mdi:fan-plus', level: 5 }],
  [['focus'], { key: 'fan.focus', icon: 'mdi:image-filter-center-focus', level: null, intensity: 0.8 }],
  [['diffuse'], { key: 'fan.diffuse', icon: 'mdi:weather-windy', level: null, intensity: 0.45 }],
]);

// `swing`: what the animated unit should do ('off' | 'v' | 'h' | 'both').
const PROF_SWING = _prof_table([
  [['off', 'stop', 'fixed', 'swing_off', 'swingoff'], { key: 'swing.off', icon: 'mdi:minus-circle-outline', swing: 'off' }],
  [['vertical', 'swing', 'swing_vertical', 'swingvertical', 'swingon', 'swing_on'], { key: 'swing.vertical', icon: 'mdi:arrow-up-down', swing: 'v' }],
  [['on'], { key: 'swing.on', icon: 'mdi:arrow-up-down', swing: 'v' }],
  [['horizontal', 'swing_horizontal', 'swinghorizontal'], { key: 'swing.horizontal', icon: 'mdi:arrow-left-right', swing: 'h' }],
  [['3d', 'both', 'swing_both', 'swingboth'], { key: 'swing.3d', icon: 'mdi:arrow-all', swing: 'both' }],
  [['windnice', 'comfort', 'swing_comfort', 'swingcomfort'], { key: 'swing.comfort', icon: 'mdi:weather-windy', swing: 'v' }],
  [['floorheatingairflow'], { key: 'swing.floorheatingairflow', text: { pt: 'Ar ao chão', en: 'Floor airflow' }, icon: 'mdi:heating-coil', swing: 'v' }],
  [['auto'], { key: 'swing.auto', icon: 'mdi:autorenew', swing: 'v' }],
  [['top', 'upper', 'highest'], { key: 'swing.top', icon: 'mdi:arrow-up', swing: 'off' }],
  [['middle', 'center', 'centre'], { key: 'swing.middle', icon: 'mdi:arrow-right', swing: 'off' }],
  [['bottom', 'lower', 'lowest'], { key: 'swing.bottom', icon: 'mdi:arrow-down', swing: 'off' }],
  [['left'], { key: 'swing.left', icon: 'mdi:arrow-left', swing: 'off' }],
  [['right'], { key: 'swing.right', icon: 'mdi:arrow-right', swing: 'off' }],
  [['wide'], { key: 'swing.wide', icon: 'mdi:arrow-expand-horizontal', swing: 'h' }],
]);

const PROF_SWING_H = _prof_table([
  [['off', 'stop', 'fixed'], { key: 'swing.off', icon: 'mdi:minus-circle-outline', swing: 'off' }],
  [['on', 'swing', 'horizontal'], { key: 'swing.on', icon: 'mdi:arrow-left-right', swing: 'h' }],
  [['auto'], { key: 'swing.auto', icon: 'mdi:autorenew', swing: 'h' }],
  [['left'], { key: 'swing.left', icon: 'mdi:arrow-left', swing: 'off' }],
  [['center', 'centre', 'middle'], { key: 'swing.center', icon: 'mdi:arrow-up', swing: 'off' }],
  [['right'], { key: 'swing.right', icon: 'mdi:arrow-right', swing: 'off' }],
  [['wide'], { key: 'swing.wide', icon: 'mdi:arrow-expand-horizontal', swing: 'h' }],
]);

const PROF_PRESET = _prof_table([
  [['none', 'normal', 'off'], { key: 'preset.none', icon: 'mdi:circle-off-outline', color: null }],
  [['eco', 'econo', 'econo_mode'], { key: 'preset.eco', icon: 'mdi:leaf', color: '#34c77b' }],
  [['boost', 'powerful', 'powerful_mode'], { key: 'preset.boost', icon: 'mdi:rocket-launch', color: '#ff5d6c' }],
  [['away', 'holiday', 'vacation'], { key: 'preset.away', icon: 'mdi:airplane', color: '#8f9bb3' }],
  [['comfort'], { key: 'preset.comfort', icon: 'mdi:sofa', color: '#f5b83f' }],
  [['sleep', 'night'], { key: 'preset.sleep', icon: 'mdi:weather-night', color: '#7c8cff' }],
  [['home'], { key: 'preset.home', icon: 'mdi:home', color: null }],
  [['activity'], { key: 'preset.activity', icon: 'mdi:run', color: '#ff8a3d' }],
  [['streamer'], { key: 'preset.streamer', icon: 'mdi:shimmer', color: '#5ac8fa' }],
]);

const PROF_GENERIC_OPTIONS = Object.freeze({
  hvac_mode: PROF_HVAC,
  fan_mode: PROF_FAN,
  swing_mode: PROF_SWING,
  swing_horizontal_mode: PROF_SWING_H,
  preset_mode: PROF_PRESET,
});

/** Daikin wording on top of the generic tables (labels only; raw values are never changed). */
const PROF_DAIKIN_OPTIONS = Object.freeze({
  hvac_mode: PROF_HVAC,
  fan_mode: PROF_FAN,
  swing_mode: PROF_SWING,
  swing_horizontal_mode: PROF_SWING_H,
  preset_mode: PROF_PRESET,
});

export const ACHA_PROFILES = Object.freeze({
  generic: Object.freeze({
    id: 'generic',
    name: 'Generic',
    step: 0.5,
    colors: PROF_PALETTE,
    modeOrder: ['cool', 'heat', 'heat_cool', 'auto', 'dry', 'fan_only', 'off'],
    options: PROF_GENERIC_OPTIONS,
    toggles: ['eco', 'boost'],
  }),
  daikin: Object.freeze({
    id: 'daikin',
    name: 'Daikin (local)',
    step: 0.5,
    colors: PROF_PALETTE,
    // Daikin remote / Onecta order: Auto, Cool, Heat, Dry, Fan, Off
    modeOrder: ['heat_cool', 'auto', 'cool', 'heat', 'dry', 'fan_only', 'off'],
    options: PROF_DAIKIN_OPTIONS,
    toggles: ['eco', 'boost'],
  }),
  daikin_onecta: Object.freeze({
    id: 'daikin_onecta',
    name: 'Daikin Onecta',
    step: 0.5,
    colors: PROF_PALETTE,
    modeOrder: ['heat_cool', 'auto', 'cool', 'heat', 'dry', 'fan_only', 'off'],
    options: PROF_DAIKIN_OPTIONS,
    toggles: ['eco', 'boost'],
  }),
});

function _prof_list(st, name) {
  const v = st && st.attributes ? st.attributes[name] : null;
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

/** Registry-based detection (hass.entities / hass.devices). Returns a profile id or null. */
function _prof_detectRegistry(hass, entityId) {
  try {
    const reg = hass && hass.entities && entityId ? hass.entities[entityId] : null;
    if (!reg) return null;
    if (reg.platform === 'daikin_onecta') return 'daikin_onecta';
    if (reg.platform === 'daikin') return 'daikin';
    const dev = reg.device_id && hass.devices ? hass.devices[reg.device_id] : null;
    if (dev && /daikin/i.test(String(dev.manufacturer || '') + ' ' + String(dev.model || ''))) return 'daikin';
    return null;
  } catch (e) {
    return null;
  }
}

/** Attribute fingerprints (docs/DAIKIN_NOTES.md §5). Returns a profile id. */
function _prof_detectAttrs(st) {
  if (!st || !st.attributes) return 'generic';
  const a = st.attributes;
  const swing = _prof_list(st, 'swing_modes');
  const swingH = _prof_list(st, 'swing_horizontal_modes');
  const fans = _prof_list(st, 'fan_modes');
  const presets = _prof_list(st, 'preset_modes');
  const hvac = _prof_list(st, 'hvac_modes');
  const id = String(st.entity_id || '');

  const onectaSwing = swing.concat(swingH).some((v) => ['stop', 'windnice', 'floorheatingairflow'].includes(v));
  const onectaId = /_(room_temperature|leaving_water_offset|leaving_water_temperature)$/.test(id) && hvac[0] === 'off';
  const onectaPresets = presets.length > 1 && presets[presets.length - 1] === 'none' && presets.slice().sort().join() === presets.join();
  const onectaFans = fans.length > 0 && fans.every((f) => f === f.toLowerCase()) && fans.some((f) => f === 'quiet' || /^\d+$/.test(f));
  if (onectaSwing || onectaId || (onectaPresets && onectaFans)) return 'daikin_onecta';

  const localFans = fans.some((f) => ['Silence', 'Auto', 'Quiet', 'Low/Auto', 'Mid', 'Mid/Auto', 'High/Auto'].includes(f));
  const localSwing = swing.some((v) => v === '3D' || v === 'Off');
  const localHvac = hvac.join() === 'fan_only,dry,cool,heat,heat_cool,off' && Number(a.target_temp_step) === 1;
  if (localFans || localSwing || localHvac || a.zone_id !== undefined) return 'daikin';
  return 'generic';
}

const _prof_cache = new WeakMap();

/**
 * Profile for one AC entry: `entryConfig.profile` ('auto' | id) → detection → generic, merged with the
 * user's `labels / icons / colors / min_temp / max_temp / step`. Optional `hass` enables registry detection.
 * Never throws.
 */
export function resolveProfile(entryConfig, st, hass) {
  const entry = entryConfig && typeof entryConfig === 'object' ? entryConfig : {};
  let id = typeof entry.profile === 'string' ? entry.profile.toLowerCase() : 'auto';
  let detected = false;
  if (!ACHA_PROFILES[id]) {
    detected = true;
    id = _prof_detectRegistry(hass, entry.entity || (st && st.entity_id)) || _prof_detectAttrs(st);
  }
  const base = ACHA_PROFILES[id] || ACHA_PROFILES.generic;

  let byId = _prof_cache.get(entry);
  if (!byId) {
    byId = new Map();
    if (entryConfig && typeof entryConfig === 'object') _prof_cache.set(entryConfig, byId);
  }
  const hit = byId.get(base.id);
  if (hit) return hit;

  const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const merged = Object.freeze({
    id: base.id,
    name: base.name,
    detected,
    step: num(entry.step) > 0 ? num(entry.step) : base.step,
    userStep: num(entry.step) > 0 ? num(entry.step) : undefined,
    min_temp: num(entry.min_temp),
    max_temp: num(entry.max_temp),
    colors: Object.freeze({ ...base.colors, ...obj(entry.colors) }),
    modeOrder: base.modeOrder,
    options: base.options,
    toggles: base.toggles,
    labels: obj(entry.labels),
    icons: obj(entry.icons),
  });
  byId.set(base.id, merged);
  return merged;
}

/** User override lookup: overrides[kind][raw] (exact, then normalised). */
function _prof_override(map, kind, value) {
  const byKind = map && map[kind];
  if (!byKind || typeof byKind !== 'object') return null;
  const raw = String(value);
  if (byKind[raw] !== undefined && byKind[raw] !== null && byKind[raw] !== '') return String(byKind[raw]);
  const k = _prof_key(value);
  for (const key of Object.keys(byKind)) {
    if (_prof_key(key) === k && byKind[key] !== null && byKind[key] !== '') return String(byKind[key]);
  }
  return null;
}

/** Definition for a raw value, including compound fan values ('Low/Auto') and bare numbers ('6'). */
function _prof_def(kind, value, prof) {
  const tables = (prof && prof.options) || PROF_GENERIC_OPTIONS;
  const table = tables[kind] || PROF_GENERIC_OPTIONS[kind] || {};
  const k = _prof_key(value);
  if (table[k]) return table[k];
  if (kind === 'fan_mode') {
    if (k.length > 4 && k.endsWith('auto') && table[k.slice(0, -4)]) {
      const b = table[k.slice(0, -4)];
      return { ...b, icon: 'mdi:fan-auto', autoSuffix: true };
    }
    const m = k.match(/^(?:level|speed|fan)?(\d{1,2})$/);
    if (m) {
      const n = Number(m[1]);
      return { key: 'fan.level', vars: { n }, icon: n <= 2 ? 'mdi:fan-speed-1' : n <= 3 ? 'mdi:fan-speed-2' : 'mdi:fan-speed-3', level: n };
    }
  }
  if (kind === 'swing_horizontal_mode' && PROF_SWING[k]) return PROF_SWING[k];
  return null;
}

/**
 * Display info for one raw option value.
 * → { value, label, icon, color|null, level|null, swing|null }
 * kind ∈ hvac_mode | fan_mode | swing_mode | swing_horizontal_mode | preset_mode.
 */
export function describeOption(kind, value, profile, lang) {
  const prof = profile || ACHA_PROFILES.generic;
  const def = _prof_def(kind, value, prof);
  let label = _prof_override(prof.labels, kind, value);
  if (!label && def) {
    const txt = t(lang, def.key, def.vars);
    if (txt && txt !== def.key) label = txt;
    else if (def.text) label = def.text[lang] || def.text.en;
    if (label && def.autoSuffix) label += ' · ' + t(lang, 'fan.auto');
  }
  if (!label) label = prettify(value);
  const icon = _prof_override(prof.icons, kind, value) || (def && def.icon) || PROF_GENERIC_ICON[kind] || 'mdi:tune-variant';
  let color = null;
  if (kind === 'hvac_mode') {
    const colors = prof.colors || PROF_PALETTE;
    color = colors[String(value)] || colors[_prof_key(value)] || (def && def.color) || null;
  } else if (def && def.color) color = def.color;
  return {
    value,
    label,
    icon,
    color,
    level: def && Number.isFinite(def.level) ? def.level : null,
    swing: def && def.swing ? def.swing : null,
  };
}

/** Fan intensity 0..1 for the animated unit (auto ≈ .6, quiet ≈ .25, levels spread .3..1). */
export function fanIntensity(value, fanModes, profile) {
  if (value === undefined || value === null || value === '') return 0.5;
  const def = _prof_def('fan_mode', value, profile);
  if (def && Number.isFinite(def.intensity)) return def.intensity;
  const levels = (Array.isArray(fanModes) ? fanModes : [])
    .map((m) => _prof_def('fan_mode', m, profile))
    .filter((d) => d && Number.isFinite(d.level))
    .map((d) => d.level);
  if (def && Number.isFinite(def.level)) {
    const max = Math.max(def.level, ...levels, 1);
    const min = Math.min(def.level, ...levels);
    if (max === min) return 0.65;
    const lo = Math.min(1, min);
    return Math.round((0.3 + ((def.level - lo) / (max - lo)) * 0.7) * 100) / 100;
  }
  const list = Array.isArray(fanModes) ? fanModes.map(String) : [];
  const i = list.indexOf(String(value));
  if (i >= 0 && list.length > 1) return Math.round((0.3 + (i / (list.length - 1)) * 0.7) * 100) / 100;
  return 0.5;
}

/** All option kinds handled by describeOption (handy for the editor / tests). */
export const ACHA_OPTION_KINDS = PROF_KINDS;
