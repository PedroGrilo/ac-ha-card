/*! ACHA Climate Card v1.0.0 | custom:acha-card for Home Assistant | MIT | built 2026-10-11T23:55:26.342Z */
(function () {
'use strict';

// ===== src/utils.js =====
// ACHA Card — shared helpers (no dependencies, no DOM assumptions beyond CustomEvent).
// Bundling rules: named exports only, private top-level helpers prefixed with `_utils_`.

/** Climate entity feature bits (homeassistant.components.climate.ClimateEntityFeature). */
const SUPPORT = Object.freeze({
  TARGET_TEMPERATURE: 1,
  TARGET_TEMPERATURE_RANGE: 2,
  TARGET_HUMIDITY: 4,
  FAN_MODE: 8,
  PRESET_MODE: 16,
  SWING_MODE: 32,
  TURN_OFF: 128,
  TURN_ON: 256,
  SWING_HORIZONTAL_MODE: 512,
});

const _utils_OFF_STATES = ['off', 'unavailable', 'unknown'];

/** Number of decimals implied by a step (0.5 → 1, 0.25 → 2, 1 → 0, 1e-3 → 3). Capped at 6. */
function _utils_decimals(step) {
  const n = Math.abs(Number(step));
  if (!Number.isFinite(n) || n === 0 || Number.isInteger(n)) return 0;
  const s = String(n);
  const exp = s.match(/e-(\d+)$/i);
  if (exp) {
    const mant = s.split(/e/i)[0];
    const mantDec = mant.includes('.') ? mant.split('.')[1].length : 0;
    return Math.min(6, Number(exp[1]) + mantDec);
  }
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : Math.min(6, s.length - dot - 1);
}

/** Coerce anything number-like to a finite number, else NaN. Booleans/empty are not numbers. */
function _utils_toNum(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || typeof v === 'boolean') return NaN;
  const s = String(v).trim();
  if (s === '') return NaN;
  return Number(s);
}

/**
 * Parse a colour into [r, g, b] (0..255) or null.
 * Accepts '#rgb', '#rgba', '#rrggbb', '#rrggbbaa', 'rgb(r,g,b)', 'rgba(r,g,b,a)', 'r, g, b', [r,g,b].
 */
function _utils_parseColor(input) {
  if (Array.isArray(input) && input.length >= 3) {
    const arr = input.slice(0, 3).map(Number);
    return arr.every(Number.isFinite) ? arr.map((c) => Math.round(clamp(c, 0, 255))) : null;
  }
  if (typeof input !== 'string') return null;
  const s = input.trim();
  let m = s.match(/^#?([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
    else if (h.length === 8) h = h.slice(0, 6);
    else if (h.length !== 6) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  m = s.match(/^(?:rgba?\()?\s*(\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(\d{1,3}(?:\.\d+)?)\s*(?:[,/]\s*[\d.]+%?\s*)?\)?$/i);
  if (m) return [m[1], m[2], m[3]].map((c) => Math.round(clamp(Number(c), 0, 255)));
  return null;
}

function _utils_toHex(rgb) {
  return '#' + rgb.map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('');
}

/**
 * Dispatch a CustomEvent that bubbles and crosses shadow boundaries (like HA's fireEvent).
 * `options` may override bubbles/composed/cancelable. Returns the event.
 */
function fireEvent(node, type, detail, options) {
  const opts = options || {};
  const ev = new CustomEvent(type, {
    bubbles: opts.bubbles === undefined ? true : !!opts.bubbles,
    composed: opts.composed === undefined ? true : !!opts.composed,
    cancelable: !!opts.cancelable,
    detail: detail === null || detail === undefined ? {} : detail,
  });
  if (node && typeof node.dispatchEvent === 'function') node.dispatchEvent(ev);
  return ev;
}

/**
 * Trailing-edge debounce. The returned function has:
 *  - `.cancel()` drop the pending call,
 *  - `.flush()`  run the pending call now (returns its result, or undefined if nothing pending),
 *  - `.pending()` true while a call is scheduled.
 */
function debounce(fn, ms) {
  const wait = Math.max(0, Number(ms) || 0);
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  const run = () => {
    timer = null;
    const args = lastArgs || [];
    const ctx = lastThis;
    lastArgs = null;
    lastThis = null;
    return fn.apply(ctx, args);
  };
  function debounced(...args) {
    lastArgs = args;
    lastThis = this;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(run, wait);
  }
  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
    lastThis = null;
  };
  debounced.flush = () => {
    if (timer === null) return undefined;
    clearTimeout(timer);
    return run();
  };
  debounced.pending = () => timer !== null;
  return debounced;
}

/** Clamp v into [min, max]. Missing bounds are open; min/max swapped if inverted; NaN → min (or 0). */
function clamp(v, min, max) {
  let lo = min === null || min === undefined || Number.isNaN(Number(min)) ? -Infinity : Number(min);
  let hi = max === null || max === undefined || Number.isNaN(Number(max)) ? Infinity : Number(max);
  if (lo > hi) [lo, hi] = [hi, lo];
  const n = Number(v);
  if (Number.isNaN(n)) return Number.isFinite(lo) ? lo : 0;
  return Math.min(Math.max(n, lo), hi);
}

/** Snap v to the nearest multiple of step, free of float noise (22.499999 → 22.5). step <= 0 → v. */
function roundToStep(v, step) {
  const n = Number(v);
  const s = Math.abs(Number(step));
  if (!Number.isFinite(n)) return n;
  if (!Number.isFinite(s) || s === 0) return n;
  const r = Math.round(n / s) * s;
  const out = Number(r.toFixed(_utils_decimals(s)));
  return Object.is(out, -0) ? 0 : out;
}

/** 'fan_only' → 'Fan only', 'heat_cool' → 'Heat cool', 'Silence' → 'Silence'. null → ''. */
function prettify(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Matching key: lowercase, strip spaces, underscores and hyphens ('Fan_Only' → 'fanonly'). */
function normKey(v) {
  if (v === null || v === undefined) return '';
  return String(v).toLowerCase().replace(/[\s_-]+/g, '');
}

/** hass.states[id] or null (never throws). */
function stateObj(hass, id) {
  if (!hass || !id || !hass.states) return null;
  return hass.states[id] || null;
}

/**
 * Call a climate service: callClimate(hass, 'set_hvac_mode', 'climate.x', { hvac_mode: 'cool' }).
 * `service` may also be 'domain.service' (e.g. 'homeassistant.toggle') to target another domain.
 * `entityId` may be a string or an array. Keys with `undefined` values are dropped.
 * Returns the hass.callService promise (rejects like HA does); resolves undefined if hass/entity missing.
 */
function callClimate(hass, service, entityId, data) {
  if (!hass || typeof hass.callService !== 'function' || !service || !entityId) {
    console.warn('[acha-card] callClimate skipped (missing hass, service or entity):', service, entityId);
    return Promise.resolve(undefined);
  }
  let domain = 'climate';
  let svc = String(service);
  const dot = svc.indexOf('.');
  if (dot > 0) {
    domain = svc.slice(0, dot);
    svc = svc.slice(dot + 1);
  }
  const payload = {};
  if (data && typeof data === 'object') {
    for (const k of Object.keys(data)) if (data[k] !== undefined) payload[k] = data[k];
  }
  payload.entity_id = entityId;
  try {
    return Promise.resolve(hass.callService(domain, svc, payload));
  } catch (err) {
    return Promise.reject(err);
  }
}

/** True unless the state is off / unavailable / unknown (or missing). Accepts a state object or a raw state string. */
function isOn(st) {
  const s = typeof st === 'string' ? st : st && st.state;
  if (s === null || s === undefined || s === '') return false;
  return !_utils_OFF_STATES.includes(String(s).toLowerCase());
}

/**
 * Finite number from st.attributes[name], else null. Numeric strings are parsed.
 * With `name` omitted/null, parses st.state instead (handy for sensors).
 */
function numAttr(st, name) {
  if (!st) return null;
  const raw = name === null || name === undefined ? st.state : st.attributes ? st.attributes[name] : undefined;
  const n = _utils_toNum(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Split a temperature for display: formatTemp(22.5, 0.5) → { int:'22', dec:'.5', text:'22.5', value:22.5 }.
 * Decimals come from `step` (0.5 → 1, 0.1 → 1, 0.25 → 2, 1 → 0); without step: 0 for integers, else 1.
 * Trailing zeros are dropped (22.0 → '22', dec ''). Non-numeric → { int:'--', dec:'', text:'--', value:null }.
 */
function formatTemp(v, step) {
  const n = _utils_toNum(v);
  if (!Number.isFinite(n)) return { int: '--', dec: '', text: '--', value: null };
  const s = Number(step);
  const decimals = Number.isFinite(s) && s > 0 ? _utils_decimals(s) : Number.isInteger(n) ? 0 : 1;
  const fixed = Math.abs(n).toFixed(decimals);
  const parts = fixed.split('.');
  const frac = (parts[1] || '').replace(/0+$/, '');
  const value = Number(fixed) * (n < 0 ? -1 : 1);
  const neg = n < 0 && Number(fixed) !== 0;
  const int = (neg ? '-' : '') + parts[0];
  const dec = frac ? '.' + frac : '';
  return { int, dec, text: int + dec, value: Object.is(value, -0) ? 0 : value };
}

/** Linear interpolation between two colours, t in 0..1 → '#rrggbb'. Invalid input falls back to the valid one. */
function lerpColor(a, b, t) {
  const ca = _utils_parseColor(a);
  const cb = _utils_parseColor(b);
  if (!ca && !cb) return typeof a === 'string' ? a : typeof b === 'string' ? b : '#000000';
  if (!ca) return _utils_toHex(cb);
  if (!cb) return _utils_toHex(ca);
  const k = clamp(Number(t) || 0, 0, 1);
  return _utils_toHex(ca.map((c, i) => c + (cb[i] - c) * k));
}

/** '#3fa9f5' → '63, 169, 245' (for rgba(var(--x-rgb), .3)). Invalid → `fallback` (default '0, 0, 0'). */
function hexToRgb(hex, fallback) {
  const rgb = _utils_parseColor(hex);
  if (!rgb) return fallback === undefined ? '0, 0, 0' : fallback;
  return rgb.join(', ');
}

/** True when the entity's supported_features includes every bit in `bit` (use SUPPORT.*). */
function supports(st, bit) {
  const b = Number(bit) || 0;
  if (!b || !st || !st.attributes) return false;
  const f = Number(st.attributes.supported_features) || 0;
  return (f & b) === b;
}

// ===== src/i18n.js =====
// ACHA Card — i18n (pt-PT + en)
// Exports: ACHA_STRINGS, resolveLang(hass, pref), t(lang, key, vars?)
// Keys are dot paths ('mode.cool'). Lookup: lang → en → key itself.
// Interpolation: '{n}' replaced from vars. Plural helper: when vars.n === 1 and
// '<key>_one' exists, that variant is used (e.g. ui.n_on → ui.n_on_one).

const ACHA_STRINGS = {
  pt: {
    mode: {
      off: 'Desligado',
      cool: 'Arrefecer',
      heat: 'Aquecer',
      heat_cool: 'Automático',
      auto: 'Automático',
      dry: 'Desumidificar',
      fan_only: 'Ventilar',
      fan: 'Ventilar',
    },
    action: {
      cooling: 'A arrefecer',
      heating: 'A aquecer',
      drying: 'A desumidificar',
      fan: 'A ventilar',
      idle: 'Em espera',
      off: 'Desligado',
      preheating: 'A pré-aquecer',
      defrosting: 'A descongelar',
    },
    fan: {
      auto: 'Automático',
      silence: 'Silencioso',
      quiet: 'Silencioso',
      silent: 'Silencioso',
      level: 'Nível {n}',
      level_1: 'Nível 1',
      level_2: 'Nível 2',
      level_3: 'Nível 3',
      level_4: 'Nível 4',
      level_5: 'Nível 5',
      1: 'Nível 1',
      2: 'Nível 2',
      3: 'Nível 3',
      4: 'Nível 4',
      5: 'Nível 5',
      low: 'Baixa',
      medium_low: 'Média-baixa',
      medium: 'Média',
      middle: 'Média',
      medium_high: 'Média-alta',
      high: 'Alta',
      highest: 'Máxima',
      max: 'Máxima',
      turbo: 'Turbo',
      powerful: 'Potente',
      focus: 'Focado',
      diffuse: 'Difuso',
      on: 'Ligado',
      off: 'Desligado',
    },
    swing: {
      off: 'Fixo',
      fixed: 'Fixo',
      stop: 'Fixo',
      on: 'Oscilar',
      vertical: 'Vertical',
      horizontal: 'Horizontal',
      both: '3D',
      '3d': '3D',
      auto: 'Automático',
      windnice: 'Conforto',
      comfort: 'Conforto',
      top: 'Cima',
      upper: 'Cima',
      middle: 'Meio',
      bottom: 'Baixo',
      lower: 'Baixo',
      left: 'Esquerda',
      center: 'Centro',
      right: 'Direita',
      wide: 'Amplo',
    },
    preset: {
      none: 'Nenhum',
      eco: 'Econo',
      econo: 'Econo',
      boost: 'Potente',
      powerful: 'Potente',
      away: 'Ausente',
      comfort: 'Conforto',
      sleep: 'Noite',
      night: 'Noite',
      home: 'Em casa',
      activity: 'Atividade',
      streamer: 'Streamer',
    },
    ui: {
      mode: 'Modo',
      fan_speed: 'Velocidade',
      swing: 'Oscilação',
      swing_vertical: 'Oscilação vertical',
      swing_horizontal: 'Oscilação horizontal',
      preset: 'Modo especial',
      inside: 'Dentro',
      outside: 'Fora',
      inside_fmt: '{t} dentro',
      outside_fmt: '{t} fora',
      humidity: 'Humidade',
      humidity_fmt: '{h} humidade',
      power: 'Consumo',
      energy: 'Energia',
      energy_today: 'Energia hoje',
      connected: 'Ligado à rede',
      unavailable: 'Desligado da rede',
      unknown: 'Desconhecido',
      target: 'Temperatura definida',
      setpoint: 'Temperatura',
      current: 'Atual',
      turn_on: 'Ligar',
      turn_off: 'Desligar',
      all_off: 'Desligar todos',
      n_on: '{n} ligados',
      n_on_one: '{n} ligado',
      all_off_state: 'tudo desligado',
      on: 'Ligado',
      off: 'Desligado',
      none: 'Nenhum',
      range: 'Intervalo',
      low: 'Mín.',
      high: 'Máx.',
      increase: 'Aumentar temperatura',
      decrease: 'Diminuir temperatura',
      select: 'Selecionar',
      close: 'Fechar',
      cancel: 'Cancelar',
      done: 'Concluído',
      options: 'Opções',
      extras: 'Extras',
      quick: 'Atalhos',
      eco: 'Econo',
      boost: 'Potente',
      streamer: 'Streamer',
      toggle: 'Alternar',
      press: 'Premir',
      pressed: 'Premido',
      run: 'Executar',
      more_info: 'Mais informações',
      read_only: 'Só leitura',
      no_options: 'Sem opções disponíveis',
      not_found: 'Entidade não encontrada: {entity}',
      no_entities: 'Nenhum ar condicionado configurado',
      climate: 'Climatização',
      air_conditioners: 'Ares condicionados',
      unit_c: '°C',
      unit_f: '°F',
    },
    editor: {
      general: 'Geral',
      title: 'Título',
      profile: 'Perfil',
      profile_auto: 'Automático (detetar)',
      profile_daikin: 'Daikin (local)',
      profile_daikin_onecta: 'Daikin Onecta',
      profile_generic: 'Genérico',
      theme: 'Tema',
      theme_auto: 'Automático',
      theme_dark: 'Escuro',
      theme_light: 'Claro',
      layout: 'Disposição',
      layout_tabs: 'Separadores',
      layout_stack: 'Empilhado',
      layout_grid: 'Grelha',
      show_unit: 'Mostrar unidade interior animada',
      language: 'Idioma',
      language_auto: 'Automático',
      language_pt: 'Português',
      language_en: 'English',
      entities: 'Ares condicionados',
      entry: 'AC {n}',
      entity: 'Entidade de climatização',
      name: 'Nome',
      icon: 'Ícone',
      indoor_temperature: 'Sensor de temperatura interior',
      outdoor_temperature: 'Sensor de temperatura exterior',
      humidity: 'Sensor de humidade',
      power: 'Sensor de consumo / energia',
      min_temp: 'Temperatura mínima',
      max_temp: 'Temperatura máxima',
      step: 'Incremento',
      hide: 'Ocultar controlos',
      hide_modes: 'Modos',
      hide_fan: 'Velocidade',
      hide_swing: 'Oscilação vertical',
      hide_swing_horizontal: 'Oscilação horizontal',
      hide_preset: 'Modo especial',
      hide_power_btn: 'Botão de ligar',
      extras: 'Entidades extra',
      add_ac: 'Adicionar AC',
      remove: 'Remover',
      move_up: 'Mover para cima',
      move_down: 'Mover para baixo',
      no_entity: 'Sem entidade',
      loading: 'A carregar editor…',
    },
  },
  en: {
    mode: {
      off: 'Off',
      cool: 'Cool',
      heat: 'Heat',
      heat_cool: 'Auto',
      auto: 'Auto',
      dry: 'Dry',
      fan_only: 'Fan',
      fan: 'Fan',
    },
    action: {
      cooling: 'Cooling',
      heating: 'Heating',
      drying: 'Drying',
      fan: 'Fan',
      idle: 'Idle',
      off: 'Off',
      preheating: 'Preheating',
      defrosting: 'Defrosting',
    },
    fan: {
      auto: 'Auto',
      silence: 'Quiet',
      quiet: 'Quiet',
      silent: 'Quiet',
      level: 'Level {n}',
      level_1: 'Level 1',
      level_2: 'Level 2',
      level_3: 'Level 3',
      level_4: 'Level 4',
      level_5: 'Level 5',
      1: 'Level 1',
      2: 'Level 2',
      3: 'Level 3',
      4: 'Level 4',
      5: 'Level 5',
      low: 'Low',
      medium_low: 'Medium-low',
      medium: 'Medium',
      middle: 'Medium',
      medium_high: 'Medium-high',
      high: 'High',
      highest: 'Max',
      max: 'Max',
      turbo: 'Turbo',
      powerful: 'Powerful',
      focus: 'Focus',
      diffuse: 'Diffuse',
      on: 'On',
      off: 'Off',
    },
    swing: {
      off: 'Fixed',
      fixed: 'Fixed',
      stop: 'Fixed',
      on: 'Swing',
      vertical: 'Vertical',
      horizontal: 'Horizontal',
      both: '3D',
      '3d': '3D',
      auto: 'Auto',
      windnice: 'Comfort',
      comfort: 'Comfort',
      top: 'Top',
      upper: 'Top',
      middle: 'Middle',
      bottom: 'Bottom',
      lower: 'Bottom',
      left: 'Left',
      center: 'Centre',
      right: 'Right',
      wide: 'Wide',
    },
    preset: {
      none: 'None',
      eco: 'Econo',
      econo: 'Econo',
      boost: 'Powerful',
      powerful: 'Powerful',
      away: 'Away',
      comfort: 'Comfort',
      sleep: 'Night',
      night: 'Night',
      home: 'Home',
      activity: 'Activity',
      streamer: 'Streamer',
    },
    ui: {
      mode: 'Mode',
      fan_speed: 'Fan speed',
      swing: 'Swing',
      swing_vertical: 'Vertical swing',
      swing_horizontal: 'Horizontal swing',
      preset: 'Special mode',
      inside: 'Inside',
      outside: 'Outside',
      inside_fmt: '{t} inside',
      outside_fmt: '{t} outside',
      humidity: 'Humidity',
      humidity_fmt: '{h} humidity',
      power: 'Power',
      energy: 'Energy',
      energy_today: 'Energy today',
      connected: 'Connected',
      unavailable: 'Disconnected',
      unknown: 'Unknown',
      target: 'Target temperature',
      setpoint: 'Temperature',
      current: 'Current',
      turn_on: 'Turn on',
      turn_off: 'Turn off',
      all_off: 'Turn all off',
      n_on: '{n} on',
      n_on_one: '{n} on',
      all_off_state: 'all off',
      on: 'On',
      off: 'Off',
      none: 'None',
      range: 'Range',
      low: 'Low',
      high: 'High',
      increase: 'Increase temperature',
      decrease: 'Decrease temperature',
      select: 'Select',
      close: 'Close',
      cancel: 'Cancel',
      done: 'Done',
      options: 'Options',
      extras: 'Extras',
      quick: 'Shortcuts',
      eco: 'Econo',
      boost: 'Powerful',
      streamer: 'Streamer',
      toggle: 'Toggle',
      press: 'Press',
      pressed: 'Pressed',
      run: 'Run',
      more_info: 'More info',
      read_only: 'Read only',
      no_options: 'No options available',
      not_found: 'Entity not found: {entity}',
      no_entities: 'No air conditioners configured',
      climate: 'Climate',
      air_conditioners: 'Air conditioners',
      unit_c: '°C',
      unit_f: '°F',
    },
    editor: {
      general: 'General',
      title: 'Title',
      profile: 'Profile',
      profile_auto: 'Auto (detect)',
      profile_daikin: 'Daikin (local)',
      profile_daikin_onecta: 'Daikin Onecta',
      profile_generic: 'Generic',
      theme: 'Theme',
      theme_auto: 'Auto',
      theme_dark: 'Dark',
      theme_light: 'Light',
      layout: 'Layout',
      layout_tabs: 'Tabs',
      layout_stack: 'Stack',
      layout_grid: 'Grid',
      show_unit: 'Show animated indoor unit',
      language: 'Language',
      language_auto: 'Auto',
      language_pt: 'Português',
      language_en: 'English',
      entities: 'Air conditioners',
      entry: 'AC {n}',
      entity: 'Climate entity',
      name: 'Name',
      icon: 'Icon',
      indoor_temperature: 'Indoor temperature sensor',
      outdoor_temperature: 'Outdoor temperature sensor',
      humidity: 'Humidity sensor',
      power: 'Power / energy sensor',
      min_temp: 'Minimum temperature',
      max_temp: 'Maximum temperature',
      step: 'Step',
      hide: 'Hide controls',
      hide_modes: 'Modes',
      hide_fan: 'Fan speed',
      hide_swing: 'Vertical swing',
      hide_swing_horizontal: 'Horizontal swing',
      hide_preset: 'Special mode',
      hide_power_btn: 'Power button',
      extras: 'Extra entities',
      add_ac: 'Add AC',
      remove: 'Remove',
      move_up: 'Move up',
      move_down: 'Move down',
      no_entity: 'No entity',
      loading: 'Loading editor…',
    },
  },
};

const I18N_LANGS = ['pt', 'en'];

function _i18n_normLang(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (!s || s === 'auto') return null;
  const base = s.split(/[-_]/)[0];
  return I18N_LANGS.indexOf(base) >= 0 ? base : null;
}

// pref: config `language` ('auto' | 'pt' | 'en' | 'pt-PT' ...). Returns 'pt' | 'en'.
function resolveLang(hass, pref) {
  const forced = _i18n_normLang(pref);
  if (forced) return forced;
  let src = null;
  try {
    src = (hass && hass.locale && hass.locale.language) || (hass && hass.language) || null;
  } catch (e) { src = null; }
  if (!src) {
    try { src = (typeof navigator !== 'undefined' && navigator.language) || null; } catch (e) { src = null; }
  }
  return _i18n_normLang(src) || 'en';
}

function _i18n_strip(s) {
  return String(s).toLowerCase().replace(/[\s_\-]+/g, '');
}

// Resolve a dot path inside one language table. The last segment is matched
// exactly first, then case/space/underscore/hyphen-insensitively (so raw
// attribute values such as 'Silence', 'Level 1', '3D' or 'fan-only' work).
function _i18n_lookup(table, key) {
  if (!table || typeof key !== 'string' || !key) return undefined;
  const parts = key.split('.');
  let node = table;
  for (let i = 0; i < parts.length; i++) {
    if (!node || typeof node !== 'object') return undefined;
    const seg = parts[i];
    if (Object.prototype.hasOwnProperty.call(node, seg)) { node = node[seg]; continue; }
    const lower = seg.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(node, lower)) { node = node[lower]; continue; }
    const stripped = _i18n_strip(seg);
    let found;
    const keys = Object.keys(node);
    for (let k = 0; k < keys.length; k++) {
      if (_i18n_strip(keys[k]) === stripped) { found = node[keys[k]]; break; }
    }
    if (found === undefined) return undefined;
    node = found;
  }
  return typeof node === 'string' ? node : undefined;
}

function _i18n_interp(str, vars) {
  if (!vars || typeof str !== 'string' || str.indexOf('{') < 0) return str;
  return str.replace(/\{(\w+)\}/g, (m, name) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return m;
    const v = vars[name];
    return v === null || v === undefined ? '' : String(v);
  });
}

// t('pt', 'mode.cool') → 'Arrefecer'; t('pt', 'ui.n_on', {n: 2}) → '2 ligados'.
// Fallback chain: lang → en → key. Never throws.
function t(lang, key, vars) {
  try {
    const l = _i18n_normLang(lang) || 'en';
    const tables = l === 'en' ? [ACHA_STRINGS.en] : [ACHA_STRINGS[l], ACHA_STRINGS.en];
    const one = vars && Number(vars.n) === 1;
    for (let i = 0; i < tables.length; i++) {
      let s;
      if (one) s = _i18n_lookup(tables[i], key + '_one');
      if (s === undefined) s = _i18n_lookup(tables[i], key);
      if (s !== undefined) return _i18n_interp(s, vars);
    }
  } catch (e) { /* fall through */ }
  return key === undefined || key === null ? '' : String(key);
}

// ===== src/profiles.js =====
// ACHA Card — brand profiles + option label/icon/colour mapping.
// Exports: ACHA_PROFILES, resolveProfile(entryConfig, stateObj, hass?), describeOption(kind, value, profile, lang),
//          fanIntensity(value, fanModes, profile).
// Bundling rules: named exports only, private top-level names prefixed `_prof_` / `PROF_`.
// Rule (docs/DAIKIN_NOTES.md): the raw value is always sent back unchanged; normalisation is only for labels/icons.


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

const ACHA_PROFILES = Object.freeze({
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
function resolveProfile(entryConfig, st, hass) {
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
function describeOption(kind, value, profile, lang) {
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
function fanIntensity(value, fanModes, profile) {
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
const ACHA_OPTION_KINDS = PROF_KINDS;

// ===== src/styles.js =====
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
  transition: opacity 420ms var(--acha-ease), transform 560ms var(--acha-spring), filter 420ms var(--acha-ease);
}
.layout-tabs .acha-track > acha-panel:not([active]) { opacity: .35; transform: scale(.96); filter: saturate(.6); }

/* ---------- stack / grid layouts ---------- */
.layout-stack .acha-track, .layout-grid .acha-track { transform: none; transition: none; }
.layout-stack .acha-viewport, .layout-grid .acha-viewport { overflow: visible; margin: 0; }
.layout-stack .acha-track { flex-direction: column; gap: 14px; }
.layout-stack .acha-track > acha-panel, .layout-grid .acha-track > acha-panel { padding: 0; opacity: 1; transform: none; filter: none; }
.layout-grid .acha-track {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
}
.layout-stack .acha-track > acha-panel, .layout-grid .acha-track > acha-panel {
  animation: acha-fade-up 520ms var(--acha-ease) both;
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
  filter: blur(40px);
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
:host([on]) .acha-ambient::before, .is-on .acha-ambient::before { opacity: 1; animation: acha-breathe 6s ease-in-out infinite; }
:host([on]) .acha-ambient::after, .is-on .acha-ambient::after { opacity: .8; animation: acha-breathe 8s ease-in-out -3s infinite; }

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
  animation: acha-fade-up 600ms var(--acha-ease) both;
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
  animation: acha-fade-up 480ms var(--acha-ease) both;
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
  animation: acha-fade-up 520ms var(--acha-ease) both;
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
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: color 300ms var(--acha-ease);
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
  animation: acha-fade-up 400ms var(--acha-ease) both;
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
  .acha-tile { min-height: 60px; padding: 10px; gap: 9px; border-radius: 17px; }
  .acha-tile-icon { width: 36px; height: 36px; border-radius: 12px; --mdc-icon-size: 19px; }
  .acha-tile-value { font-size: 14px; }
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

const ACHA_CARD_CSS = _styles_TOKENS + _styles_CARD_BASE + _styles_CARD_SWITCHER + _styles_KEYFRAMES + _styles_REDUCED_MOTION;

const ACHA_PANEL_CSS = _styles_PANEL_BASE + _styles_PANEL_HERO + _styles_PANEL_TILES + _styles_PANEL_RESPONSIVE + _styles_KEYFRAMES + _styles_REDUCED_MOTION;

// ===== src/dial.js =====
// acha-dial — circular 270° setpoint dial (gap at the bottom), Onecta style.
// Props: value, min, max, step, mode, color, disabled, current, low, high, dual, label, sublabel, unit, name.
// Events (bubbling, composed): acha-input {value} | {low,high} while dragging; acha-change on release / key.
// Built once; prop setters schedule a patch-only render. Bundling: private names prefixed DIAL_ / _dial_.


const DIAL_SIZE = 320;
const DIAL_C = 160;
const DIAL_R = 124; // track radius
const DIAL_TICK_R1 = 143;
const DIAL_TICK_R2 = 151;
const DIAL_TICKS = 60;
const DIAL_START = -135; // degrees, 0 = 12 o'clock, clockwise positive
const DIAL_SWEEP = 270;
const DIAL_TWEEN_MS = 400;

const DIAL_CSS = `
:host {
  position: relative;
  display: block;
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
  aspect-ratio: 1;
  container-type: inline-size;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  font-family: var(--acha-font, var(--ha-font-family-body, system-ui));
  --_d-accent: var(--acha-accent, #3fa9f5);
  --_d-text: var(--acha-text, #f4f6fb);
  --_d-muted: var(--acha-muted, rgba(226, 232, 245, .58));
  --_d-faint: var(--acha-faint, rgba(226, 232, 245, .34));
  --_d-track: var(--acha-track, rgba(255, 255, 255, .09));
  --_d-knob: var(--acha-knob, #ffffff);
  --_d-ease: var(--acha-ease, cubic-bezier(.22, .8, .24, 1));
  --_d-spring: var(--acha-spring, cubic-bezier(.2, .9, .25, 1.15));
  color: var(--_d-text);
}
svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; display: block; }
.tick { stroke: var(--_d-faint); stroke-width: 2; stroke-linecap: round; opacity: .5; transition: stroke 300ms var(--_d-ease), opacity 300ms var(--_d-ease); }
.tick.major { stroke-width: 2.6; opacity: .75; }
.tick.on { stroke: var(--_d-accent); opacity: 1; }
.track { fill: none; stroke: var(--_d-track); stroke-width: 14; stroke-linecap: round; }
.prog { fill: none; stroke-width: 14; stroke-linecap: round; transition: opacity 400ms var(--_d-ease); }
.glow { fill: none; stroke: var(--_d-accent); stroke-width: 18; stroke-linecap: round; opacity: .45; transition: opacity 400ms var(--_d-ease), stroke 600ms var(--_d-ease); }
.s0 { stop-color: var(--_d-accent); transition: stop-color 600ms var(--_d-ease); }
.s1 { stop-color: color-mix(in srgb, var(--_d-accent) 55%, #fff); transition: stop-color 600ms var(--_d-ease); }
.cur { fill: var(--_d-text); opacity: .9; transition: opacity 300ms var(--_d-ease); }
.cur-ring { fill: none; stroke: var(--_d-text); stroke-width: 1.5; opacity: .28; }
.hit { fill: none; stroke: transparent; stroke-width: 58; stroke-linecap: round; pointer-events: stroke; touch-action: none; cursor: pointer; }
.thumb { cursor: grab; touch-action: none; outline: none; transition: opacity 300ms var(--_d-ease); }
.thumb.grab { cursor: grabbing; }
.knob {
  fill: var(--_d-knob);
  stroke: var(--_d-accent);
  stroke-width: 5;
  transform-box: fill-box;
  transform-origin: center;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, .35));
  transition: transform 220ms var(--_d-spring), stroke 600ms var(--_d-ease);
}
.halo { fill: var(--_d-accent); opacity: 0; transform-box: fill-box; transform-origin: center; transform: scale(.6); transition: opacity 220ms var(--_d-ease), transform 260ms var(--_d-spring); }
.thumb.grab .knob { transform: scale(1.18); }
.thumb.grab .halo { opacity: .22; transform: scale(1); }
.thumb:focus-visible .halo { opacity: .3; transform: scale(1); }
.thumb[hidden] { display: none; }

.center {
  position: absolute;
  inset: 20%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-align: center;
  pointer-events: none;
}
.label {
  min-height: 1.2em;
  font-size: clamp(11px, 4.1cqw, 13px);
  font-weight: 600;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--_d-accent);
  transition: color 600ms var(--_d-ease);
  white-space: nowrap;
}
.sp {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  font-weight: 300;
  line-height: 1;
  letter-spacing: -.045em;
  font-variant-numeric: tabular-nums;
  transition: opacity 400ms var(--_d-ease), transform 400ms var(--_d-spring);
}
.int { font-size: clamp(40px, 20cqw, 64px); }
.dec, .unit { font-size: clamp(16px, 7cqw, 24px); font-weight: 400; letter-spacing: -.01em; margin-top: .3em; }
.unit { color: var(--_d-muted); margin-left: 2px; }
.sp-dual { display: none; align-items: baseline; gap: 6px; font-weight: 300; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -.04em; font-size: clamp(30px, 14cqw, 46px); }
.sp-dual .sep { color: var(--_d-faint); font-size: .7em; }
.sp-dual .u { font-size: .42em; color: var(--_d-muted); letter-spacing: 0; }
:host([dual]) .sp { display: none; }
:host([dual]) .sp-dual { display: flex; }
.sub {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 1.3em;
  margin-top: 4px;
  font-size: clamp(11px, 4.2cqw, 13.5px);
  color: var(--_d-muted);
  font-variant-numeric: tabular-nums;
  --mdc-icon-size: 16px;
  white-space: nowrap;
}
.sub:empty { visibility: hidden; }

:host([disabled]) svg { filter: saturate(0); }
:host([disabled]) .prog, :host([disabled]) .glow { opacity: 0; }
:host([disabled]) .tick.on { stroke: var(--_d-faint); opacity: .5; }
:host([disabled]) .thumb { opacity: 0; pointer-events: none; }
:host([disabled]) .hit { pointer-events: none; cursor: default; }
:host([disabled]) .sp, :host([disabled]) .sp-dual { opacity: .32; transform: scale(.94); }
:host([disabled]) .label { color: var(--_d-muted); }
:host([disabled]) .cur { opacity: .5; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 1ms !important; animation-duration: 1ms !important; }
}
`;

let _dial_uid = 0;

function _dial_rad(deg) {
  return (deg * Math.PI) / 180;
}

/** Point on a circle of radius r at angle deg (0 = top, clockwise). */
function _dial_pt(deg, r) {
  const a = _dial_rad(deg);
  return [DIAL_C + r * Math.sin(a), DIAL_C - r * Math.cos(a)];
}

function _dial_f(n) {
  return Math.round(n * 100) / 100;
}

/** SVG arc path from angle a to angle b (clockwise, a <= b). */
function _dial_arc(a, b, r) {
  const span = Math.max(0, b - a);
  if (span < 0.01) {
    const [x, y] = _dial_pt(a, r);
    return `M ${_dial_f(x)} ${_dial_f(y)}`;
  }
  const [x1, y1] = _dial_pt(a, r);
  const [x2, y2] = _dial_pt(b, r);
  const large = span > 180 ? 1 : 0;
  return `M ${_dial_f(x1)} ${_dial_f(y1)} A ${r} ${r} 0 ${large} 1 ${_dial_f(x2)} ${_dial_f(y2)}`;
}

function _dial_num(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function _dial_reduced() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) {
    return false;
  }
}

function _dial_ease(t) {
  return 1 - Math.pow(1 - t, 3);
}

function _dial_svg(uid) {
  const ticks = [];
  for (let i = 0; i < DIAL_TICKS; i++) {
    const deg = DIAL_START + (DIAL_SWEEP * i) / (DIAL_TICKS - 1);
    const major = i % 5 === 0;
    const [x1, y1] = _dial_pt(deg, major ? DIAL_TICK_R1 - 2 : DIAL_TICK_R1);
    const [x2, y2] = _dial_pt(deg, DIAL_TICK_R2);
    ticks.push(`<line class="tick${major ? ' major' : ''}" x1="${_dial_f(x1)}" y1="${_dial_f(y1)}" x2="${_dial_f(x2)}" y2="${_dial_f(y2)}"/>`);
  }
  const full = _dial_arc(DIAL_START, DIAL_START + DIAL_SWEEP, DIAL_R);
  const thumb = (cls) =>
    `<g class="thumb ${cls}" role="slider" tabindex="0" aria-orientation="vertical"><circle class="halo" r="26" cx="0" cy="0"/><circle class="knob" r="14" cx="0" cy="0"/></g>`;
  return `<svg viewBox="0 0 ${DIAL_SIZE} ${DIAL_SIZE}" aria-hidden="false">
  <defs>
    <linearGradient id="acha-dial-g${uid}" gradientUnits="userSpaceOnUse" x1="40" y1="280" x2="280" y2="40">
      <stop offset="0" class="s0"/><stop offset="1" class="s1"/>
    </linearGradient>
    <filter id="acha-dial-f${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <g class="ticks" aria-hidden="true">${ticks.join('')}</g>
  <path class="track" d="${full}" aria-hidden="true"/>
  <path class="glow" filter="url(#acha-dial-f${uid})" aria-hidden="true"/>
  <path class="prog" stroke="url(#acha-dial-g${uid})" aria-hidden="true"/>
  <g class="curg" aria-hidden="true"><circle class="cur-ring" r="7"/><circle class="cur" r="3.5"/></g>
  <path class="hit" d="${full}" aria-hidden="true"/>
  ${thumb('t0')}
  ${thumb('t1')}
</svg>`;
}

class AchaDial extends HTMLElement {
  constructor() {
    super();
    this._uid = ++_dial_uid;
    this._p = {
      value: null,
      min: 16,
      max: 30,
      step: 0.5,
      mode: 'off',
      color: null,
      disabled: false,
      current: null,
      low: null,
      high: null,
      dual: false,
      label: '',
      sublabel: '',
      unit: '°C',
      name: '',
    };
    this._shown = { value: null, low: null, high: null }; // what is drawn (tweened)
    this._tween = null;
    this._raf = 0;
    this._queued = false;
    this._drag = null;
    this._applied = {};
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onKey = this._onKey.bind(this);

    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${DIAL_CSS}</style>${_dial_svg(this._uid)}
<div class="center" aria-hidden="true">
  <div class="label"></div>
  <div class="sp"><span class="int">--</span><span class="dec"></span><span class="unit"></span></div>
  <div class="sp-dual"><span class="lo">--</span><span class="sep">–</span><span class="hi">--</span><span class="u"></span></div>
  <div class="sub"></div>
</div>`;
    const q = (s) => root.querySelector(s);
    this._el = {
      svg: q('svg'),
      ticks: Array.from(root.querySelectorAll('.tick')),
      prog: q('.prog'),
      glow: q('.glow'),
      cur: q('.curg'),
      hit: q('.hit'),
      t0: q('.t0'),
      t1: q('.t1'),
      label: q('.label'),
      int: q('.int'),
      dec: q('.dec'),
      unit: q('.unit'),
      lo: q('.lo'),
      hi: q('.hi'),
      u: q('.u'),
      sub: q('.sub'),
    };
    for (const el of [this._el.hit, this._el.t0, this._el.t1]) el.addEventListener('pointerdown', this._onDown);
    this._el.svg.addEventListener('pointermove', this._onMove);
    this._el.svg.addEventListener('pointerup', this._onUp);
    this._el.svg.addEventListener('pointercancel', this._onUp);
    this._el.svg.addEventListener('lostpointercapture', this._onUp);
    this._el.t0.addEventListener('keydown', this._onKey);
    this._el.t1.addEventListener('keydown', this._onKey);
  }

  // ---------------------------------------------------------------- props
  get value() { return this._p.value; }
  set value(v) { this._setNum('value', v); }
  get min() { return this._p.min; }
  set min(v) { const n = _dial_num(v); this._set('min', n === null ? 16 : n); }
  get max() { return this._p.max; }
  set max(v) { const n = _dial_num(v); this._set('max', n === null ? 30 : n); }
  get step() { return this._p.step; }
  set step(v) { const n = _dial_num(v); this._set('step', n && n > 0 ? n : 0.5); }
  get mode() { return this._p.mode; }
  set mode(v) { this._set('mode', v ? String(v) : 'off'); }
  get color() { return this._p.color; }
  set color(v) { this._set('color', v ? String(v) : null); }
  get disabled() { return this._p.disabled; }
  set disabled(v) { this._set('disabled', !!v); }
  get current() { return this._p.current; }
  set current(v) { this._set('current', _dial_num(v)); }
  get low() { return this._p.low; }
  set low(v) { this._setNum('low', v); }
  get high() { return this._p.high; }
  set high(v) { this._setNum('high', v); }
  get dual() { return this._p.dual; }
  set dual(v) { this._set('dual', !!v); }
  get label() { return this._p.label; }
  set label(v) { this._set('label', v === null || v === undefined ? '' : String(v)); }
  get sublabel() { return this._p.sublabel; }
  set sublabel(v) { this._set('sublabel', v === null || v === undefined ? '' : String(v)); }
  get unit() { return this._p.unit; }
  set unit(v) { this._set('unit', v === null || v === undefined ? '°C' : String(v)); }
  get name() { return this._p.name; }
  set name(v) { this._set('name', v === null || v === undefined ? '' : String(v)); }
  /** True while the user is dragging a thumb. */
  get dragging() { return !!this._drag; }

  _set(key, v) {
    if (this._p[key] === v) return;
    this._p[key] = v;
    this._schedule();
  }

  /** Setpoints coming from outside: ignored while dragging, tweened otherwise. */
  _setNum(key, v) {
    const n = _dial_num(v);
    if (this._p[key] === n) return;
    this._p[key] = n;
    if (this._drag) return;
    this._startTween();
    this._schedule();
  }

  _schedule() {
    if (this._queued) return;
    this._queued = true;
    queueMicrotask(() => {
      this._queued = false;
      this._render();
    });
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._tween = null;
    this._finishTween();
    this._drag = null;
  }

  // ---------------------------------------------------------------- geometry helpers
  _range() {
    let lo = this._p.min;
    let hi = this._p.max;
    if (lo > hi) [lo, hi] = [hi, lo];
    if (hi - lo < 1e-6) hi = lo + 1;
    return [lo, hi];
  }

  _angleOf(v) {
    const [lo, hi] = this._range();
    const k = clamp((Number(v) - lo) / (hi - lo), 0, 1);
    return DIAL_START + DIAL_SWEEP * k;
  }

  _valueOf(deg) {
    const [lo, hi] = this._range();
    const k = clamp((deg - DIAL_START) / DIAL_SWEEP, 0, 1);
    return clamp(roundToStep(lo + k * (hi - lo), this._p.step), lo, hi);
  }

  _snap(v) {
    const [lo, hi] = this._range();
    return clamp(roundToStep(v, this._p.step), lo, hi);
  }

  // ---------------------------------------------------------------- tween (arc + count-up number)
  _targets() {
    const [lo, hi] = this._range();
    const mid = (lo + hi) / 2;
    const p = this._p;
    return {
      value: p.value === null ? null : clamp(p.value, lo, hi),
      low: p.low === null ? null : clamp(p.low, lo, hi),
      high: p.high === null ? null : clamp(p.high, lo, hi),
      mid,
    };
  }

  _startTween() {
    const to = this._targets();
    const from = this._shown;
    const first = from.value === null && from.low === null && from.high === null;
    if (first || _dial_reduced() || !this.isConnected) {
      this._shown = { value: to.value, low: to.low, high: to.high };
      return;
    }
    const pick = (a, b) => (a === null ? b : a);
    this._tween = {
      t0: performance.now(),
      from: { value: pick(from.value, to.value), low: pick(from.low, to.low), high: pick(from.high, to.high) },
      to: { value: to.value, low: to.low, high: to.high },
    };
    if (!this._raf) this._raf = requestAnimationFrame((ts) => this._tick(ts));
  }

  _tick(ts) {
    this._raf = 0;
    const tw = this._tween;
    if (!tw) return;
    const k = clamp(((ts || performance.now()) - tw.t0) / DIAL_TWEEN_MS, 0, 1);
    const e = _dial_ease(k);
    const lerp = (a, b) => (a === null || b === null ? b : a + (b - a) * e);
    this._shown = { value: lerp(tw.from.value, tw.to.value), low: lerp(tw.from.low, tw.to.low), high: lerp(tw.from.high, tw.to.high) };
    this._render(true);
    if (k < 1) this._raf = requestAnimationFrame((t) => this._tick(t));
    else this._tween = null;
  }

  _finishTween() {
    const to = this._targets();
    this._shown = { value: to.value, low: to.low, high: to.high };
  }

  // ---------------------------------------------------------------- render (patch only)
  _render() {
    if (!this._tween && !this._drag) this._finishTween();
    const p = this._p;
    const el = this._el;
    const s = this._shown;
    const dual = p.dual && s.low !== null && s.high !== null;
    this.toggleAttribute('dual', dual);
    this.toggleAttribute('disabled', p.disabled);
    this.setAttribute('data-mode', p.mode);

    if (this._applied.color !== p.color) {
      this._applied.color = p.color;
      if (p.color) this.style.setProperty('--_d-accent', p.color);
      else this.style.removeProperty('--_d-accent');
    }

    // progress arc + glow
    let a0 = DIAL_START;
    let a1 = null;
    if (dual) {
      a0 = this._angleOf(s.low);
      a1 = this._angleOf(s.high);
    } else if (s.value !== null) a1 = this._angleOf(s.value);
    const d = a1 === null ? 'M 0 0' : _dial_arc(a0, a1, DIAL_R);
    if (this._applied.d !== d) {
      this._applied.d = d;
      el.prog.setAttribute('d', d);
      el.glow.setAttribute('d', d);
      el.prog.style.visibility = a1 === null ? 'hidden' : '';
      el.glow.style.visibility = a1 === null ? 'hidden' : '';
    }

    // lit ticks (only touch the ones whose state changed)
    const litA = a1 === null ? 1 : a0 - 0.01;
    const litB = a1 === null ? 0 : a1 + 0.01;
    for (let i = 0; i < el.ticks.length; i++) {
      const deg = DIAL_START + (DIAL_SWEEP * i) / (DIAL_TICKS - 1);
      const on = deg >= litA && deg <= litB;
      const tick = el.ticks[i];
      if (tick.__on !== on) {
        tick.__on = on;
        tick.classList.toggle('on', on);
      }
    }

    // thumbs
    const place = (g, deg) => {
      const [x, y] = _dial_pt(deg, DIAL_R);
      const tr = `translate(${_dial_f(x)} ${_dial_f(y)})`;
      if (g.__tr !== tr) {
        g.__tr = tr;
        g.setAttribute('transform', tr);
      }
    };
    const v0 = dual ? s.low : s.value;
    el.t0.toggleAttribute('hidden', v0 === null);
    if (v0 !== null) place(el.t0, this._angleOf(v0));
    el.t1.toggleAttribute('hidden', !dual);
    if (dual) place(el.t1, this._angleOf(s.high));

    // current temperature marker
    if (p.current === null) el.cur.style.display = 'none';
    else {
      el.cur.style.display = '';
      place(el.cur, this._angleOf(p.current));
    }

    // centre
    const step = p.step;
    const setText = (node, txt) => {
      const v = txt === null || txt === undefined ? '' : String(txt);
      if (node.textContent !== v) node.textContent = v;
    };
    setText(el.label, p.label);
    if (dual) {
      setText(el.lo, formatTemp(this._snap(s.low), step).text);
      setText(el.hi, formatTemp(this._snap(s.high), step).text);
      setText(el.u, p.unit);
    } else {
      const ft = formatTemp(s.value === null ? null : this._snap(s.value), step);
      setText(el.int, ft.int);
      setText(el.dec, ft.dec);
      setText(el.unit, s.value === null ? '' : p.unit);
    }
    if (this._applied.sub !== p.sublabel) {
      this._applied.sub = p.sublabel;
      el.sub.textContent = '';
      if (p.sublabel) {
        const icon = document.createElement('ha-icon');
        icon.setAttribute('icon', 'mdi:thermometer');
        const span = document.createElement('span');
        span.textContent = p.sublabel;
        el.sub.append(icon, span);
      }
    }

    // a11y
    const [lo, hi] = this._range();
    const aria = (g, val, which) => {
      const now = val === null ? '' : String(this._snap(val));
      const txt = val === null ? '--' : formatTemp(this._snap(val), step).text + ' ' + p.unit;
      const name = [p.name, which].filter(Boolean).join(' · ') || p.label || 'Setpoint';
      const attrs = {
        'aria-valuemin': String(lo),
        'aria-valuemax': String(hi),
        'aria-valuenow': now,
        'aria-valuetext': txt,
        'aria-label': name,
        'aria-disabled': p.disabled ? 'true' : 'false',
        tabindex: p.disabled ? '-1' : '0',
      };
      for (const k of Object.keys(attrs)) if (g.getAttribute(k) !== attrs[k]) g.setAttribute(k, attrs[k]);
    };
    aria(el.t0, v0, dual ? p.label + ' min' : '');
    if (dual) aria(el.t1, s.high, p.label + ' max');
  }

  // ---------------------------------------------------------------- pointer drag
  _degFromEvent(ev) {
    const rect = this._el.svg.getBoundingClientRect();
    if (!rect.width) return null;
    const scale = rect.width / DIAL_SIZE;
    const dx = (ev.clientX - rect.left) / scale - DIAL_C;
    const dy = (ev.clientY - rect.top) / scale - DIAL_C;
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // -180..180, 0 = top
    const end = DIAL_START + DIAL_SWEEP; // 135
    const last = this._drag ? this._drag.lastDeg : null;
    if (deg > end || deg < DIAL_START) {
      // inside the bottom gap: stick to the end we came from
      if (last !== null) deg = last > 0 ? end : DIAL_START;
      else deg = deg > 0 ? end : DIAL_START;
    } else if (last !== null && Math.abs(deg - last) > 180) deg = last > 0 ? end : DIAL_START;
    return deg;
  }

  _onDown(ev) {
    const p = this._p;
    if (p.disabled || !ev.isPrimary || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    const dual = p.dual && p.low !== null && p.high !== null;
    if (!dual && p.value === null) return;
    ev.preventDefault();
    this._tween = null;
    this._finishTween();
    const deg0 = this._degFromEvent(ev);
    if (deg0 === null) return;
    let which = 'value';
    if (dual) {
      if (ev.currentTarget === this._el.t0) which = 'low';
      else if (ev.currentTarget === this._el.t1) which = 'high';
      else {
        const dl = Math.abs(deg0 - this._angleOf(p.low));
        const dh = Math.abs(deg0 - this._angleOf(p.high));
        which = dl < dh || (dl === dh && deg0 < this._angleOf(p.low)) ? 'low' : 'high';
      }
    }
    this._drag = { id: ev.pointerId, which, start: { value: p.value, low: p.low, high: p.high }, lastDeg: null };
    try {
      this._el.svg.setPointerCapture(ev.pointerId);
    } catch (e) {
      /* capture unsupported */
    }
    const thumb = which === 'high' ? this._el.t1 : this._el.t0;
    thumb.classList.add('grab');
    this._dragTo(this._degFromEvent(ev));
  }

  _onMove(ev) {
    const d = this._drag;
    if (!d || ev.pointerId !== d.id) return;
    if (ev.cancelable) ev.preventDefault();
    const deg = this._degFromEvent(ev);
    if (deg !== null) this._dragTo(deg);
  }

  _dragTo(deg) {
    const d = this._drag;
    if (!d || deg === null) return;
    d.lastDeg = deg;
    const p = this._p;
    let v = this._valueOf(deg);
    if (d.which === 'low') v = Math.min(v, this._snap(p.high - p.step));
    if (d.which === 'high') v = Math.max(v, this._snap(p.low + p.step));
    if (p[d.which] === v) return;
    p[d.which] = v;
    this._shown[d.which] = v;
    try {
      if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(5);
    } catch (e) {
      /* no haptics */
    }
    this._render();
    this._emit('acha-input');
  }

  _onUp(ev) {
    const d = this._drag;
    if (!d || (ev && ev.pointerId !== d.id)) return;
    this._drag = null;
    try {
      if (this._el.svg.hasPointerCapture && this._el.svg.hasPointerCapture(d.id)) this._el.svg.releasePointerCapture(d.id);
    } catch (e) {
      /* already released */
    }
    this._el.t0.classList.remove('grab');
    this._el.t1.classList.remove('grab');
    const p = this._p;
    const changed = d.start.value !== p.value || d.start.low !== p.low || d.start.high !== p.high;
    if (changed) this._emit('acha-change');
  }

  // ---------------------------------------------------------------- keyboard
  _onKey(ev) {
    const p = this._p;
    if (p.disabled) return;
    const dual = p.dual && p.low !== null && p.high !== null;
    const which = ev.currentTarget === this._el.t1 ? 'high' : dual ? 'low' : 'value';
    const cur = p[which];
    if (cur === null) return;
    const [lo, hi] = this._range();
    let next = null;
    switch (ev.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        next = cur + p.step;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        next = cur - p.step;
        break;
      case 'PageUp':
        next = cur + p.step * 4;
        break;
      case 'PageDown':
        next = cur - p.step * 4;
        break;
      case 'Home':
        next = lo;
        break;
      case 'End':
        next = hi;
        break;
      default:
        return;
    }
    ev.preventDefault();
    next = this._snap(next);
    if (which === 'low') next = Math.min(next, this._snap(p.high - p.step));
    if (which === 'high') next = Math.max(next, this._snap(p.low + p.step));
    if (next === cur) return;
    p[which] = next;
    this._startTween();
    this._render();
    this._emit('acha-input');
    this._emit('acha-change');
  }

  _emit(type) {
    const p = this._p;
    const dual = p.dual && p.low !== null && p.high !== null;
    fireEvent(this, type, dual ? { low: p.low, high: p.high } : { value: p.value });
  }
}

if (!customElements.get('acha-dial')) customElements.define('acha-dial', AchaDial);

// ===== src/unit.js =====
// acha-unit — SVG wall-mounted indoor unit + airflow animation.
// Props: mode, on, fan (0..1), swingV, swingH, color, special ('boost'|'eco'|'streamer'|null).
// Built once; updates only patch classes and CSS custom properties.

const UNIT_MODES = ['cool', 'heat', 'heat_cool', 'auto', 'dry', 'fan_only', 'off'];
const UNIT_SPECIALS = ['boost', 'eco', 'streamer'];

const UNIT_CSS = `
:host {
  display: block;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  --_u-accent: var(--acha-accent, #3fa9f5);
  --_u-text: var(--acha-text, #f3f5f8);
  /* the unit itself is a physical, pearl-white object in both themes; overridable */
  --_u-body: var(--acha-unit-body, #eef1f5);
  --_u-line: var(--acha-unit-line, rgba(20,26,36,.2));
  --acha-flow-speed: 1;
  --acha-flow-opacity: 0;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.wrap { position: relative; width: 100%; aspect-ratio: 360 / 216; }
svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; display: block; }

/* ---------- body ---------- */
.body-base { fill: var(--_u-body); transition: fill .6s ease; }
.body-edge { fill: none; stroke: var(--_u-line); stroke-width: 1; opacity: .55; }
.body-sheen { pointer-events: none; }
.grille line { stroke: var(--_u-line); stroke-width: 1.1; stroke-linecap: round; }
.seam { stroke: var(--_u-line); stroke-width: .9; opacity: .7; }
.mouth { fill: url(#acha-u-mouth); }
.mouth-shadow { fill: rgba(0,0,0,.28); }
.underglow { fill: var(--_u-accent); opacity: 0; transition: opacity 1.2s ease, fill .6s ease; }
:host([data-on]) .underglow { opacity: .55; }

/* status LED */
.led { fill: var(--_u-line); opacity: 1; transition: fill .6s ease, opacity .6s ease; }
.led-halo { fill: var(--_u-accent); opacity: 0; transition: opacity .6s ease, fill .6s ease; }
:host([data-on]) .led { fill: var(--_u-accent); opacity: 1; }
:host([data-on]) .led-halo { opacity: .5; animation: acha-unit-led 3.2s ease-in-out infinite; }
@keyframes acha-unit-led { 0%,100% { opacity: .18; } 50% { opacity: .6; } }

/* display: tiny mode glyph + special badges */
.badge { opacity: 0; transform: translateY(2px); transition: opacity .6s ease, transform .6s ease; transform-box: fill-box; transform-origin: center; }
:host([data-special="eco"][data-on]) .badge-eco,
:host([data-special="boost"][data-on]) .badge-boost,
:host([data-special="streamer"][data-on]) .badge-streamer { opacity: 1; transform: none; }
.badge-eco path { fill: #4cc38a; }
.badge-boost path { fill: #ffb547; }
.badge-streamer circle { fill: #7cc7ff; }
.glint { fill: #fff; opacity: 0; transform-box: fill-box; transform-origin: center; }
:host([data-special="boost"][data-on]) .glint { animation: acha-unit-glint 2.6s ease-in-out infinite; }
@keyframes acha-unit-glint {
  0%, 62%, 100% { opacity: 0; transform: scale(.3) rotate(0deg); }
  72% { opacity: .95; transform: scale(1) rotate(45deg); }
  84% { opacity: 0; transform: scale(.4) rotate(90deg); }
}

/* ---------- louver (front view: blade drops & tilts, dark outlet appears) ---------- */
.mouth { transform-box: fill-box; transform-origin: 50% 0%; transform: scaleY(0); transition: transform .8s cubic-bezier(.3,.7,.2,1); }
:host([data-on]) .mouth { transform: scaleY(1); }
.flap-swing { transform-box: view-box; transform-origin: 180px 84px; }
.flap {
  transform-box: view-box; transform-origin: 180px 70px;
  transform: translateY(0) scaleY(1);
  transition: transform .8s cubic-bezier(.3,.7,.2,1);
}
:host([data-on]) .flap { transform: translateY(14px) scaleY(.62); }
.flap-face { fill: var(--_u-body); transition: fill .6s ease; }
.flap-shade { fill: rgba(0,0,0,.16); opacity: 0; transition: opacity .8s ease; }
:host([data-on]) .flap-shade { opacity: 1; }
.flap-lip { stroke: var(--_u-line); stroke-width: .8; fill: none; opacity: .8; }
:host([data-on][data-swing-v]) .flap-swing { animation: acha-unit-flap 7s ease-in-out infinite; }
@keyframes acha-unit-flap {
  0%, 100% { transform: none; }
  25% { transform: translateY(-2px) scaleY(.8); }
  75% { transform: translateY(3px) scaleY(1.2); }
}

/* ---------- airflow ---------- */
.air { opacity: 0; transition: opacity 1.2s ease; }
:host([data-on]) .air { opacity: var(--acha-flow-opacity); }
.cone { fill: url(#acha-u-cone); opacity: .55; transform-box: view-box; transform-origin: 180px 92px; }
:host([data-on]) .cone { animation: acha-unit-breathe 5.5s ease-in-out infinite; }
@keyframes acha-unit-breathe { 0%,100% { opacity: .38; transform: scaleY(.94); } 50% { opacity: .62; transform: scaleY(1.03); } }
.stop-a { stop-color: var(--_u-accent); transition: stop-color .6s ease; }
.sway-h { transform-box: view-box; transform-origin: 180px 90px; }
.sway-v { transform-box: view-box; transform-origin: 180px 90px; }
:host([data-on][data-swing-h]) .sway-h { animation: acha-unit-sway-h 9s ease-in-out infinite; }
:host([data-on][data-swing-v]) .sway-v { animation: acha-unit-sway-v 7s ease-in-out infinite; }
@keyframes acha-unit-sway-h { 0%,100% { transform: none; } 25% { transform: skewX(-13deg); } 75% { transform: skewX(13deg); } }
@keyframes acha-unit-sway-v { 0%,100% { transform: none; } 25% { transform: scaleY(.84); } 75% { transform: scaleY(1.08); } }

.stream {
  fill: none; stroke: url(#acha-u-stream); stroke-linecap: round;
  stroke-width: var(--w, 1.6);
  stroke-dasharray: var(--da, 18) var(--gap, 34);
  stroke-dashoffset: 0;
  opacity: var(--o, .8);
  animation: acha-unit-flow calc(var(--du, 3s) / var(--acha-flow-speed)) linear infinite;
  animation-delay: var(--dl, 0s);
}
.stream.ghost { stroke-dasharray: none; opacity: calc(var(--o, .8) * .16); animation: none; }
@keyframes acha-unit-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: calc(var(--period, 52) * -1px); } }
:host([data-special="boost"][data-on]) .stream { stroke-width: calc(var(--w, 1.6) * 1.25); }

/* ---------- mode effects ---------- */
.fx { opacity: 0; transition: opacity 1.1s ease; }
.fx.on { opacity: 1; }
.fx.half { opacity: .55; }
.fx:not(.run) *, .air:not(.run) *, .air:not(.run) { animation-play-state: paused !important; }
.p { transform-box: fill-box; transform-origin: center; animation-delay: var(--dl, 0s); animation-iteration-count: infinite; }

.snow path { stroke: #e9f6ff; stroke-width: .9; stroke-linecap: round; fill: none; }
.snow circle { fill: #ffffff; }
.snow { animation-name: acha-unit-snow; animation-duration: calc(var(--du, 6s) / var(--acha-flow-speed)); animation-timing-function: linear; }
@keyframes acha-unit-snow {
  0% { opacity: 0; transform: translate(0, 0) rotate(0deg) scale(.6); }
  15% { opacity: .95; }
  70% { opacity: .7; }
  100% { opacity: 0; transform: translate(calc(var(--dx, 0) * 1px), 92px) rotate(160deg) scale(1); }
}

.shimmer path { fill: none; stroke: #ffb27a; stroke-width: 1.3; stroke-linecap: round; }
.shimmer { animation-name: acha-unit-rise; animation-duration: var(--du, 4.5s); animation-timing-function: ease-in-out; }
@keyframes acha-unit-rise {
  0% { opacity: 0; transform: translate(0, 0) scaleX(.7); }
  25% { opacity: .75; }
  60% { opacity: .5; transform: translate(calc(var(--dx, 0) * .5px), -30px) scaleX(1.1); }
  100% { opacity: 0; transform: translate(calc(var(--dx, 0) * 1px), -56px) scaleX(.8); }
}
.heat-haze { fill: url(#acha-u-warm); opacity: 0; transition: opacity 1.1s ease; }
.fx-heat.on .heat-haze, .fx-heat.half .heat-haze { opacity: 1; }

.drop path { fill: #8fe3da; }
.drop { animation-name: acha-unit-drop; animation-duration: var(--du, 3.8s); animation-timing-function: cubic-bezier(.5,0,.8,.6); }
@keyframes acha-unit-drop {
  0% { opacity: 0; transform: translate(0, -4px) scale(.4); }
  18% { opacity: .9; transform: translate(0, 0) scale(1); }
  85% { opacity: .65; }
  100% { opacity: 0; transform: translate(0, 84px) scale(.85, 1.1); }
}

.swirl { fill: none; stroke: var(--_u-text); stroke-opacity: .3; stroke-width: 1.1; stroke-linecap: round;
  stroke-dasharray: 46 210; animation-name: acha-unit-swirl; animation-duration: calc(var(--du, 4s) / var(--acha-flow-speed)); animation-timing-function: linear; }
@keyframes acha-unit-swirl { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -256; } }

.ion { fill: #8fd0ff; animation-name: acha-unit-ion; animation-duration: var(--du, 3s); animation-timing-function: ease-in-out; }
@keyframes acha-unit-ion {
  0%, 100% { opacity: 0; transform: translate(0, 0) scale(.5); }
  45% { opacity: .85; transform: translate(calc(var(--dx, 0) * .5px), 14px) scale(1); }
  80% { opacity: 0; transform: translate(calc(var(--dx, 0) * 1px), 30px) scale(.6); }
}

:host([data-off-instant]) .air, :host([data-off-instant]) .fx { transition: none; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; }
  .flap, .mouth { transition-duration: .2s; }
  .stream { stroke-dasharray: none; opacity: calc(var(--o, .8) * .45); }
  .p { opacity: 0 !important; }
}
`;

// Deterministic PRNG so the illustration is identical on every render/instance.
function _unit_rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _unit_clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function _unit_f(n) { return Math.round(n * 100) / 100; }

// Airflow fountain: 9 streams leaving the louver and flaring gently outward.
function _unit_streamsSvg() {
  const r = _unit_rng(7);
  const ghosts = [];
  const live = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const t = (i - (N - 1) / 2) / ((N - 1) / 2); // -1..1
    const a = Math.abs(t);
    const x0 = 180 + t * 118;
    const y0 = 93;
    const x1 = 180 + t * 172 + (r() - 0.5) * 8;
    const y1 = 208 - a * 30;
    const wob = (i % 2 ? 1 : -1) * (5 + r() * 4);
    const c1x = x0 + t * 6 + wob;
    const c1y = y0 + 38;
    const c2x = x1 - t * 26 - wob * 0.6;
    const c2y = y1 - 46;
    const d = `M${_unit_f(x0)} ${y0} C${_unit_f(c1x)} ${c1y} ${_unit_f(c2x)} ${_unit_f(c2y)} ${_unit_f(x1)} ${_unit_f(y1)}`;
    const da = Math.round(26 + r() * 16);
    const gap = Math.round(46 + r() * 22);
    const du = _unit_f(3.2 + r() * 1.4);
    const dl = _unit_f(-r() * du);
    const w = _unit_f(1.25 + (1 - a) * 0.6 + r() * 0.2);
    const o = _unit_f(0.5 + (1 - a) * 0.45);
    ghosts.push(`<path class="stream ghost" d="${d}" style="--w:${w};--o:${o}"/>`);
    live.push(`<path class="stream" d="${d}" style="--w:${w};--o:${o};--da:${da};--gap:${gap};--period:${da + gap};--du:${du}s;--dl:${dl}s"/>`);
    // a finer companion strand, offset in phase, for depth
    if (i < N - 1) {
      const tm = t + 1 / ((N - 1) / 2) / 2;
      const am = Math.abs(tm);
      const mx0 = 180 + tm * 118;
      const mx1 = 180 + tm * 168;
      const my1 = 196 - am * 28;
      const md = `M${_unit_f(mx0)} ${y0 + 2} C${_unit_f(mx0 + tm * 4)} ${y0 + 34} ${_unit_f(mx1 - tm * 22)} ${_unit_f(my1 - 40)} ${_unit_f(mx1)} ${_unit_f(my1)}`;
      const mda = Math.round(12 + r() * 10);
      const mgap = Math.round(52 + r() * 24);
      const mdu = _unit_f(4 + r() * 1.6);
      live.push(`<path class="stream" d="${md}" style="--w:.8;--o:${_unit_f(0.28 + (1 - am) * 0.2)};--da:${mda};--gap:${mgap};--period:${mda + mgap};--du:${mdu}s;--dl:${_unit_f(-r() * mdu)}s"/>`);
    }
  }
  return `<g class="ghosts">${ghosts.join('')}</g><g class="live">${live.join('')}</g>`;
}

const UNIT_FLAKE = 'M-3 0H3M-1.5-2.6L1.5 2.6M-1.5 2.6L1.5-2.6';
const UNIT_DROP = 'M0-3.4C1.7-.9 2.5.4 2.5 1.4A2.5 2.5 0 0 1-2.5 1.4C-2.5.4-1.7-.9 0-3.4Z';
const UNIT_WAVE = 'M-12 0q3-3.2 6 0t6 0t6 0t6 0';

function _unit_particlesSvg() {
  const r = _unit_rng(23);
  const pos = (x, y, s) => `transform="translate(${_unit_f(x)} ${_unit_f(y)}) scale(${_unit_f(s)})"`;

  // cool: ice sparkles drifting down & outward
  let snow = '';
  for (let i = 0; i < 13; i++) {
    const x = 66 + r() * 228;
    const y = 96 + r() * 14;
    const dx = (x - 180) * 0.32 + (r() - 0.5) * 18;
    const du = _unit_f(5.2 + r() * 3);
    const shape = i % 3 === 2 ? '<circle r="1"/>' : `<path d="${UNIT_FLAKE}"/>`;
    snow += `<g ${pos(x, y, 0.65 + r() * 0.6)}><g class="p snow" style="--dx:${_unit_f(dx)};--du:${du}s;--dl:${_unit_f(-r() * du)}s">${shape}</g></g>`;
  }

  // heat: warm shimmer lines rising through the flow
  let heat = '<rect class="heat-haze" x="20" y="86" width="320" height="130"/>';
  for (let i = 0; i < 8; i++) {
    const x = 78 + r() * 204;
    const y = 160 + r() * 40;
    const du = _unit_f(4 + r() * 2.4);
    heat += `<g ${pos(x, y, 0.7 + r() * 0.5)}><g class="p shimmer" style="--dx:${_unit_f((r() - 0.5) * 16)};--du:${du}s;--dl:${_unit_f(-r() * du)}s"><path d="${UNIT_WAVE}"/></g></g>`;
  }

  // dry: soft droplets falling
  let dry = '';
  for (let i = 0; i < 8; i++) {
    const x = 78 + r() * 204;
    const y = 98 + r() * 12;
    const du = _unit_f(3.4 + r() * 1.8);
    dry += `<g ${pos(x, y, 0.6 + r() * 0.45)}><g class="p drop" style="--du:${du}s;--dl:${_unit_f(-r() * du)}s"><path d="${UNIT_DROP}"/></g></g>`;
  }

  // fan_only: neutral wind gusts sweeping across the flow, each ending in a soft curl
  let fan = '';
  [[118, 1], [142, -1], [166, 1], [188, -1]].forEach(([y, s], i) => {
    const x = s > 0 ? 70 + r() * 30 : 290 - r() * 30;
    const L = 150 + r() * 40;
    const d = `M${_unit_f(x)} ${y}c${_unit_f(s * L * 0.3)} -7 ${_unit_f(s * L * 0.55)} 7 ${_unit_f(s * L * 0.82)} 0`
      + `s${_unit_f(s * L * 0.18)} -11 ${_unit_f(s * 4)} -13a5 5 0 0 ${s > 0 ? 0 : 1} ${_unit_f(-s * 5)} 6`;
    const du = _unit_f(4.6 + r() * 1.8);
    fan += `<path class="p swirl" d="${d}" style="--du:${du}s;--dl:${_unit_f(-i * 1.3 - r())}s"/>`;
  });

  // streamer: faint blue ions twinkling in the stream
  let ions = '';
  for (let i = 0; i < 12; i++) {
    const x = 70 + r() * 220;
    const y = 100 + r() * 60;
    const du = _unit_f(2.4 + r() * 2);
    ions += `<g ${pos(x, y, 1)}><circle class="p ion" r="${_unit_f(0.7 + r() * 0.8)}" style="--dx:${_unit_f((x - 180) * 0.12)};--du:${du}s;--dl:${_unit_f(-r() * du)}s"/></g>`;
  }

  return `<g class="fx fx-cool">${snow}</g><g class="fx fx-heat">${heat}</g><g class="fx fx-dry">${dry}</g>`
    + `<g class="fx fx-fan">${fan}</g><g class="fx fx-ion">${ions}</g>`;
}

function _unit_svg() {
  const grille = [17, 20.5, 24].map((y) => `<line x1="58" y1="${y}" x2="302" y2="${y}"/>`).join('');
  return `
<svg viewBox="0 0 360 216" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="acha-u-sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".55"/>
      <stop offset=".42" stop-color="#fff" stop-opacity=".08"/>
      <stop offset=".78" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".14"/>
    </linearGradient>
    <linearGradient id="acha-u-side" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".10"/>
      <stop offset=".12" stop-color="#000" stop-opacity="0"/>
      <stop offset=".88" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".10"/>
    </linearGradient>
    <linearGradient id="acha-u-grille" gradientUnits="userSpaceOnUse" x1="58" y1="0" x2="302" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".2" stop-color="#fff" stop-opacity="1"/>
      <stop offset=".8" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="acha-u-grille-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="40"><rect x="0" y="0" width="360" height="40" fill="url(#acha-u-grille)"/></mask>
    <linearGradient id="acha-u-stream" gradientUnits="userSpaceOnUse" x1="0" y1="88" x2="0" y2="212">
      <stop class="stop-a" offset="0" stop-opacity=".95"/>
      <stop class="stop-a" offset=".45" stop-opacity=".55"/>
      <stop class="stop-a" offset="1" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="acha-u-cone" gradientUnits="userSpaceOnUse" cx="180" cy="88" r="128"
      gradientTransform="translate(180 88) scale(1.25 1) translate(-180 -88)">
      <stop class="stop-a" offset="0" stop-opacity=".34"/>
      <stop class="stop-a" offset=".5" stop-opacity=".12"/>
      <stop class="stop-a" offset="1" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="acha-u-warm" gradientUnits="userSpaceOnUse" cx="180" cy="200" r="130"
      gradientTransform="translate(180 200) scale(1.3 .8) translate(-180 -200)">
      <stop offset="0" stop-color="#ff8a3d" stop-opacity=".22"/>
      <stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="acha-u-mouth" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d1015" stop-opacity=".55"/>
      <stop offset="1" stop-color="#0d1015" stop-opacity=".22"/>
    </linearGradient>
    <filter id="acha-u-blur8" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="acha-u-blur3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <clipPath id="acha-u-body-clip"><rect x="24" y="10" width="312" height="74" rx="20"/></clipPath>
  </defs>

  <!-- wall shadow -->
  <rect x="34" y="22" width="292" height="66" rx="20" fill="#000" opacity=".22" filter="url(#acha-u-blur8)"/>

  <!-- airflow -->
  <g class="air">
    <rect class="cone" x="10" y="86" width="340" height="130"/>
    <g class="sway-h"><g class="sway-v">${_unit_streamsSvg()}</g></g>
  </g>
  ${_unit_particlesSvg()}
  <ellipse class="underglow" cx="180" cy="90" rx="118" ry="6" filter="url(#acha-u-blur8)"/>

  <!-- body -->
  <g class="unit">
    <rect class="body-base" x="24" y="10" width="312" height="74" rx="20"/>
    <g clip-path="url(#acha-u-body-clip)">
      <rect x="24" y="10" width="312" height="74" fill="url(#acha-u-sheen)"/>
      <rect x="24" y="10" width="312" height="74" fill="url(#acha-u-side)"/>
      <g class="grille" mask="url(#acha-u-grille-mask)">${grille}</g>
      <line class="seam" x1="30" y1="62.5" x2="330" y2="62.5"/>
      <rect class="mouth-shadow" x="38" y="69" width="284" height="15" rx="7"/>
      <rect class="mouth" x="40" y="70" width="280" height="12" rx="6"/>
    </g>
    <rect class="body-edge" x="24.5" y="10.5" width="311" height="73" rx="19.5"/>

    <!-- display -->
    <circle class="led-halo" cx="306" cy="45" r="5" filter="url(#acha-u-blur3)"/>
    <circle class="led" cx="306" cy="45" r="1.9"/>
    <g transform="translate(294 45)"><g class="badge badge-eco"><path d="M3.2-3.4C-1.6-3.6-3.6-.6-3 2.6l-.9 1 .6.5.9-1C.9 3.7 3.8 1.2 3.2-3.4ZM-1.8 2.2C-.6.2.6-.9 2-1.8-.2-.6-1.2.6-1.8 2.2Z"/></g></g>
    <g transform="translate(294 45)"><g class="badge badge-boost"><path d="M.9-4.2-3 .7h2.4L-1.1 4.2 3 -.9H.6Z"/></g></g>
    <g transform="translate(293 45)"><g class="badge badge-streamer"><circle cx="-2.6" cy="0" r=".9"/><circle cx="0" cy="-1.4" r="1.1"/><circle cx="2.6" cy=".4" r=".9"/></g></g>
    <path class="glint" d="M316 16.5l1.1 3.4 3.4 1.1-3.4 1.1-1.1 3.4-1.1-3.4-3.4-1.1 3.4-1.1Z"/>

    <!-- louver -->
    <g class="flap-swing"><g class="flap">
      <rect class="flap-face" x="38" y="69.5" width="284" height="13" rx="6.5"/>
      <rect class="flap-shade" x="38" y="76" width="284" height="6.5" rx="3.25"/>
      <rect x="38" y="69.5" width="284" height="13" rx="6.5" fill="url(#acha-u-sheen)" opacity=".6"/>
      <rect class="flap-lip" x="38.5" y="70" width="283" height="12" rx="6"/>
    </g></g>
  </g>
</svg>`;
}

class AchaUnit extends HTMLElement {
  constructor() {
    super();
    this._mode = 'off';
    this._on = false;
    this._fan = 0.5;
    this._swingV = false;
    this._swingH = false;
    this._color = null;
    this._special = null;
    this._queued = false;
    this._idleTimers = new Map();
    this._applied = {};
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${UNIT_CSS}</style><div class="wrap" part="unit">${_unit_svg()}</div>`;
    this._air = root.querySelector('.air');
    this._fx = {
      cool: root.querySelector('.fx-cool'),
      heat: root.querySelector('.fx-heat'),
      dry: root.querySelector('.fx-dry'),
      fan: root.querySelector('.fx-fan'),
      ion: root.querySelector('.fx-ion'),
    };
  }

  // ---- public props ----
  get mode() { return this._mode; }
  set mode(v) { this._set('_mode', String(v == null ? 'off' : v).toLowerCase().trim()); }
  get on() { return this._on; }
  set on(v) { this._set('_on', !!v); }
  get fan() { return this._fan; }
  set fan(v) {
    const n = v == null || v === '' ? NaN : Number(v);
    this._set('_fan', Number.isFinite(n) ? _unit_clamp(n, 0, 1) : 0.5);
  }
  get swingV() { return this._swingV; }
  set swingV(v) { this._set('_swingV', !!v); }
  get swingH() { return this._swingH; }
  set swingH(v) { this._set('_swingH', !!v); }
  get color() { return this._color; }
  set color(v) { this._set('_color', v ? String(v) : null); }
  get special() { return this._special; }
  set special(v) {
    const s = v ? String(v).toLowerCase() : null;
    this._set('_special', UNIT_SPECIALS.includes(s) ? s : null);
  }

  connectedCallback() {
    this.setAttribute('aria-hidden', 'true');
    this._render();
  }

  disconnectedCallback() {
    this._idleTimers.forEach((id) => clearTimeout(id));
    this._idleTimers.clear();
    // freeze everything while detached; re-armed on next render
    Object.values(this._fx).forEach((g) => g.classList.remove('run'));
    this._air.classList.remove('run');
    this._applied = {};
  }

  _set(key, value) {
    if (this[key] === value) return;
    this[key] = value;
    if (this._queued) return;
    this._queued = true;
    queueMicrotask(() => { this._queued = false; this._render(); });
  }

  _render() {
    const raw = this._mode;
    const m = UNIT_MODES.includes(raw) ? raw : 'fan_only';
    const on = this._on && m !== 'off';
    const special = on ? this._special : null;

    this.toggleAttribute('data-on', on);
    this.setAttribute('data-mode', on ? m : 'off');
    if (special) this.setAttribute('data-special', special); else this.removeAttribute('data-special');
    this.toggleAttribute('data-swing-v', on && this._swingV);
    this.toggleAttribute('data-swing-h', on && this._swingH);

    if (this._applied.color !== this._color) {
      if (this._color) this.style.setProperty('--_u-accent', this._color);
      else this.style.removeProperty('--_u-accent');
      this._applied.color = this._color;
    }

    // fan 0..1 → flow speed multiplier and stream opacity
    const f = this._fan;
    let speed = 0.55 + f * 1.15;
    let opacity = 0.34 + f * 0.56;
    if (special === 'boost') { speed *= 1.45; opacity = Math.min(1, opacity + 0.12); }
    else if (special === 'eco') { speed *= 0.8; opacity *= 0.85; }
    speed = _unit_f(speed);
    opacity = _unit_f(on ? opacity : 0);
    // avoid re-timing running animations for imperceptible changes (it makes dashes jump)
    if (this._applied.speed == null || Math.abs(this._applied.speed - speed) >= 0.03) {
      this.style.setProperty('--acha-flow-speed', String(speed));
      this._applied.speed = speed;
    }
    if (this._applied.opacity !== opacity) {
      this.style.setProperty('--acha-flow-opacity', String(opacity));
      this._applied.opacity = opacity;
    }

    const blend = m === 'heat_cool' || m === 'auto';
    this._activate(this._air, on ? 'on' : '');
    this._activate(this._fx.cool, !on ? '' : m === 'cool' ? 'on' : blend ? 'half' : '');
    this._activate(this._fx.heat, !on ? '' : m === 'heat' ? 'on' : blend ? 'half' : '');
    this._activate(this._fx.dry, on && m === 'dry' ? 'on' : '');
    this._activate(this._fx.fan, on && m === 'fan_only' ? 'on' : '');
    this._activate(this._fx.ion, special === 'streamer' ? 'on' : '');
  }

  // Shows/hides a layer with a fade; its animations keep running through the
  // fade-out and are paused afterwards so hidden layers cost nothing.
  _activate(el, state) {
    if (!el) return;
    const t = this._idleTimers.get(el);
    if (state) {
      if (t) { clearTimeout(t); this._idleTimers.delete(el); }
      el.classList.add('run');
      el.classList.toggle('on', state === 'on');
      el.classList.toggle('half', state === 'half');
      return;
    }
    el.classList.remove('on', 'half');
    if (el.classList.contains('run') && !t) {
      this._idleTimers.set(el, setTimeout(() => {
        this._idleTimers.delete(el);
        el.classList.remove('run');
      }, 1400));
    }
  }
}

if (!customElements.get('acha-unit')) customElements.define('acha-unit', AchaUnit);

// ===== src/sheet.js =====
// acha-sheet — animated bottom-sheet option picker.
// API: sheet.open(title, options:[{value,label,icon,color?,description?}], selected, {layout:'grid'|'list'})
//      → Promise<value|null>. Closes (resolves null) on backdrop tap, Esc, close button or drag-down.
// Lives inside acha-panel as `position:absolute; inset:0` (see ARCHITECTURE "Overlay rule").

const ACHA_SHEET_CSS = `
:host {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: block;
  pointer-events: none;
  visibility: hidden;
  contain: layout style;
  font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, system-ui));
  -webkit-tap-highlight-color: transparent;
  --_sheet-accent: var(--acha-accent, #3fa9f5);
  --_sheet-text: var(--acha-text, #f5f7fa);
  --_sheet-muted: var(--acha-muted, rgba(235, 240, 250, .62));
  --_sheet-surface: var(--acha-surface, rgba(255, 255, 255, .06));
  --_sheet-surface-strong: var(--acha-surface-strong, rgba(255, 255, 255, .12));
  --_sheet-border: var(--acha-border, rgba(255, 255, 255, .10));
  --_sheet-radius: var(--acha-radius, 28px);
  --_sheet-spring: cubic-bezier(.2, .9, .25, 1.15);
  --_sheet-out: cubic-bezier(.4, 0, .9, .6);
}
:host([data-state="opening"]),
:host([data-state="open"]),
:host([data-state="closing"]) {
  visibility: visible;
}
:host([data-state="opening"]),
:host([data-state="open"]) {
  pointer-events: auto;
}

.backdrop {
  position: absolute;
  inset: 0;
  background: var(--acha-sheet-backdrop, rgba(4, 6, 10, .46));
  -webkit-backdrop-filter: blur(6px) saturate(120%);
  backdrop-filter: blur(6px) saturate(120%);
  opacity: 0;
  transition: opacity 280ms ease;
  border-radius: inherit;
}
:host([data-state="opening"]) .backdrop,
:host([data-state="open"]) .backdrop { opacity: 1; }
:host([data-state="closing"]) .backdrop { opacity: 0; transition-duration: 220ms; }

.sheet {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  max-height: calc(100% - 40px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--_sheet-text);
  background: var(--acha-sheet-bg, var(--acha-bg, rgba(22, 25, 33, .94)));
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  backdrop-filter: blur(28px) saturate(160%);
  border: 1px solid var(--_sheet-border);
  border-radius: calc(var(--_sheet-radius) - 4px);
  box-shadow: var(--acha-shadow, 0 -8px 40px rgba(0, 0, 0, .35)), 0 -1px 0 rgba(255, 255, 255, .04) inset;
  transform: translate3d(0, calc(100% + 16px), 0);
  transition: transform 520ms var(--_sheet-spring);
  will-change: transform;
  outline: none;
  overflow: hidden;
}
:host([data-state="opening"]) .sheet,
:host([data-state="open"]) .sheet { transform: translate3d(0, var(--_sheet-drag, 0px), 0); }
:host([data-state="closing"]) .sheet {
  transform: translate3d(0, calc(100% + 16px), 0);
  transition: transform 260ms var(--_sheet-out);
}
.sheet.dragging { transition: none !important; }

.grab {
  flex: none;
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
  cursor: grab;
  touch-action: none;
}
.grab::before {
  content: "";
  width: 40px;
  height: 5px;
  border-radius: 3px;
  background: var(--_sheet-muted);
  opacity: .55;
  transition: opacity 160ms ease, width 200ms var(--_sheet-spring);
}
.grab:hover::before, .sheet.dragging .grab::before { opacity: .85; width: 48px; }

.head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 12px 10px 20px;
  touch-action: none;
}
.title {
  flex: 1;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -.01em;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.close {
  flex: none;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: var(--_sheet-muted);
  background: var(--_sheet-surface);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, transform 160ms ease;
  --mdc-icon-size: 20px;
}
.close:hover { background: var(--_sheet-surface-strong); color: var(--_sheet-text); }
.close:active { transform: scale(.92); }
.close:focus-visible, .opt:focus-visible {
  outline: 2px solid var(--_sheet-accent);
  outline-offset: 2px;
}

.body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 4px 14px calc(16px + env(safe-area-inset-bottom, 0px));
  scrollbar-width: thin;
}
.options { display: grid; gap: 10px; margin: 0; padding: 0; }
.options.grid { grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); }
.options.list { grid-template-columns: 1fr; gap: 6px; }

.opt {
  --_c: var(--opt-color, var(--_sheet-accent));
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  margin: 0;
  padding: 10px 14px 10px 10px;
  box-sizing: border-box;
  border: 1px solid var(--_sheet-border);
  border-radius: 18px;
  color: var(--_sheet-text);
  background: var(--_sheet-surface);
  font: inherit;
  font-size: 15px;
  text-align: start;
  cursor: pointer;
  overflow: hidden;
  transition: background 220ms ease, border-color 220ms ease, color 220ms ease, box-shadow 220ms ease,
    transform 160ms ease;
}
:host([data-state="opening"]) .opt,
:host([data-state="open"]) .opt {
  animation: acha-sheet-in 420ms var(--_sheet-spring) backwards;
  animation-delay: calc(60ms + var(--i, 0) * 28ms);
}
.options.grid .opt {
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-height: 96px;
  padding: 14px 10px 12px;
  text-align: center;
}
.opt:hover { background: var(--_sheet-surface-strong); }
.opt:active { transform: scale(.96); }
.opt[aria-checked="true"] {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(140deg, color-mix(in srgb, var(--_c), #fff 16%), var(--_c));
  background-color: var(--_c);
  box-shadow: 0 8px 24px -8px var(--_c), 0 1px 0 rgba(255, 255, 255, .22) inset;
}

.bubble {
  flex: none;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--_c);
  background: color-mix(in srgb, var(--_c) 18%, transparent);
  transition: background 220ms ease, color 220ms ease, transform 300ms var(--_sheet-spring);
  --mdc-icon-size: 22px;
}
.options.grid .bubble { width: 46px; height: 46px; --mdc-icon-size: 24px; }
.opt[aria-checked="true"] .bubble { color: #fff; background: rgba(255, 255, 255, .22); transform: scale(1.04); }

.txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.lbl {
  font-weight: 500;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.options.grid .lbl { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.desc { font-size: 12px; color: var(--_sheet-muted); line-height: 1.25; }
.opt[aria-checked="true"] .desc { color: rgba(255, 255, 255, .78); }
.options.grid .desc { display: none; }

.check {
  flex: none;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--_c);
  background: #fff;
  opacity: 0;
  transform: scale(.4);
  transition: opacity 180ms ease, transform 320ms var(--_sheet-spring);
  --mdc-icon-size: 16px;
}
.options.grid .check { position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; --mdc-icon-size: 14px; }
.opt[aria-checked="true"] .check { opacity: 1; transform: scale(1); }

.ripple {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: currentColor;
  opacity: .22;
  pointer-events: none;
  transform: scale(0);
  animation: acha-sheet-ripple 520ms ease-out forwards;
}

.empty { padding: 18px 8px 8px; text-align: center; color: var(--_sheet-muted); font-size: 14px; }

@keyframes acha-sheet-in {
  from { opacity: 0; transform: translate3d(0, 12px, 0) scale(.97); }
  to { opacity: 1; transform: none; }
}
@keyframes acha-sheet-ripple {
  to { transform: scale(26); opacity: 0; }
}

:host([data-theme="light"]) .backdrop,
:host-context([data-theme="light"]) .backdrop { background: var(--acha-sheet-backdrop, rgba(30, 40, 60, .22)); }

@media (prefers-reduced-motion: reduce) {
  .sheet, :host([data-state="closing"]) .sheet { transition: opacity 160ms ease; transform: none !important; opacity: 0; }
  :host([data-state="opening"]) .sheet, :host([data-state="open"]) .sheet { opacity: 1; }
  :host([data-state="opening"]) .opt, :host([data-state="open"]) .opt { animation: none; }
  .ripple { display: none; }
  .bubble, .check, .opt { transition-duration: 1ms; }
}
`;

let _sheet_uid = 0;

function _sheet_deepActive() {
  let a = document.activeElement;
  while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
  return a;
}

function _sheet_same(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a) === String(b);
}

function _sheet_reduced() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch (e) { return false; }
}

class AchaSheet extends HTMLElement {
  static get observedAttributes() { return ['close-label']; }

  constructor() {
    super();
    this._resolve = null;
    this._options = [];
    this._optEls = [];
    this._state = 'closed';
    this._selTimer = 0;
    this._endTimer = 0;
    this._lightTimer = 0;
    this._returnFocus = null;
    this._closeLabel = 'Fechar';
    this._drag = null;
    this._winBound = false;
    this._onWinKey = this._onWinKey.bind(this);
    this._onWinPointer = this._onWinPointer.bind(this);
    this._buildShadow();
  }

  _buildShadow() {
    const root = this.attachShadow({ mode: 'open' });
    const tid = 'acha-sheet-title-' + (++_sheet_uid);
    root.innerHTML = `<style>${ACHA_SHEET_CSS}</style>
<div class="backdrop" part="backdrop"></div>
<div class="sheet" part="sheet" role="dialog" aria-modal="true" aria-labelledby="${tid}" tabindex="-1">
  <div class="grab" aria-hidden="true"></div>
  <div class="head">
    <h2 class="title" id="${tid}"></h2>
    <button class="close" type="button" part="close"><ha-icon icon="mdi:close"></ha-icon></button>
  </div>
  <div class="body">
    <div class="options grid" role="radiogroup" aria-labelledby="${tid}"></div>
  </div>
</div>`;
    this._backdropEl = root.querySelector('.backdrop');
    this._sheetEl = root.querySelector('.sheet');
    this._grabEl = root.querySelector('.grab');
    this._headEl = root.querySelector('.head');
    this._titleEl = root.querySelector('.title');
    this._closeEl = root.querySelector('.close');
    this._bodyEl = root.querySelector('.body');
    this._optsEl = root.querySelector('.options');
    this._closeEl.setAttribute('aria-label', this._closeLabel);
    this._closeEl.title = this._closeLabel;

    this._backdropEl.addEventListener('click', () => this.close(null));
    this._closeEl.addEventListener('click', () => this.close(null));
    this._optsEl.addEventListener('click', (e) => {
      const b = e.target && e.target.closest ? e.target.closest('.opt') : null;
      if (b && !b.disabled) this._choose(Number(b.dataset.index), b, e);
    });
    this._optsEl.addEventListener('pointerdown', (e) => {
      const b = e.target && e.target.closest ? e.target.closest('.opt') : null;
      if (b && !b.disabled) this._ripple(b, e.clientX, e.clientY);
    });
    this._sheetEl.addEventListener('keydown', (e) => this._onKey(e));

    const ds = (e) => this._onDragStart(e);
    const dm = (e) => this._onDragMove(e);
    const de = (e) => this._onDragEnd(e);
    for (const el of [this._grabEl, this._headEl]) {
      el.addEventListener('pointerdown', ds);
      el.addEventListener('pointermove', dm);
      el.addEventListener('pointerup', de);
      el.addEventListener('pointercancel', de);
    }
    // Keep gestures inside the sheet from reaching ancestors (e.g. the card's swipe between ACs).
    this.addEventListener('pointerdown', (e) => { if (this.isOpen) e.stopPropagation(); });
  }

  connectedCallback() {
    this._setState(this._state);
  }

  disconnectedCallback() {
    this._unbindWindow();
    clearTimeout(this._selTimer);
    clearTimeout(this._endTimer);
    clearTimeout(this._lightTimer);
    this._settle(null);
    this._drag = null;
    this._setState('closed');
  }

  attributeChangedCallback(name, _old, val) {
    if (name === 'close-label') this.closeLabel = val;
  }

  get closeLabel() { return this._closeLabel; }
  set closeLabel(v) {
    this._closeLabel = (v === null || v === undefined || v === '') ? 'Fechar' : String(v);
    if (this._closeEl) {
      this._closeEl.setAttribute('aria-label', this._closeLabel);
      this._closeEl.title = this._closeLabel;
    }
  }

  get isOpen() { return this._state === 'open'; }

  /**
   * Show the picker.
   * @param {string} title
   * @param {Array<{value:any,label?:string,icon?:string,color?:string,description?:string,disabled?:boolean}>} options
   * @param {any} selected  currently selected raw value
   * @param {{layout?:'grid'|'list', closeLabel?:string}} [opts]
   * @returns {Promise<any|null>} chosen value, or null when dismissed
   */
  open(title, options, selected, opts) {
    const o = opts || {};
    this._settle(null); // a previous pending picker resolves as dismissed
    clearTimeout(this._selTimer);
    clearTimeout(this._endTimer);
    clearTimeout(this._lightTimer);
    if (o.closeLabel) this.closeLabel = o.closeLabel;

    const list = Array.isArray(options)
      ? options.filter((x) => x && x.value !== undefined && x.value !== null)
      : [];
    let layout = o.layout;
    if (layout !== 'grid' && layout !== 'list') {
      layout = (list.length > 8 || list.some((x) => x.description)) ? 'list' : 'grid';
    }
    this._options = list;
    this._titleEl.textContent = title == null ? '' : String(title);
    this._renderOptions(list, selected, layout);
    this._bodyEl.scrollTop = 0;
    this._drag = null;
    this._sheetEl.classList.remove('dragging');
    this._sheetEl.style.setProperty('--_sheet-drag', '0px');

    const act = _sheet_deepActive();
    if (this._state !== 'open' && act && !this.shadowRoot.contains(act)) this._returnFocus = act;
    // Flush the closed styles so the slide-up transition always runs from the bottom.
    void this._sheetEl.offsetHeight;
    this._setState('open');
    this._bindWindow();
    this._focusInitial();
    this.dispatchEvent(new CustomEvent('acha-sheet-open', {
      bubbles: true, composed: true, detail: { title: this._titleEl.textContent },
    }));
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  /** Close the sheet; a pending open() resolves with `value` (default null). */
  close(value) {
    const v = value === undefined ? null : value;
    clearTimeout(this._selTimer);
    this._settle(v);
    this._hide(v);
  }

  _renderOptions(list, selected, layout) {
    const wrap = this._optsEl;
    wrap.className = 'options ' + layout;
    wrap.textContent = '';
    this._optEls = [];
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '—';
      wrap.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    let selIdx = -1;
    list.forEach((opt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.setAttribute('role', 'radio');
      b.dataset.index = String(i);
      const isSel = selIdx < 0 && _sheet_same(opt.value, selected);
      if (isSel) selIdx = i;
      b.setAttribute('aria-checked', isSel ? 'true' : 'false');
      b.style.setProperty('--i', String(Math.min(i, 16)));
      if (opt.color) b.style.setProperty('--opt-color', String(opt.color));
      if (opt.disabled) b.disabled = true;

      const bubble = document.createElement('span');
      bubble.className = 'bubble';
      bubble.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('ha-icon');
      icon.setAttribute('icon', opt.icon || 'mdi:circle-medium');
      bubble.appendChild(icon);

      const txt = document.createElement('span');
      txt.className = 'txt';
      const lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.textContent = opt.label == null || opt.label === '' ? String(opt.value) : String(opt.label);
      txt.appendChild(lbl);
      if (opt.description) {
        const desc = document.createElement('span');
        desc.className = 'desc';
        desc.textContent = String(opt.description);
        txt.appendChild(desc);
      }

      const check = document.createElement('span');
      check.className = 'check';
      check.setAttribute('aria-hidden', 'true');
      const ci = document.createElement('ha-icon');
      ci.setAttribute('icon', 'mdi:check');
      check.appendChild(ci);

      b.append(bubble, txt, check);
      frag.appendChild(b);
      this._optEls.push(b);
    });
    wrap.appendChild(frag);
    let rov = selIdx >= 0 && !this._optEls[selIdx].disabled ? selIdx : this._optEls.findIndex((el) => !el.disabled);
    if (rov < 0) rov = 0;
    this._optEls.forEach((el, i) => { el.tabIndex = i === rov ? 0 : -1; });
  }

  _setState(s) {
    this._state = s;
    this.setAttribute('data-state', s);
    if (s === 'closed') this.setAttribute('aria-hidden', 'true');
    else this.removeAttribute('aria-hidden');
  }

  _settle(v) {
    const r = this._resolve;
    this._resolve = null;
    if (r) r(v);
  }

  _hide(value) {
    if (this._state === 'closed' || this._state === 'closing') return;
    this._unbindWindow();
    const inside = this.shadowRoot.activeElement;
    const deep = _sheet_deepActive();
    this._sheetEl.classList.remove('dragging');
    this._drag = null;
    this._setState('closing');
    // Give focus back to whatever opened the sheet (typically the tile), if it still lives.
    const back = this._returnFocus;
    this._returnFocus = null;
    if ((inside || !deep || deep === document.body) && back && back.isConnected && typeof back.focus === 'function') {
      try { back.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    clearTimeout(this._endTimer);
    this._endTimer = setTimeout(() => {
      if (this._state !== 'closing') return;
      this._setState('closed');
      this._sheetEl.style.setProperty('--_sheet-drag', '0px');
    }, _sheet_reduced() ? 170 : 280);
    this.dispatchEvent(new CustomEvent('acha-sheet-close', {
      bubbles: true, composed: true, detail: { value: value === undefined ? null : value },
    }));
  }

  _bindWindow() {
    if (this._winBound) return;
    this._winBound = true;
    window.addEventListener('keydown', this._onWinKey);
    // Light dismiss: arm on the next tick so the gesture that opened the sheet is not caught.
    clearTimeout(this._lightTimer);
    this._lightTimer = setTimeout(() => {
      if (this._winBound) window.addEventListener('pointerdown', this._onWinPointer, true);
    }, 0);
  }

  _unbindWindow() {
    clearTimeout(this._lightTimer);
    if (!this._winBound) return;
    this._winBound = false;
    window.removeEventListener('keydown', this._onWinKey);
    window.removeEventListener('pointerdown', this._onWinPointer, true);
  }

  _onWinPointer(e) {
    if (!this.isOpen) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (path.indexOf(this) === -1) this.close(null);
  }

  _onWinKey(e) {
    if (!this.isOpen || e.defaultPrevented || e.key !== 'Escape') return;
    const path = e.composedPath ? e.composedPath() : [];
    const deep = _sheet_deepActive();
    if (path.indexOf(this) !== -1 || !deep || deep === document.body) {
      e.preventDefault();
      e.stopPropagation();
      this.close(null);
    }
  }

  _onKey(e) {
    if (!this.isOpen) return;
    const key = e.key;
    if (key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close(null);
      return;
    }
    if (key === 'Tab') {
      // Focus trap: close button <-> roving option.
      const stops = [this._closeEl];
      const rov = this._optEls.find((el) => el.tabIndex === 0 && !el.disabled);
      if (rov) stops.push(rov);
      const cur = this.shadowRoot.activeElement;
      let idx = stops.indexOf(cur);
      if (idx === -1) idx = e.shiftKey ? 0 : stops.length - 1;
      const next = stops[(idx + (e.shiftKey ? -1 : 1) + stops.length) % stops.length];
      e.preventDefault();
      next.focus();
      return;
    }
    const cur = this.shadowRoot.activeElement;
    const i = this._optEls.indexOf(cur);
    if (i === -1) return;
    const n = this._optEls.length;
    let cols = 1;
    if (this._optsEl.classList.contains('grid')) {
      try {
        const tpl = getComputedStyle(this._optsEl).gridTemplateColumns || '';
        cols = Math.max(1, tpl.split(' ').filter(Boolean).length);
      } catch (err) { cols = 1; }
    }
    let delta = 0;
    let target = -1;
    if (key === 'ArrowRight') delta = 1;
    else if (key === 'ArrowLeft') delta = -1;
    else if (key === 'ArrowDown') delta = cols;
    else if (key === 'ArrowUp') delta = -cols;
    else if (key === 'Home') target = 0;
    else if (key === 'End') target = n - 1;
    else return;
    e.preventDefault();
    if (target === -1) {
      target = i + delta;
      if (target < 0 || target >= n) target = (i + (delta > 0 ? 1 : -1) + n) % n;
    }
    // Skip disabled options in the direction of travel.
    const dir = (key === 'End' || delta < 0) ? -1 : 1;
    for (let k = 0; k < n && this._optEls[target].disabled; k++) target = (target + dir + n) % n;
    this._moveRoving(target, true);
  }

  _moveRoving(i, focus) {
    const el = this._optEls[i];
    if (!el) return;
    this._optEls.forEach((x, j) => { x.tabIndex = j === i ? 0 : -1; });
    if (focus) {
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      this._reveal(el);
    }
  }

  _reveal(el) {
    const body = this._bodyEl;
    const br = body.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (er.top < br.top || er.bottom > br.bottom) {
      body.scrollTop += (er.top - br.top) - (br.height - er.height) / 2;
    }
  }

  _focusInitial() {
    const target = this._optEls.find((el) => el.tabIndex === 0 && !el.disabled) || this._closeEl;
    try { target.focus({ preventScroll: true }); } catch (e) { this._sheetEl.focus(); }
    if (target !== this._closeEl) {
      // Layout is settled after the state flip; centre the selected option if it is off-screen.
      requestAnimationFrame(() => { if (this.isOpen) this._reveal(target); });
    }
  }

  _choose(i, el, ev) {
    if (!this.isOpen || !this._resolve) return;
    const opt = this._options[i];
    if (!opt || opt.disabled) return;
    this._optEls.forEach((x, j) => x.setAttribute('aria-checked', j === i ? 'true' : 'false'));
    this._moveRoving(i, false);
    if (ev && ev.detail === 0 && el) this._ripple(el); // keyboard activation: centred ripple
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(8); } catch (e) { /* ignore */ }
    const v = opt.value;
    this._settle(v);
    // Let the check mark land before sliding away.
    clearTimeout(this._selTimer);
    this._selTimer = setTimeout(() => this._hide(v), _sheet_reduced() ? 60 : 180);
  }

  _ripple(el, x, y) {
    if (_sheet_reduced()) return;
    const r = el.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.left = ((x === undefined ? r.left + r.width / 2 : x) - r.left) + 'px';
    dot.style.top = ((y === undefined ? r.top + r.height / 2 : y) - r.top) + 'px';
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
    el.appendChild(dot);
  }

  _onDragStart(e) {
    if (!this.isOpen || (e.button !== undefined && e.button !== 0)) return;
    if (e.target && e.target.closest && e.target.closest('.close')) return;
    const now = performance.now();
    this._drag = { id: e.pointerId, el: e.currentTarget, y0: e.clientY, dy: 0, y: e.clientY, t: now, v: 0, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  _onDragMove(e) {
    const d = this._drag;
    if (!d || e.pointerId !== d.id) return;
    let dy = e.clientY - d.y0;
    if (!d.moved) {
      if (Math.abs(dy) < 4) return;
      d.moved = true;
      this._sheetEl.classList.add('dragging');
    }
    if (dy < 0) dy = -Math.min(14, Math.sqrt(-dy) * 2); // rubber band upwards
    const now = performance.now();
    const dt = Math.max(1, now - d.t);
    d.v = 0.7 * ((e.clientY - d.y) / dt) + 0.3 * d.v;
    d.y = e.clientY;
    d.t = now;
    d.dy = dy;
    this._sheetEl.style.setProperty('--_sheet-drag', dy.toFixed(1) + 'px');
  }

  _onDragEnd(e) {
    const d = this._drag;
    if (!d || e.pointerId !== d.id) return;
    this._drag = null;
    try { d.el.releasePointerCapture(d.id); } catch (err) { /* ignore */ }
    if (!d.moved) return;
    const h = this._sheetEl.offsetHeight || 300;
    const dismiss = e.type !== 'pointercancel' && (d.dy > Math.min(120, h * 0.3) || (d.v > 0.5 && d.dy > 24));
    if (dismiss) {
      this.close(null); // .dragging is removed in _hide so the slide-out continues from the finger
    } else {
      this._sheetEl.classList.remove('dragging');
      this._sheetEl.style.setProperty('--_sheet-drag', '0px'); // springs back
    }
  }
}

if (!customElements.get('acha-sheet')) customElements.define('acha-sheet', AchaSheet);

// ===== src/panel.js =====
// acha-panel — one air conditioner's full control UI (header, unit + dial hero, stepper, chips, toggles, tiles, footer).
// Props: hass, config (one normalised entry merged with card-level options), active (bool).
// Builds its shadow DOM once; every hass update only patches text, classes, attributes and child props.
// Bundling: private top-level names prefixed PANEL_ / _panel_.


const PANEL_PALETTE_OFF = '#6b7280';
const PANEL_DEBOUNCE_MS = 700;
const PANEL_HOLD_MS = 2500; // ignore stale hass targets this long after a user change
const PANEL_OPT_MS = 4000; // optimistic select/toggle values expire after this
const PANEL_LONGPRESS_MS = 550;
const PANEL_REPEAT_DELAY = 420;
const PANEL_REPEAT_EVERY = 110;

const PANEL_KINDS = [
  { kind: 'hvac_mode', list: 'hvac_modes', attr: null, hide: 'modes', title: 'ui.mode', service: 'set_hvac_mode', bit: 0 },
  { kind: 'fan_mode', list: 'fan_modes', attr: 'fan_mode', hide: 'fan', title: 'ui.fan_speed', service: 'set_fan_mode', bit: 8 },
  { kind: 'swing_mode', list: 'swing_modes', attr: 'swing_mode', hide: 'swing', title: 'ui.swing', service: 'set_swing_mode', bit: 32 },
  { kind: 'swing_horizontal_mode', list: 'swing_horizontal_modes', attr: 'swing_horizontal_mode', hide: 'swing_horizontal', title: 'ui.swing_horizontal', service: 'set_swing_horizontal_mode', bit: 512 },
  { kind: 'preset_mode', list: 'preset_modes', attr: 'preset_mode', hide: 'preset', title: 'ui.preset', service: 'set_preset_mode', bit: 16 },
];

const PANEL_TOGGLE_DOMAINS = ['switch', 'input_boolean', 'fan', 'light', 'automation', 'siren', 'humidifier', 'climate', 'media_player', 'remote', 'vacuum'];
const PANEL_SELECT_DOMAINS = ['select', 'input_select'];
const PANEL_PRESS_DOMAINS = { button: 'button.press', input_button: 'input_button.press', script: 'script.turn_on', scene: 'scene.turn_on' };
const PANEL_DOMAIN_ICON = {
  switch: 'mdi:toggle-switch-variant',
  input_boolean: 'mdi:toggle-switch-variant',
  fan: 'mdi:fan',
  light: 'mdi:lightbulb',
  select: 'mdi:format-list-bulleted',
  input_select: 'mdi:format-list-bulleted',
  button: 'mdi:gesture-tap-button',
  input_button: 'mdi:gesture-tap-button',
  script: 'mdi:script-text-play',
  scene: 'mdi:palette',
  sensor: 'mdi:gauge',
  binary_sensor: 'mdi:checkbox-blank-circle-outline',
  automation: 'mdi:robot',
};

// Structural only (no colours): `hidden` must win over the display rules of ACHA_PANEL_CSS.
const PANEL_EXTRA_CSS = `
[hidden] { display: none !important; }
.acha-p-status .sep { opacity: .55; margin: 0 .35em; }
.acha-toggle ha-icon, .acha-tile ha-icon { pointer-events: none; }
acha-sheet { border-radius: inherit; }
`;

function _panel_el(tag, cls, attrs) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (attrs) for (const k of Object.keys(attrs)) node.setAttribute(k, attrs[k]);
  return node;
}

function _panel_icon(icon, cls) {
  const node = _panel_el('ha-icon', cls || '');
  if (icon) node.setAttribute('icon', icon);
  return node;
}

function _panel_text(node, text) {
  const v = text === undefined || text === null ? '' : String(text);
  if (node && node.textContent !== v) node.textContent = v;
}

function _panel_attr(node, name, value) {
  if (!node) return;
  if (value === null || value === undefined || value === false) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
  } else {
    const v = value === true ? '' : String(value);
    if (node.getAttribute(name) !== v) node.setAttribute(name, v);
  }
}

function _panel_setIcon(node, icon) {
  if (node && icon && node.getAttribute('icon') !== icon) node.setAttribute('icon', icon);
}

function _panel_prop(node, name, value) {
  if (node && node[name] !== value) node[name] = value;
}

function _panel_style(node, name, value) {
  if (!node) return;
  if (value === null || value === undefined || value === '') {
    if (node.style.getPropertyValue(name)) node.style.removeProperty(name);
  } else if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}

function _panel_list(st, name) {
  const v = st && st.attributes ? st.attributes[name] : null;
  return Array.isArray(v) ? v : [];
}

function _panel_domain(id) {
  return String(id || '').split('.')[0];
}

function _panel_unavailable(st) {
  return !st || st.state === 'unavailable' || st.state === 'unknown';
}

/** Buttons/scenes/scripts sit at 'unknown' until first used; only 'unavailable' disables them. */
function _panel_extraUnavailable(s, domain) {
  if (!s) return true;
  if (s.state === 'unavailable') return true;
  return s.state === 'unknown' && !PANEL_PRESS_DOMAINS[domain];
}

function _panel_haptic(ms) {
  try {
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms);
  } catch (e) {
    /* unsupported */
  }
}

/** Canonical preset key for toggle matching ('econo' → 'eco', 'powerful' → 'boost'). */
function _panel_presetCanon(v) {
  const k = normKey(v);
  if (k === 'econo' || k === 'economy') return 'eco';
  if (k === 'powerful' || k === 'turbo') return 'boost';
  return k;
}

function _panel_fmtTemp(v, unit) {
  if (v === null || v === undefined) return '';
  return formatTemp(v, 0.1).text + ' ' + (unit || '°C');
}

/** Sensor value + unit, e.g. '620 W', '3.4 kWh', '48 %'. */
function _panel_fmtSensor(st, fallbackUnit) {
  if (!st || _panel_unavailable(st)) return '';
  const n = numAttr(st);
  const unit = (st.attributes && st.attributes.unit_of_measurement) || fallbackUnit || '';
  if (n === null) return String(st.state) + (unit ? ' ' + unit : '');
  const decimals = Math.abs(n) >= 100 || Number.isInteger(n) ? 0 : Math.abs(n) >= 10 ? 1 : 2;
  const txt = Number(n.toFixed(decimals)).toString();
  return unit ? (unit === '%' ? txt + ' %' : txt + ' ' + unit) : txt;
}

function _panel_ripple(target, ev) {
  if (!target || !ev || typeof ev.clientX !== 'number') return;
  const rect = target.getBoundingClientRect();
  const r = _panel_el('span', 'acha-ripple');
  r.style.setProperty('--x', ev.clientX - rect.left + 'px');
  r.style.setProperty('--y', ev.clientY - rect.top + 'px');
  r.addEventListener('animationend', () => r.remove(), { once: true });
  setTimeout(() => r.remove(), 900);
  target.appendChild(r);
}

class AchaPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = null;
    this._active = true;
    this._lang = 'en';
    this._queued = false;
    this._built = false;
    this._vm = null;
    this._lastMode = null; // last non-off hvac mode seen (power-on fallback)
    this._pendingT = null; // optimistic setpoint { value } | { low, high }, until
    this._opt = {}; // optimistic option values { kind: { value, until } }
    this._optExtra = {}; // optimistic extra states { entity_id: { state, until } }
    this._powerPending = null; // { on, until }
    this._expiryTimer = 0;
    this._repeat = null;
    this._press = null; // long-press tracking
    this._extrasSig = '';
    this._togglesSig = '';
    this._errLogged = false;
    this._sendTemp = debounce(() => this._flushTemp(), PANEL_DEBOUNCE_MS);
    this._onDialInput = this._onDialInput.bind(this);
    this._onDialChange = this._onDialChange.bind(this);
    this._stopRepeat = this._stopRepeat.bind(this);
  }

  // ---------------------------------------------------------------- props
  set hass(hass) {
    this._hass = hass;
    this._schedule();
  }

  get hass() {
    return this._hass;
  }

  set config(cfg) {
    if (!cfg || typeof cfg !== 'object') return;
    const prevEntity = this._config && this._config.entity;
    this._config = cfg;
    if (prevEntity && prevEntity !== cfg.entity) {
      this._pendingT = null;
      this._opt = {};
      this._optExtra = {};
      this._powerPending = null;
      this._lastMode = null;
      this._sendTemp.cancel();
    }
    this._build();
    this._buildExtras(true);
    this._schedule();
  }

  get config() {
    return this._config;
  }

  set active(v) {
    const a = !!v;
    if (this._active === a) return;
    this._active = a;
    this._schedule();
  }

  get active() {
    return this._active;
  }

  connectedCallback() {
    if (this._config) this._schedule();
  }

  disconnectedCallback() {
    this._sendTemp.flush();
    this._stopRepeat();
    clearTimeout(this._expiryTimer);
    this._cancelPress();
  }

  _schedule() {
    if (this._queued) return;
    this._queued = true;
    queueMicrotask(() => {
      this._queued = false;
      this._safeRender();
    });
  }

  _safeRender() {
    try {
      this._render();
    } catch (err) {
      if (!this._errLogged) {
        this._errLogged = true;
        console.error('[acha-card] panel render failed:', err);
      }
    }
  }

  // ---------------------------------------------------------------- build once
  _build() {
    if (this._built) return;
    this._built = true;
    const sr = this.shadowRoot;
    const style = _panel_el('style');
    style.textContent = ACHA_PANEL_CSS + PANEL_EXTRA_CSS;
    const ambient = _panel_el('div', 'acha-ambient', { 'aria-hidden': 'true' });
    const panel = _panel_el('div', 'acha-panel');

    // header
    const header = _panel_el('div', 'acha-p-header');
    const iconBox = _panel_el('div', 'acha-p-icon', { 'aria-hidden': 'true' });
    const icon = _panel_icon('mdi:air-conditioner');
    iconBox.appendChild(icon);
    const titles = _panel_el('div', 'acha-p-titles');
    const name = _panel_el('h3', 'acha-p-name');
    const status = _panel_el('div', 'acha-p-status', { 'aria-live': 'polite' });
    const statusMain = _panel_el('b');
    const statusRest = _panel_el('span');
    status.append(statusMain, statusRest);
    titles.append(name, status);
    const power = _panel_el('button', 'acha-power', { type: 'button' });
    power.appendChild(_panel_icon('mdi:power'));
    power.addEventListener('click', (ev) => this._onPower(ev));
    header.append(iconBox, titles, power);

    // unavailable banner
    const banner = _panel_el('div', 'acha-banner', { role: 'alert' });
    banner.hidden = true;
    const bannerText = _panel_el('span');
    banner.append(_panel_icon('mdi:wifi-off'), bannerText);

    // hero
    const hero = _panel_el('div', 'acha-hero');
    const unitWrap = _panel_el('div', 'acha-unit-wrap');
    const unit = document.createElement('acha-unit');
    unitWrap.appendChild(unit);
    const dialWrap = _panel_el('div', 'acha-dial-wrap');
    const dial = document.createElement('acha-dial');
    dial.addEventListener('acha-input', this._onDialInput);
    dial.addEventListener('acha-change', this._onDialChange);
    dialWrap.appendChild(dial);
    hero.append(unitWrap, dialWrap);

    // stepper
    const stepper = _panel_el('div', 'acha-stepper');
    const minus = _panel_el('button', 'acha-step-btn minus', { type: 'button' });
    minus.appendChild(_panel_icon('mdi:minus'));
    const mid = _panel_el('div', 'acha-step-mid');
    const plus = _panel_el('button', 'acha-step-btn plus', { type: 'button' });
    plus.appendChild(_panel_icon('mdi:plus'));
    stepper.append(minus, mid, plus);
    this._bindStepper(minus, -1);
    this._bindStepper(plus, 1);

    // chips
    const chips = _panel_el('div', 'acha-chips');
    const mkChip = (iconName) => {
      const chip = _panel_el('div', 'acha-chip');
      const value = _panel_el('span', 'acha-chip-value');
      const label = _panel_el('span', 'acha-chip-label');
      chip.append(_panel_icon(iconName), value, label);
      chip.hidden = true;
      chips.appendChild(chip);
      return { chip, value, label };
    };
    const chipInside = mkChip('mdi:home-thermometer-outline');
    const chipOutside = mkChip('mdi:sun-thermometer-outline');
    const chipHumidity = mkChip('mdi:water-percent');

    const toggles = _panel_el('div', 'acha-toggles');

    // tiles
    const tiles = _panel_el('div', 'acha-tiles');
    const kindTiles = {};
    for (const def of PANEL_KINDS) {
      const tile = this._mkTile();
      tile.btn.hidden = true;
      tile.btn.addEventListener('click', (ev) => {
        if (this._consumePress()) return;
        this._openKind(def, tile.btn, ev);
      });
      this._bindLongPress(tile.btn, () => this._config && this._config.entity);
      tiles.appendChild(tile.btn);
      kindTiles[def.kind] = tile;
    }

    // footer
    const footer = _panel_el('div', 'acha-footer');
    const conn = _panel_el('span', 'acha-conn');
    const connText = _panel_el('span');
    conn.append(_panel_el('span', 'acha-conn-dot'), connText);
    const energy = _panel_el('span', 'acha-energy');
    const energyText = _panel_el('span');
    energy.append(_panel_icon('mdi:lightning-bolt'), energyText);
    energy.hidden = true;
    footer.append(conn, energy);

    panel.append(header, banner, hero, stepper, chips, toggles, tiles, footer);
    const sheet = document.createElement('acha-sheet');
    sr.append(style, ambient, panel, sheet);

    this._els = {
      panel, icon, name, statusMain, statusRest, power, banner, bannerText, unitWrap, unit, dialWrap, dial,
      stepper, minus, plus, mid, chips, chipInside, chipOutside, chipHumidity, toggles, tiles, kindTiles,
      footer, conn, connText, energy, energyText, sheet, extraTiles: [],
    };
  }

  /** One tile: button.acha-tile > .acha-tile-icon, .acha-tile-text > label/value, .acha-tile-chev. */
  _mkTile() {
    const btn = _panel_el('button', 'acha-tile', { type: 'button' });
    const iconBox = _panel_el('span', 'acha-tile-icon', { 'aria-hidden': 'true' });
    const icon = _panel_icon('mdi:tune-variant');
    iconBox.appendChild(icon);
    const text = _panel_el('span', 'acha-tile-text');
    const label = _panel_el('span', 'acha-tile-label');
    const value = _panel_el('span', 'acha-tile-value');
    text.append(label, value);
    const chev = _panel_icon('mdi:chevron-right', 'acha-tile-chev');
    chev.setAttribute('aria-hidden', 'true');
    btn.append(iconBox, text, chev);
    btn.addEventListener('pointerdown', (ev) => {
      if (!btn.classList.contains('readonly')) _panel_ripple(btn, ev);
    });
    return { btn, icon, label, value, chev };
  }

  // ---------------------------------------------------------------- view model
  _optValue(kind, actual) {
    const o = this._opt[kind];
    if (!o) return actual;
    if (Date.now() > o.until || o.value === actual) {
      delete this._opt[kind];
      return actual;
    }
    return o.value;
  }

  _setOpt(kind, value) {
    this._opt[kind] = { value, until: Date.now() + PANEL_OPT_MS };
    this._armExpiry(PANEL_OPT_MS);
  }

  _armExpiry(ms) {
    clearTimeout(this._expiryTimer);
    this._expiryTimer = setTimeout(() => this._schedule(), ms + 60);
  }

  _computeVM() {
    const hass = this._hass;
    const cfg = this._config;
    const st = stateObj(hass, cfg.entity);
    const a = (st && st.attributes) || {};
    const lang = this._lang;
    const prof = resolveProfile(cfg, st, hass);
    const unavailable = _panel_unavailable(st);
    const unit = (hass && hass.config && hass.config.unit_system && hass.config.unit_system.temperature) || '°C';
    const modes = _panel_list(st, 'hvac_modes').map(String);

    let mode = st ? String(this._optValue('hvac_mode', st.state)) : 'off';
    if (isOn(mode) && !unavailable) this._lastMode = mode;
    let on = !unavailable && isOn(mode);
    // optimistic power toggle
    const pp = this._powerPending;
    if (pp) {
      if (Date.now() > pp.until || pp.on === (!unavailable && isOn(st))) this._powerPending = null;
      else {
        on = pp.on;
        if (on && !isOn(mode)) mode = this._powerOnMode(st, prof);
        if (!on) mode = 'off';
      }
    }
    const colors = prof.colors || {};
    const color = on ? colors[mode] || describeOption('hvac_mode', mode, prof, lang).color || PANEL_PALETTE_OFF : colors.off || PANEL_PALETTE_OFF;

    // setpoint
    const step = prof.userStep || numAttr(st, 'target_temp_step') || prof.step || 0.5;
    let min = cfg.min_temp !== undefined ? Number(cfg.min_temp) : numAttr(st, 'min_temp');
    let max = cfg.max_temp !== undefined ? Number(cfg.max_temp) : numAttr(st, 'max_temp');
    if (!Number.isFinite(min)) min = unit === '°F' ? 61 : 16;
    if (!Number.isFinite(max)) max = unit === '°F' ? 86 : 30;
    if (min > max) [min, max] = [max, min];
    let target = numAttr(st, 'temperature');
    let low = numAttr(st, 'target_temp_low');
    let high = numAttr(st, 'target_temp_high');
    const dual = supports(st, SUPPORT.TARGET_TEMPERATURE_RANGE) && (mode === 'heat_cool' || mode === 'auto') && low !== null && high !== null;
    const pt = this._pendingT;
    if (pt) {
      const matches = pt.dual ? pt.low === low && pt.high === high : pt.value === target;
      if (Date.now() > pt.until || (matches && !this._sendTemp.pending())) this._pendingT = null;
      else if (pt.dual) {
        low = pt.low;
        high = pt.high;
      } else target = pt.value;
    }
    const tempBit = supports(st, SUPPORT.TARGET_TEMPERATURE) || (a.supported_features === undefined && target !== null);
    const canSetTemp = on && !unavailable && (dual || (tempBit && target !== null));

    // sensors
    const inside = this._sensorNum(cfg.indoor_temperature);
    const current = inside !== null ? inside : numAttr(st, 'current_temperature');
    const outside = this._sensorNum(cfg.outdoor_temperature);
    const humSensor = this._sensorNum(cfg.humidity);
    const humidity = humSensor !== null ? humSensor : numAttr(st, 'current_humidity');
    const powerSt = cfg.power ? stateObj(hass, cfg.power) : null;

    return {
      st, a, prof, lang, unavailable, missing: !st, unit, modes, mode, on, color, step, min, max, target, low, high,
      dual, canSetTemp, current, outside, humidity, powerSt, action: a.hvac_action ? String(a.hvac_action) : null,
      hide: Array.isArray(cfg.hide) ? cfg.hide : [],
    };
  }

  _sensorNum(id) {
    if (!id) return null;
    const s = stateObj(this._hass, id);
    return s && !_panel_unavailable(s) ? numAttr(s) : null;
  }

  /** Mode used to turn on without turn_on support: remembered → profile order → first non-off. */
  _powerOnMode(st, prof) {
    const modes = _panel_list(st, 'hvac_modes').map(String).filter((m) => m !== 'off');
    if (this._lastMode && modes.includes(this._lastMode)) return this._lastMode;
    const order = (prof && prof.modeOrder) || [];
    for (const m of ['cool', 'heat', 'heat_cool', ...order]) if (modes.includes(m)) return m;
    return modes[0] || 'cool';
  }

  /** Option list for a kind, ordered for display (modes by profile.modeOrder, preset 'none' first). */
  _orderedOptions(def, vm) {
    const raw = _panel_list(vm.st, def.list).map(String);
    if (def.kind === 'hvac_mode') {
      const order = vm.prof.modeOrder || [];
      const idx = (m) => {
        const i = order.indexOf(m);
        return i < 0 ? order.length + raw.indexOf(m) : i;
      };
      return raw.slice().sort((x, y) => idx(x) - idx(y));
    }
    if (def.kind === 'preset_mode') {
      const none = raw.filter((p) => normKey(p) === 'none');
      return none.concat(raw.filter((p) => normKey(p) !== 'none'));
    }
    return raw;
  }

  _currentOf(def, vm) {
    if (def.kind === 'hvac_mode') return vm.mode;
    const actual = vm.a[def.attr];
    return this._optValue(def.kind, actual === undefined || actual === null ? null : String(actual));
  }

  _extraState(id) {
    const s = stateObj(this._hass, id);
    const o = this._optExtra[id];
    if (o) {
      if (Date.now() > o.until || (s && s.state === o.state)) delete this._optExtra[id];
      else return { s, state: o.state };
    }
    return { s, state: s ? s.state : null };
  }

  // ---------------------------------------------------------------- render (patch only)
  _render() {
    if (!this._config || !this._built) return;
    const hass = this._hass;
    this._lang = resolveLang(hass, this._config.language);
    if (!hass) return;
    const cfg = this._config;
    const vm = this._computeVM();
    this._vm = vm;
    const e = this._els;
    const lang = vm.lang;
    const L = (k, v) => t(lang, k, v);

    // host state + accent
    _panel_attr(this, 'on', vm.on);
    _panel_attr(this, 'unavailable', vm.unavailable);
    _panel_attr(this, 'active', this._active);
    _panel_attr(this, 'data-mode', vm.mode);
    e.panel.classList.toggle('is-on', vm.on);
    e.panel.classList.toggle('is-unavailable', vm.unavailable);
    _panel_style(this, '--acha-accent', vm.color);

    // header
    const st = vm.st;
    const friendly = vm.a.friendly_name;
    const name = cfg.name || friendly || String(cfg.entity).split('.')[1] || cfg.entity;
    _panel_text(e.name, name);
    const modeDesc = describeOption('hvac_mode', vm.mode, vm.prof, lang);
    _panel_setIcon(e.icon, cfg.icon || vm.a.icon || 'mdi:air-conditioner');
    let main;
    if (vm.missing) main = L('ui.unknown');
    else if (vm.unavailable) main = L('ui.unavailable');
    else if (!vm.on) main = L('mode.off');
    else if (vm.action && vm.action !== 'off' && !this._powerPending) main = L('action.' + vm.action);
    else main = modeDesc.label;
    const rest = [];
    if (!vm.unavailable && vm.current !== null) rest.push(L('ui.inside_fmt', { t: _panel_fmtTemp(vm.current, vm.unit) }));
    if (vm.outside !== null) rest.push(L('ui.outside_fmt', { t: _panel_fmtTemp(vm.outside, vm.unit) }));
    _panel_text(e.statusMain, main);
    _panel_text(e.statusRest, rest.length ? ' · ' + rest.join(' · ') : '');

    // power button
    e.power.hidden = vm.hide.includes('power_btn');
    e.power.classList.toggle('on', vm.on);
    _panel_prop(e.power, 'disabled', vm.unavailable);
    const powerLabel = vm.on ? L('ui.turn_off') : L('ui.turn_on');
    _panel_attr(e.power, 'aria-label', powerLabel);
    _panel_attr(e.power, 'aria-pressed', vm.on ? 'true' : 'false');
    _panel_attr(e.power, 'title', powerLabel);

    // banner
    e.banner.hidden = !vm.unavailable;
    _panel_text(e.bannerText, vm.missing ? L('ui.not_found', { entity: cfg.entity }) : L('ui.unavailable'));

    this._renderHero(vm, modeDesc);
    this._renderChips(vm);
    this._renderToggles(vm);
    this._renderKindTiles(vm);
    this._renderExtras(vm);

    // footer
    e.conn.classList.toggle('ok', !vm.unavailable);
    e.conn.classList.toggle('bad', vm.unavailable);
    _panel_text(e.connText, vm.unavailable ? L('ui.unavailable') : L('ui.connected'));
    const pw = _panel_fmtSensor(vm.powerSt);
    e.energy.hidden = !pw;
    _panel_text(e.energyText, pw);
    if (pw) {
      const u = (vm.powerSt.attributes && vm.powerSt.attributes.unit_of_measurement) || '';
      _panel_attr(e.energy, 'title', /wh$/i.test(u) ? L('ui.energy_today') : L('ui.power'));
    }
    _panel_attr(e.sheet, 'close-label', L('ui.close'));
    void st;
  }

  _renderHero(vm, modeDesc) {
    const e = this._els;
    const cfg = this._config;
    const lang = vm.lang;
    // unit
    e.unitWrap.hidden = cfg.show_unit === false;
    if (cfg.show_unit !== false) {
      const fanMode = this._currentOf(PANEL_KINDS[1], vm);
      const swing = this._currentOf(PANEL_KINDS[2], vm);
      const swingH = this._currentOf(PANEL_KINDS[3], vm);
      const sd = swing !== null ? describeOption('swing_mode', swing, vm.prof, lang).swing : null;
      const shd = swingH !== null ? describeOption('swing_horizontal_mode', swingH, vm.prof, lang).swing : null;
      const preset = this._currentOf(PANEL_KINDS[4], vm);
      const pc = preset !== null ? _panel_presetCanon(preset) : null;
      let special = pc === 'boost' ? 'boost' : pc === 'eco' ? 'eco' : null;
      if (!special) {
        for (const x of cfg.extras || []) {
          if (/streamer/i.test(x.entity) && isOn(this._extraState(x.entity).state)) special = 'streamer';
        }
      }
      const u = e.unit;
      _panel_prop(u, 'mode', vm.on ? vm.mode : 'off');
      _panel_prop(u, 'on', vm.on && this._active);
      _panel_prop(u, 'fan', fanMode === null ? 0.5 : fanIntensity(fanMode, _panel_list(vm.st, 'fan_modes'), vm.prof));
      _panel_prop(u, 'swingV', sd === 'v' || sd === 'both');
      _panel_prop(u, 'swingH', sd === 'h' || sd === 'both' || shd === 'h' || shd === 'both');
      _panel_prop(u, 'color', vm.color);
      _panel_prop(u, 'special', special);
    }

    // dial
    const d = e.dial;
    _panel_prop(d, 'min', vm.min);
    _panel_prop(d, 'max', vm.max);
    _panel_prop(d, 'step', vm.step);
    _panel_prop(d, 'unit', vm.unit);
    _panel_prop(d, 'mode', vm.mode);
    _panel_prop(d, 'color', vm.color);
    _panel_prop(d, 'dual', vm.dual);
    _panel_prop(d, 'name', cfg.name || vm.a.friendly_name || cfg.entity);
    if (!d.dragging) {
      if (vm.dual) {
        _panel_prop(d, 'low', vm.low);
        _panel_prop(d, 'high', vm.high);
      } else _panel_prop(d, 'value', vm.target);
    }
    _panel_prop(d, 'current', vm.current);
    _panel_prop(d, 'disabled', !vm.canSetTemp);
    let label = vm.unavailable ? t(lang, 'ui.unavailable') : vm.on ? modeDesc.label : t(lang, 'mode.off');
    if (vm.on && vm.dual) label = modeDesc.label + ' · ' + t(lang, 'ui.range');
    _panel_prop(d, 'label', label);
    _panel_prop(d, 'sublabel', vm.current !== null ? _panel_fmtTemp(vm.current, vm.unit) : '');

    // stepper
    const can = vm.canSetTemp;
    const lo = vm.dual ? vm.low : vm.target;
    const hi = vm.dual ? vm.high : vm.target;
    _panel_prop(e.minus, 'disabled', !can || lo === null || lo <= vm.min);
    _panel_prop(e.plus, 'disabled', !can || hi === null || hi >= vm.max);
    _panel_attr(e.minus, 'aria-label', t(lang, 'ui.decrease'));
    _panel_attr(e.plus, 'aria-label', t(lang, 'ui.increase'));
    let mid = '';
    if (can) mid = vm.dual ? t(lang, 'ui.range') : t(lang, 'ui.setpoint');
    _panel_text(e.mid, mid);
    if (!can) this._stopRepeat();
  }

  _renderChips(vm) {
    const e = this._els;
    const lang = vm.lang;
    const set = (chip, value, label) => {
      chip.chip.hidden = !value;
      _panel_text(chip.value, value);
      _panel_text(chip.label, label);
    };
    set(e.chipInside, vm.current !== null ? _panel_fmtTemp(vm.current, vm.unit) : '', t(lang, 'ui.inside'));
    set(e.chipOutside, vm.outside !== null ? _panel_fmtTemp(vm.outside, vm.unit) : '', t(lang, 'ui.outside'));
    set(e.chipHumidity, vm.humidity !== null ? formatTemp(vm.humidity, 1).text + ' %' : '', t(lang, 'ui.humidity'));
    e.chips.hidden = vm.current === null && vm.outside === null && vm.humidity === null;
  }

  // ---------------------------------------------------------------- quick toggles (eco / boost presets)
  _renderToggles(vm) {
    const e = this._els;
    const lang = vm.lang;
    const presets = _panel_list(vm.st, 'preset_modes').map(String);
    const wanted = (vm.prof.toggles || []).map(_panel_presetCanon);
    const items = vm.hide.includes('preset')
      ? []
      : wanted.map((w) => presets.find((p) => _panel_presetCanon(p) === w)).filter((p, i, arr) => p !== undefined && arr.indexOf(p) === i);
    const sig = items.join('|');
    if (sig !== this._togglesSig) {
      this._togglesSig = sig;
      e.toggles.textContent = '';
      this._toggleEls = items.map((value) => {
        const btn = _panel_el('button', 'acha-toggle', { type: 'button' });
        const icon = _panel_icon('mdi:leaf');
        const label = _panel_el('span');
        btn.append(icon, label);
        btn.addEventListener('pointerdown', (ev) => _panel_ripple(btn, ev));
        btn.addEventListener('click', () => this._onPresetToggle(value));
        e.toggles.appendChild(btn);
        return { value, btn, icon, label };
      });
    }
    e.toggles.hidden = !items.length;
    const current = this._currentOf(PANEL_KINDS[4], vm);
    for (const tg of this._toggleEls || []) {
      const d = describeOption('preset_mode', tg.value, vm.prof, lang);
      const active = current !== null && _panel_presetCanon(current) === _panel_presetCanon(tg.value);
      _panel_setIcon(tg.icon, d.icon);
      _panel_text(tg.label, d.label);
      tg.btn.classList.toggle('active', active);
      _panel_attr(tg.btn, 'aria-pressed', active ? 'true' : 'false');
      _panel_style(tg.btn, '--acha-toggle-color', d.color);
      _panel_prop(tg.btn, 'disabled', vm.unavailable);
    }
  }

  // ---------------------------------------------------------------- climate tiles
  _renderKindTiles(vm) {
    const e = this._els;
    const lang = vm.lang;
    for (const def of PANEL_KINDS) {
      const tile = e.kindTiles[def.kind];
      const list = _panel_list(vm.st, def.list);
      const hidden = !list.length || vm.hide.includes(def.hide);
      tile.btn.hidden = hidden;
      if (hidden) continue;
      const cur = this._currentOf(def, vm);
      const d = cur !== null ? describeOption(def.kind, cur, vm.prof, lang) : null;
      _panel_text(tile.label, t(lang, def.title));
      _panel_text(tile.value, d ? d.label : '—');
      _panel_setIcon(tile.icon, d ? d.icon : 'mdi:tune-variant');
      let active = false;
      if (def.kind === 'hvac_mode') active = vm.on;
      else if (def.kind === 'fan_mode') active = vm.on && cur !== null;
      else if (def.kind === 'preset_mode') active = cur !== null && normKey(cur) !== 'none';
      else active = vm.on && d !== null && d.swing !== 'off';
      tile.btn.classList.toggle('active', active);
      _panel_style(tile.btn, '--acha-tile-color', def.kind === 'hvac_mode' ? vm.color : d && d.color ? d.color : null);
      _panel_prop(tile.btn, 'disabled', vm.unavailable);
      _panel_attr(tile.btn, 'aria-label', t(lang, def.title) + ': ' + (d ? d.label : '—'));
      _panel_attr(tile.btn, 'aria-haspopup', 'dialog');
    }
  }

  // ---------------------------------------------------------------- extra entity tiles
  _buildExtras(force) {
    if (!this._built || !this._config) return;
    const extras = Array.isArray(this._config.extras) ? this._config.extras : [];
    const sig = JSON.stringify(extras.map((x) => [x.entity, x.name || '', x.icon || '']));
    if (sig === this._extrasSig && (!force || this._els.extraTiles.length === extras.length)) return;
    this._extrasSig = sig;
    const e = this._els;
    for (const old of e.extraTiles) old.tile.btn.remove();
    e.extraTiles = extras.map((x) => {
      const tile = this._mkTile();
      const id = x.entity;
      tile.btn.addEventListener('click', (ev) => {
        if (this._consumePress()) return;
        this._onExtra(x, tile, ev);
      });
      this._bindLongPress(tile.btn, () => id);
      e.tiles.appendChild(tile.btn);
      return { x, tile };
    });
  }

  _renderExtras(vm) {
    const lang = vm.lang;
    for (const { x, tile } of this._els.extraTiles) {
      const id = x.entity;
      const domain = _panel_domain(id);
      const { s, state } = this._extraState(id);
      const attrs = (s && s.attributes) || {};
      const unavailable = _panel_extraUnavailable(s, domain);
      _panel_text(tile.label, x.name || attrs.friendly_name || id.split('.')[1] || id);
      _panel_setIcon(tile.icon, x.icon || attrs.icon || PANEL_DOMAIN_ICON[domain] || 'mdi:toggle-switch-variant');
      let value = '';
      let active = false;
      let readonly = false;
      if (!s) value = t(lang, 'ui.unknown');
      else if (unavailable) value = t(lang, 'ui.unavailable');
      else if (PANEL_TOGGLE_DOMAINS.includes(domain)) {
        active = isOn(state);
        value = active ? t(lang, 'ui.on') : t(lang, 'ui.off');
      } else if (PANEL_SELECT_DOMAINS.includes(domain)) {
        value = state;
        active = !['off', 'none'].includes(normKey(state));
      } else if (PANEL_PRESS_DOMAINS[domain]) {
        value = tile.btn.classList.contains('pressed') ? t(lang, 'ui.pressed') : domain === 'script' || domain === 'scene' ? t(lang, 'ui.run') : t(lang, 'ui.press');
      } else {
        readonly = true;
        value = domain === 'binary_sensor' ? (isOn(state) ? t(lang, 'ui.on') : t(lang, 'ui.off')) : _panel_fmtSensor(s);
        active = domain === 'binary_sensor' && isOn(state);
      }
      _panel_text(tile.value, value);
      tile.btn.classList.toggle('active', active);
      tile.btn.classList.toggle('readonly', readonly);
      tile.chev.hidden = readonly || !PANEL_SELECT_DOMAINS.includes(domain);
      _panel_prop(tile.btn, 'disabled', unavailable && !readonly);
      _panel_attr(tile.btn, 'aria-label', tile.label.textContent + ': ' + value);
      _panel_attr(tile.btn, 'aria-pressed', PANEL_TOGGLE_DOMAINS.includes(domain) ? (active ? 'true' : 'false') : null);
    }
  }

  // ---------------------------------------------------------------- actions
  _call(service, data, entityId) {
    const id = entityId || (this._config && this._config.entity);
    return callClimate(this._hass, service, id, data).catch((err) => {
      console.error('[acha-card] service call failed:', service, id, err);
      this._pendingT = null;
      this._opt = {};
      this._optExtra = {};
      this._powerPending = null;
      this._schedule();
    });
  }

  _onPower(ev) {
    if (ev) ev.stopPropagation();
    const vm = this._vm;
    if (!vm || vm.unavailable || !vm.st) return;
    _panel_haptic(10);
    const st = vm.st;
    const modes = vm.modes;
    if (vm.on) {
      this._powerPending = { on: false, until: Date.now() + PANEL_OPT_MS };
      if (supports(st, SUPPORT.TURN_OFF) || !modes.includes('off')) this._call('turn_off');
      else this._call('set_hvac_mode', { hvac_mode: 'off' });
    } else {
      this._powerPending = { on: true, until: Date.now() + PANEL_OPT_MS };
      if (supports(st, SUPPORT.TURN_ON)) this._call('turn_on');
      else this._call('set_hvac_mode', { hvac_mode: this._powerOnMode(st, vm.prof) });
    }
    this._armExpiry(PANEL_OPT_MS);
    this._safeRender();
  }

  _setPending(detail) {
    const vm = this._vm;
    if (!vm) return;
    if (vm.dual && detail && detail.low !== undefined) {
      this._pendingT = { dual: true, low: detail.low, high: detail.high, until: Date.now() + PANEL_DEBOUNCE_MS + PANEL_HOLD_MS };
    } else if (detail && detail.value !== undefined && detail.value !== null) {
      this._pendingT = { dual: false, value: detail.value, until: Date.now() + PANEL_DEBOUNCE_MS + PANEL_HOLD_MS };
    }
  }

  _onDialInput(ev) {
    ev.stopPropagation();
    this._setPending(ev.detail);
    this._sendTemp.cancel();
  }

  _onDialChange(ev) {
    ev.stopPropagation();
    this._setPending(ev.detail);
    this._sendTemp();
    this._safeRender();
  }

  _flushTemp() {
    const pt = this._pendingT;
    if (!pt) return;
    pt.until = Date.now() + PANEL_HOLD_MS;
    this._armExpiry(PANEL_HOLD_MS);
    if (pt.dual) this._call('set_temperature', { target_temp_low: pt.low, target_temp_high: pt.high });
    else this._call('set_temperature', { temperature: pt.value });
  }

  /** ± buttons: one step on press, auto-repeat while held; keyboard click = one step. */
  _bindStepper(btn, dir) {
    btn.addEventListener('pointerdown', (ev) => {
      if (btn.disabled || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      ev.preventDefault();
      try {
        btn.setPointerCapture(ev.pointerId);
      } catch (e) {
        /* unsupported */
      }
      this._stopRepeat();
      btn.classList.add('pressed');
      this._stepBy(dir);
      const timer = setTimeout(() => {
        this._repeat.interval = setInterval(() => {
          if (!this._stepBy(dir)) this._stopRepeat();
        }, PANEL_REPEAT_EVERY);
      }, PANEL_REPEAT_DELAY);
      this._repeat = { btn, timer, interval: 0 };
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(type, this._stopRepeat);
    btn.addEventListener('click', (ev) => {
      if (ev.detail === 0) this._stepBy(dir); // keyboard activation
    });
    btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  _stopRepeat() {
    const r = this._repeat;
    if (!r) return;
    this._repeat = null;
    clearTimeout(r.timer);
    clearInterval(r.interval);
    r.btn.classList.remove('pressed');
  }

  /** Move the setpoint one step; returns false when at the limit. */
  _stepBy(dir) {
    const vm = this._vm;
    if (!vm || !vm.canSetTemp) return false;
    const step = vm.step;
    const snap = (v) => clamp(roundToStep(v, step), vm.min, vm.max);
    let detail;
    if (vm.dual) {
      const low = snap(vm.low + dir * step);
      const high = snap(vm.high + dir * step);
      if (high - low < step / 2 || (low === vm.low && high === vm.high)) return false;
      detail = { low, high };
    } else {
      if (vm.target === null) return false;
      const value = snap(vm.target + dir * step);
      if (value === vm.target) return false;
      detail = { value };
    }
    _panel_haptic(5);
    this._setPending(detail);
    this._sendTemp();
    this._safeRender();
    return true;
  }

  async _openKind(def, btn, ev) {
    const vm = this._vm;
    if (!vm || vm.unavailable || !this._els.sheet.open) return;
    const lang = vm.lang;
    const values = this._orderedOptions(def, vm);
    if (!values.length) return;
    const cur = this._currentOf(def, vm);
    const options = values.map((v) => {
      const d = describeOption(def.kind, v, vm.prof, lang);
      return { value: v, label: d.label, icon: d.icon, color: d.color || undefined };
    });
    _panel_haptic(6);
    const picked = await this._els.sheet.open(t(lang, def.title), options, cur, { closeLabel: t(lang, 'ui.close') });
    if (picked === null || picked === undefined || picked === cur) return;
    this._setOpt(def.kind, picked);
    if (def.kind === 'hvac_mode') {
      this._powerPending = null;
      this._call('set_hvac_mode', { hvac_mode: picked });
    } else this._call(def.service, { [def.attr]: picked });
    this._safeRender();
    void btn;
    void ev;
  }

  _onPresetToggle(value) {
    const vm = this._vm;
    if (!vm || vm.unavailable) return;
    const presets = _panel_list(vm.st, 'preset_modes').map(String);
    const cur = this._currentOf(PANEL_KINDS[4], vm);
    const active = cur !== null && _panel_presetCanon(cur) === _panel_presetCanon(value);
    let next = value;
    if (active) {
      next = presets.find((p) => normKey(p) === 'none');
      if (!next) return;
    }
    _panel_haptic(8);
    this._setOpt('preset_mode', next);
    this._call('set_preset_mode', { preset_mode: next });
    this._safeRender();
  }

  async _onExtra(x, tile, ev) {
    const id = x.entity;
    const domain = _panel_domain(id);
    const { s, state } = this._extraState(id);
    if (_panel_extraUnavailable(s, domain)) return;
    const lang = this._lang;
    if (PANEL_TOGGLE_DOMAINS.includes(domain)) {
      _panel_haptic(8);
      this._optExtra[id] = { state: isOn(state) ? 'off' : 'on', until: Date.now() + PANEL_OPT_MS };
      this._armExpiry(PANEL_OPT_MS);
      this._call('homeassistant.toggle', undefined, id);
      this._safeRender();
    } else if (PANEL_SELECT_DOMAINS.includes(domain)) {
      const opts = Array.isArray(s.attributes && s.attributes.options) ? s.attributes.options.map(String) : [];
      if (!opts.length) return;
      const title = x.name || (s.attributes && s.attributes.friendly_name) || id;
      const picked = await this._els.sheet.open(
        title,
        opts.map((o) => ({ value: o, label: o, icon: normKey(o) === 'off' ? 'mdi:close-circle-outline' : 'mdi:checkbox-blank-circle-outline' })),
        state,
        { closeLabel: t(lang, 'ui.close'), layout: opts.length > 6 ? 'list' : 'grid' }
      );
      if (picked === null || picked === undefined || picked === state) return;
      this._optExtra[id] = { state: picked, until: Date.now() + PANEL_OPT_MS };
      this._armExpiry(PANEL_OPT_MS);
      this._call(domain + '.select_option', { option: picked }, id);
      this._safeRender();
    } else if (PANEL_PRESS_DOMAINS[domain]) {
      _panel_haptic(12);
      this._call(PANEL_PRESS_DOMAINS[domain], undefined, id);
      tile.btn.classList.add('pressed');
      this._safeRender();
      setTimeout(() => {
        tile.btn.classList.remove('pressed');
        this._schedule();
      }, 900);
    } else {
      fireEvent(this, 'hass-more-info', { entityId: id });
    }
    void ev;
  }

  // ---------------------------------------------------------------- long-press → more-info
  _bindLongPress(btn, getId) {
    btn.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      this._cancelPress();
      const p = { x: ev.clientX, y: ev.clientY, fired: false, btn };
      p.timer = setTimeout(() => {
        p.fired = true;
        const id = getId();
        if (!id) return;
        _panel_haptic(20);
        btn.classList.remove('pressed');
        fireEvent(this, 'hass-more-info', { entityId: id });
      }, PANEL_LONGPRESS_MS);
      this._press = p;
    });
    btn.addEventListener('pointermove', (ev) => {
      const p = this._press;
      if (p && !p.fired && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > 10) this._cancelPress();
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
      btn.addEventListener(type, () => {
        const p = this._press;
        if (p && !p.fired) this._cancelPress();
      });
    }
    btn.addEventListener('contextmenu', (ev) => {
      if (this._press) ev.preventDefault();
    });
  }

  _cancelPress() {
    const p = this._press;
    if (p) clearTimeout(p.timer);
    if (p && !p.fired) this._press = null;
  }

  /** True (and resets) when the click that follows a fired long-press should be swallowed. */
  _consumePress() {
    const p = this._press;
    if (p && p.fired) {
      this._press = null;
      return true;
    }
    return false;
  }
}

if (!customElements.get('acha-panel')) customElements.define('acha-panel', AchaPanel);

// ===== src/editor.js =====
// acha-card-editor — visual editor for custom:acha-card (Lovelace UI editor).
// Uses HA's <ha-form> (lazy-loaded via loadCardHelpers) with a native-input fallback when it is not available.
// API: setConfig(config), hass; emits `config-changed` {config}. Bundling: private names prefixed EDITOR_ / _editor_.


const EDITOR_HIDE_KEYS = ['modes', 'fan', 'swing', 'swing_horizontal', 'preset', 'power_btn'];
const EDITOR_ENUMS = {
  profile: ['auto', 'daikin', 'daikin_onecta', 'generic'],
  theme: ['auto', 'dark', 'light'],
  layout: ['tabs', 'stack', 'grid'],
  language: ['auto', 'pt', 'en'],
};
const EDITOR_SENSORS = ['indoor_temperature', 'outdoor_temperature', 'humidity', 'power'];
const EDITOR_NUMS = ['min_temp', 'max_temp', 'step'];
const EDITOR_WAIT_MS = 3000;

const EDITOR_CSS = `
:host { display: block; }
.root { display: flex; flex-direction: column; gap: 16px; }
.section-title { margin: 8px 0 0; font-size: 15px; font-weight: 500; color: var(--primary-text-color); }
.entries { display: flex; flex-direction: column; gap: 10px; }
ha-expansion-panel, details.entry {
  display: block;
  border: 1px solid var(--divider-color, rgba(127, 127, 127, .3));
  border-radius: 12px;
  --expansion-panel-summary-padding: 0 12px;
  --expansion-panel-content-padding: 0 12px 12px;
}
details.entry > summary { padding: 12px; cursor: pointer; font-weight: 500; }
details.entry > .body { padding: 0 12px 12px; }
.head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.head ha-icon { color: var(--secondary-text-color); --mdc-icon-size: 20px; }
.head .ttl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.head .sub { color: var(--secondary-text-color); font-size: 12px; font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 34px; padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--divider-color, rgba(127, 127, 127, .35));
  background: transparent;
  color: var(--primary-text-color);
  font: inherit; font-size: 13px;
  cursor: pointer;
  --mdc-icon-size: 18px;
}
.btn:hover { background: var(--secondary-background-color, rgba(127, 127, 127, .1)); }
.btn[disabled] { opacity: .4; pointer-events: none; }
.btn.danger { color: var(--error-color, #db4437); }
.btn.add { align-self: flex-start; color: var(--primary-color, #03a9f4); border-color: currentColor; }
.loading { color: var(--secondary-text-color); font-size: 13px; }
.fb { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px 12px; }
.fb label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--secondary-text-color); }
.fb label.check { flex-direction: row; align-items: center; gap: 8px; font-size: 14px; color: var(--primary-text-color); }
.fb input[type=text], .fb input[type=number], .fb select {
  height: 36px; padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--divider-color, rgba(127, 127, 127, .35));
  background: var(--card-background-color, transparent);
  color: var(--primary-text-color);
  font: inherit; font-size: 14px;
}
.fb .wide { grid-column: 1 / -1; }
.fb .hide { display: flex; flex-wrap: wrap; gap: 6px 14px; }
`;

function _editor_el(tag, cls, attrs) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (attrs) for (const k of Object.keys(attrs)) node.setAttribute(k, attrs[k]);
  return node;
}

function _editor_clean(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  return out;
}

/** Card config → editor model { card-level..., entities: [object...] } (never throws). */
function _editor_model(config) {
  const cfg = config && typeof config === 'object' ? { ...config } : {};
  const list = [];
  if (cfg.entity) list.push(cfg.entity);
  if (Array.isArray(cfg.entities)) list.push(...cfg.entities);
  else if (cfg.entities) list.push(cfg.entities);
  delete cfg.entity;
  cfg.entities = list
    .map((e) => (typeof e === 'string' ? { entity: e } : e && typeof e === 'object' ? { ...e } : null))
    .filter(Boolean);
  return cfg;
}

/** JSON with sorted keys, for comparing configs regardless of key order. */
function _editor_stable(v) {
  if (Array.isArray(v)) return '[' + v.map(_editor_stable).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + _editor_stable(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

function _editor_wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Trigger HA's lazy loading of ha-form / pickers, then wait (bounded) for ha-form. */
async function _editor_loadHaForm() {
  if (customElements.get('ha-form')) return true;
  try {
    if (typeof window.loadCardHelpers === 'function') {
      const helpers = await window.loadCardHelpers();
      if (helpers && helpers.createCardElement) {
        const c = await helpers.createCardElement({ type: 'entities', entities: [] });
        if (c && c.constructor && c.constructor.getConfigElement) await c.constructor.getConfigElement();
      }
    }
  } catch (e) {
    /* best effort */
  }
  await Promise.race([customElements.whenDefined('ha-form'), _editor_wait(EDITOR_WAIT_MS)]);
  return !!customElements.get('ha-form');
}

class AchaCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = null;
    this._hass = null;
    this._haForm = !!customElements.get('ha-form');
    this._loading = !this._haForm;
    this._structure = '';
    this._forms = [];
    this._ui = null;
  }

  set hass(hass) {
    this._hass = hass;
    for (const f of this._forms) if (f && f.tagName === 'HA-FORM') f.hass = hass;
    const lang = this._langNow();
    if (lang !== this._lang) this._render();
  }

  get hass() {
    return this._hass;
  }

  setConfig(config) {
    // HA hands our own emitted config straight back: keep the local model (it may hold a blank,
    // not-yet-emitted entry the user just added).
    if (this._config && this._lastEmitted && _editor_stable(config) === this._lastEmitted) {
      this._patch();
      return;
    }
    this._config = _editor_model(config);
    this._render();
  }

  connectedCallback() {
    if (this._loading && !this._loadStarted) {
      this._loadStarted = true;
      _editor_loadHaForm().then((ok) => {
        this._haForm = ok;
        this._loading = false;
        this._structure = '';
        this._render();
      });
    }
    this._render();
  }

  _langNow() {
    try {
      return resolveLang(this._hass, this._config ? this._config.language : 'auto');
    } catch (e) {
      return 'en';
    }
  }

  _L(key, vars) {
    return t(this._lang, key, vars);
  }

  /** Emit the config (entries without an entity stay local until one is picked). */
  _emit() {
    const cfg = { ...this._config };
    cfg.entities = cfg.entities.map((e) => _editor_clean(e)).filter((e) => e.entity);
    const out = _editor_clean(cfg);
    if (!out.entities) out.entities = [];
    if (out.show_unit === true) delete out.show_unit;
    this._lastEmitted = _editor_stable(out);
    fireEvent(this, 'config-changed', { config: out });
  }

  // ---------------------------------------------------------------- schemas
  _opts(key) {
    return EDITOR_ENUMS[key].map((v) => ({ value: v, label: this._L(`editor.${key}_${v}`) }));
  }

  _cardSchema() {
    const sel = (key) => ({ name: key, selector: { select: { mode: 'dropdown', options: this._opts(key) } } });
    return [
      { name: 'title', selector: { text: {} } },
      { type: 'grid', name: '', schema: [sel('profile'), sel('theme'), sel('layout'), sel('language')] },
      { name: 'show_unit', selector: { boolean: {} } },
    ];
  }

  _entrySchema() {
    const sensor = (name, deviceClass) => ({
      name,
      selector: { entity: { filter: deviceClass ? { domain: 'sensor', device_class: deviceClass } : { domain: 'sensor' } } },
    });
    const num = (name, min, max, step) => ({ name, selector: { number: { min, max, step, mode: 'box' } } });
    return [
      { name: 'entity', required: true, selector: { entity: { filter: { domain: 'climate' } } } },
      { type: 'grid', name: '', schema: [{ name: 'name', selector: { text: {} } }, { name: 'icon', selector: { icon: {} } }] },
      {
        type: 'grid',
        name: '',
        schema: [sensor('indoor_temperature', 'temperature'), sensor('outdoor_temperature', 'temperature'), sensor('humidity', 'humidity'), sensor('power')],
      },
      { type: 'grid', name: '', schema: [num('min_temp', 5, 40, 0.5), num('max_temp', 5, 40, 0.5), num('step', 0.1, 5, 0.1)] },
      {
        name: 'hide',
        selector: { select: { multiple: true, mode: 'list', options: EDITOR_HIDE_KEYS.map((k) => ({ value: k, label: this._L('editor.hide_' + k) })) } },
      },
      { name: 'extras', selector: { entity: { multiple: true } } },
    ];
  }

  _computeLabel = (s) => (s && s.name ? this._L('editor.' + s.name) : '');

  // ---------------------------------------------------------------- render
  _render() {
    if (!this._config) return;
    this._lang = this._langNow();
    const n = this._config.entities.length;
    const structure = [this._loading, this._haForm, this._lang, n].join('|');
    if (structure !== this._structure || !this._ui) {
      this._structure = structure;
      this._build();
    }
    this._patch();
  }

  _build() {
    const sr = this.shadowRoot;
    sr.textContent = '';
    const style = _editor_el('style');
    style.textContent = EDITOR_CSS;
    const root = _editor_el('div', 'root');
    sr.append(style, root);
    this._forms = [];
    this._ui = { root, heads: [] };
    if (this._loading) {
      const p = _editor_el('div', 'loading');
      p.textContent = this._L('editor.loading');
      root.appendChild(p);
      return;
    }

    const general = _editor_el('h3', 'section-title');
    general.textContent = this._L('editor.general');
    root.appendChild(general);
    root.appendChild(this._haForm ? this._mkHaForm(this._cardSchema(), (v) => this._onCard(v)) : this._mkFallbackCard());

    const listTitle = _editor_el('h3', 'section-title');
    listTitle.textContent = this._L('editor.entities');
    root.appendChild(listTitle);
    const list = _editor_el('div', 'entries');
    root.appendChild(list);
    const n = this._config.entities.length;
    for (let i = 0; i < n; i++) list.appendChild(this._mkEntry(i, n));

    const add = _editor_el('button', 'btn add', { type: 'button' });
    add.append(_editor_el('ha-icon', '', { icon: 'mdi:plus' }), document.createTextNode(this._L('editor.add_ac')));
    add.addEventListener('click', () => {
      this._config.entities.push({ entity: '' });
      this._openIndex = this._config.entities.length - 1;
      this._emit();
      this._render();
    });
    root.appendChild(add);
  }

  _mkHaForm(schema, onChange) {
    const form = document.createElement('ha-form');
    form.schema = schema;
    form.computeLabel = this._computeLabel;
    if (this._hass) form.hass = this._hass;
    form.addEventListener('value-changed', (ev) => {
      ev.stopPropagation();
      onChange((ev.detail && ev.detail.value) || {});
    });
    this._forms.push(form);
    return form;
  }

  _mkEntry(i, n) {
    const useExp = this._haForm && !!customElements.get('ha-expansion-panel');
    const wrap = useExp ? document.createElement('ha-expansion-panel') : _editor_el('details', 'entry');
    const head = _editor_el('div', 'head', useExp ? { slot: 'header' } : {});
    const icon = _editor_el('ha-icon', '', { icon: 'mdi:air-conditioner' });
    const texts = _editor_el('div');
    const ttl = _editor_el('div', 'ttl');
    const sub = _editor_el('div', 'sub');
    texts.append(ttl, sub);
    head.append(icon, texts);
    const body = useExp ? _editor_el('div') : _editor_el('div', 'body');
    if (useExp) {
      wrap.outlined = true;
      wrap.appendChild(head);
    } else {
      const summary = _editor_el('summary');
      summary.appendChild(head);
      wrap.appendChild(summary);
    }
    if (this._openIndex === i || n === 1) {
      if (useExp) wrap.expanded = true;
      else wrap.open = true;
    }
    body.appendChild(this._haForm ? this._mkHaForm(this._entrySchema(), (v) => this._onEntry(i, v)) : this._mkFallbackEntry(i));

    const actions = _editor_el('div', 'actions');
    const mk = (iconName, label, cls, disabled, fn) => {
      const b = _editor_el('button', 'btn' + (cls ? ' ' + cls : ''), { type: 'button', title: label, 'aria-label': label });
      b.append(_editor_el('ha-icon', '', { icon: iconName }), document.createTextNode(label));
      b.disabled = disabled;
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        fn();
      });
      return b;
    };
    actions.append(
      mk('mdi:arrow-up', this._L('editor.move_up'), '', i === 0, () => this._move(i, -1)),
      mk('mdi:arrow-down', this._L('editor.move_down'), '', i === n - 1, () => this._move(i, 1)),
      mk('mdi:delete-outline', this._L('editor.remove'), 'danger', false, () => this._remove(i))
    );
    body.appendChild(actions);
    wrap.appendChild(body);
    this._ui.heads[i] = { icon, ttl, sub };
    return wrap;
  }

  _cardData() {
    const c = this._config;
    return {
      title: c.title || '',
      profile: c.profile || 'auto',
      theme: c.theme || 'auto',
      layout: c.layout || 'tabs',
      language: c.language || 'auto',
      show_unit: c.show_unit !== false,
    };
  }

  _entryData(e) {
    const d = { ...e };
    d.extras = Array.isArray(e.extras) ? e.extras.map((x) => (typeof x === 'string' ? x : x && x.entity)).filter(Boolean) : [];
    d.hide = Array.isArray(e.hide) ? e.hide : e.hide ? [e.hide] : [];
    return d;
  }

  _patch() {
    if (this._loading || !this._ui) return;
    const entries = this._config.entities;
    if (this._haForm) {
      const [cardForm, ...entryForms] = this._forms;
      if (cardForm) cardForm.data = this._cardData();
      entryForms.forEach((f, i) => {
        if (entries[i]) f.data = this._entryData(entries[i]);
      });
    } else this._patchFallback();
    entries.forEach((e, i) => {
      const h = this._ui.heads[i];
      if (!h) return;
      const st = this._hass && this._hass.states && e.entity ? this._hass.states[e.entity] : null;
      const friendly = st && st.attributes && st.attributes.friendly_name;
      h.ttl.textContent = e.name || friendly || this._L('editor.entry', { n: i + 1 });
      h.sub.textContent = e.entity || this._L('editor.no_entity');
      h.icon.setAttribute('icon', e.icon || 'mdi:air-conditioner');
    });
  }

  // ---------------------------------------------------------------- changes
  _onCard(v) {
    const c = this._config;
    for (const key of ['title', 'profile', 'theme', 'layout', 'language']) {
      if (v[key] === undefined || v[key] === '' || v[key] === null) delete c[key];
      else c[key] = v[key];
    }
    if (c.profile === 'auto') delete c.profile;
    if (v.show_unit === false) c.show_unit = false;
    else delete c.show_unit;
    this._emit();
    this._render();
  }

  _onEntry(i, v) {
    const prev = this._config.entities[i] || {};
    const next = { ...v };
    const prevExtras = new Map((Array.isArray(prev.extras) ? prev.extras : []).map((x) => (typeof x === 'string' ? [x, { entity: x }] : [x.entity, x])));
    const ids = Array.isArray(v.extras) ? v.extras : [];
    next.extras = ids.filter(Boolean).map((id) => prevExtras.get(id) || { entity: id });
    for (const k of EDITOR_NUMS) {
      if (next[k] === '' || next[k] === null || next[k] === undefined || !Number.isFinite(Number(next[k]))) delete next[k];
      else next[k] = Number(next[k]);
    }
    if (Array.isArray(next.hide) && !next.hide.length) delete next.hide;
    if (!next.extras.length) delete next.extras;
    this._config.entities[i] = next;
    this._emit();
    this._patch();
  }

  _move(i, dir) {
    const list = this._config.entities;
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this._openIndex = j;
    this._structure = '';
    this._emit();
    this._render();
  }

  _remove(i) {
    this._config.entities.splice(i, 1);
    this._openIndex = -1;
    this._structure = '';
    this._emit();
    this._render();
  }

  // ---------------------------------------------------------------- native fallback (no ha-form)
  _fbInput(label, type, onChange, cls) {
    const wrap = _editor_el('label', cls || '');
    const span = _editor_el('span');
    span.textContent = label;
    const input = _editor_el('input', '', { type });
    if (type === 'number') input.step = 'any';
    input.addEventListener('change', () => onChange(type === 'checkbox' ? input.checked : input.value));
    if (type === 'checkbox') wrap.append(input, span);
    else wrap.append(span, input);
    return { wrap, input };
  }

  _fbSelect(key, onChange) {
    const wrap = _editor_el('label');
    const span = _editor_el('span');
    span.textContent = this._L('editor.' + key);
    const sel = _editor_el('select');
    for (const o of this._opts(key)) {
      const opt = _editor_el('option', '', { value: o.value });
      opt.textContent = o.label;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => onChange(sel.value));
    wrap.append(span, sel);
    return { wrap, input: sel };
  }

  _mkFallbackCard() {
    const box = _editor_el('div', 'fb');
    const f = {};
    const set = (key) => (val) => {
      const v = this._cardData();
      v[key] = val;
      this._onCard(v);
    };
    f.title = this._fbInput(this._L('editor.title'), 'text', set('title'), 'wide');
    for (const k of ['profile', 'theme', 'layout', 'language']) f[k] = this._fbSelect(k, set(k));
    f.show_unit = this._fbInput(this._L('editor.show_unit'), 'checkbox', set('show_unit'), 'check wide');
    for (const k of Object.keys(f)) box.appendChild(f[k].wrap);
    this._fbCard = f;
    this._fbEntries = [];
    return box;
  }

  _mkFallbackEntry(i) {
    const box = _editor_el('div', 'fb');
    const f = {};
    const set = (key) => (val) => {
      const d = this._entryData(this._config.entities[i] || {});
      if (key === 'extras') d.extras = String(val).split(',').map((s) => s.trim()).filter(Boolean);
      else d[key] = val;
      this._onEntry(i, d);
    };
    f.entity = this._fbInput(this._L('editor.entity'), 'text', set('entity'), 'wide');
    f.name = this._fbInput(this._L('editor.name'), 'text', set('name'));
    f.icon = this._fbInput(this._L('editor.icon'), 'text', set('icon'));
    for (const k of EDITOR_SENSORS) f[k] = this._fbInput(this._L('editor.' + k), 'text', set(k));
    for (const k of EDITOR_NUMS) f[k] = this._fbInput(this._L('editor.' + k), 'number', set(k));
    f.extras = this._fbInput(this._L('editor.extras'), 'text', set('extras'), 'wide');
    for (const k of Object.keys(f)) box.appendChild(f[k].wrap);
    const hideWrap = _editor_el('div', 'wide');
    const hideTitle = _editor_el('label');
    hideTitle.textContent = this._L('editor.hide');
    const hideBox = _editor_el('div', 'hide');
    f.hide = {};
    for (const key of EDITOR_HIDE_KEYS) {
      const cb = this._fbInput(this._L('editor.hide_' + key), 'checkbox', () => {
        const d = this._entryData(this._config.entities[i] || {});
        d.hide = EDITOR_HIDE_KEYS.filter((k) => f.hide[k].input.checked);
        this._onEntry(i, d);
      }, 'check');
      f.hide[key] = cb;
      hideBox.appendChild(cb.wrap);
    }
    hideWrap.append(hideTitle, hideBox);
    box.appendChild(hideWrap);
    this._fbEntries[i] = f;
    return box;
  }

  _patchFallback() {
    const setVal = (input, v) => {
      if (!input || this.shadowRoot.activeElement === input) return;
      if (input.type === 'checkbox') input.checked = !!v;
      else input.value = v === undefined || v === null ? '' : String(v);
    };
    const c = this._cardData();
    if (this._fbCard) for (const k of Object.keys(this._fbCard)) setVal(this._fbCard[k].input, c[k]);
    (this._fbEntries || []).forEach((f, i) => {
      const e = this._config.entities[i];
      if (!f || !e) return;
      const d = this._entryData(e);
      for (const k of ['entity', 'name', 'icon', ...EDITOR_SENSORS, ...EDITOR_NUMS]) setVal(f[k].input, d[k]);
      setVal(f.extras.input, d.extras.join(', '));
      for (const k of EDITOR_HIDE_KEYS) setVal(f.hide[k].input, d.hide.includes(k));
    });
  }
}

if (!customElements.get('acha-card-editor')) customElements.define('acha-card-editor', AchaCardEditor);

// ===== src/acha-card.js =====
// ACHA Card — entry point: config normalisation, multi-AC switcher, layouts, registration.
// Element: <acha-card> (Lovelace `type: custom:acha-card`).
// Bundling rules: named exports only, single-line relative imports, private top-level names prefixed `_card_`.


const ACHA_CARD_VERSION = '1.0.0';

// Referenced so the module graph (and any tree-shaker) keeps every component file.
const _card_COMPONENTS = [AchaDial, AchaUnit, AchaSheet, AchaPanel, AchaCardEditor];

const _card_DEFAULTS = Object.freeze({
  profile: 'auto',
  theme: 'auto',
  layout: 'tabs',
  show_unit: true,
  language: 'auto',
});

const _card_ENUMS = Object.freeze({
  profile: ['auto', 'daikin', 'daikin_onecta', 'generic'],
  theme: ['auto', 'dark', 'light'],
  layout: ['tabs', 'stack', 'grid'],
  language: ['auto', 'pt', 'en'],
});

const _card_HIDE_KEYS = ['modes', 'fan', 'swing', 'swing_horizontal', 'preset', 'power_btn'];

// Fallback mode palette (ARCHITECTURE.md) used when profiles.js cannot resolve a colour.
const _card_PALETTE = Object.freeze({
  cool: '#3fa9f5',
  heat: '#ff8a3d',
  heat_cool: '#9b7cff',
  auto: '#9b7cff',
  dry: '#2ec4b6',
  fan_only: '#9aa5b1',
  off: '#6b7280',
});

// Structural rules only (no theme colours): `hidden` must beat the display:flex rules of ACHA_CARD_CSS,
// and a drag must not select text.
const _card_EXTRA_CSS = `
[hidden] { display: none !important; }
.acha-track.dragging { -webkit-user-select: none; user-select: none; }
`;

const _card_STORAGE_PREFIX = 'acha-card:selected:';
const _card_SWIPE_SLOP = 10; // px before deciding horizontal vs vertical
const _card_SWIPE_RATIO = 0.18; // fraction of width that commits a swipe
const _card_SWIPE_VELOCITY = 0.45; // px/ms that commits a swipe regardless of distance

function _card_err(msg) {
  return new Error('ACHA Card: ' + msg);
}

function _card_isEntityId(v) {
  return typeof v === 'string' && /^[a-z0-9_]+\.[a-z0-9_]+$/i.test(v.trim());
}

function _card_plainObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _card_enum(key, value) {
  if (value === undefined || value === null || value === '') return _card_DEFAULTS[key];
  const v = String(value).toLowerCase().trim();
  if (_card_ENUMS[key].includes(v)) return v;
  console.warn(`[acha-card] invalid ${key} "${value}", using "${_card_DEFAULTS[key]}"`);
  return _card_DEFAULTS[key];
}

function _card_bool(v, dflt) {
  if (v === undefined || v === null) return dflt;
  if (typeof v === 'string') return !['false', 'no', 'off', '0', ''].includes(v.toLowerCase().trim());
  return !!v;
}

function _card_num(v) {
  if (v === undefined || v === null || v === '' || typeof v === 'boolean') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function _card_list(v) {
  if (v === undefined || v === null || v === '') return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [v];
}

/** Extra tile entries: strings or objects with `entity`. Invalid ones are dropped with a warning. */
function _card_normExtras(raw) {
  const out = [];
  for (const item of _card_list(raw)) {
    const obj = typeof item === 'string' ? { entity: item } : _card_plainObj(item);
    if (!obj || !_card_isEntityId(obj.entity)) {
      console.warn('[acha-card] ignoring invalid extra:', item);
      continue;
    }
    out.push({ ...obj, entity: obj.entity.trim() });
  }
  return out;
}

/** One AC entry (string or object) → normalised object. Throws a helpful Error when unusable. */
function _card_normEntry(raw, index) {
  const obj = typeof raw === 'string' ? { entity: raw } : _card_plainObj(raw);
  if (!obj) throw _card_err(`entities[${index}] must be an entity id or an object with "entity".`);
  const entity = typeof obj.entity === 'string' ? obj.entity.trim() : obj.entity;
  if (!_card_isEntityId(entity)) {
    throw _card_err(`entities[${index}] has an invalid "entity" (${JSON.stringify(obj.entity)}). Example: climate.ac_sala`);
  }
  if (!entity.startsWith('climate.')) {
    console.warn(`[acha-card] ${entity} is not a climate entity; controls may not work.`);
  }
  const entry = { ...obj, entity };
  for (const key of ['indoor_temperature', 'outdoor_temperature', 'humidity', 'power']) {
    if (entry[key] === undefined || entry[key] === null || entry[key] === '') delete entry[key];
    else if (!_card_isEntityId(entry[key])) {
      console.warn(`[acha-card] ${entity}: ignoring invalid ${key} "${entry[key]}"`);
      delete entry[key];
    } else entry[key] = String(entry[key]).trim();
  }
  entry.extras = _card_normExtras(obj.extras);
  entry.hide = _card_list(obj.hide).map((h) => String(h).trim().toLowerCase()).filter((h) => {
    const ok = _card_HIDE_KEYS.includes(h);
    if (!ok) console.warn(`[acha-card] ${entity}: unknown hide key "${h}"`);
    return ok;
  });
  for (const key of ['min_temp', 'max_temp', 'step']) {
    const n = _card_num(obj[key]);
    if (n === undefined) delete entry[key];
    else entry[key] = n;
  }
  if (entry.step !== undefined && entry.step <= 0) delete entry.step;
  if (entry.min_temp !== undefined && entry.max_temp !== undefined && entry.min_temp > entry.max_temp) {
    [entry.min_temp, entry.max_temp] = [entry.max_temp, entry.min_temp];
  }
  for (const key of ['labels', 'icons', 'colors']) {
    const o = _card_plainObj(obj[key]);
    if (o) entry[key] = o;
    else delete entry[key];
  }
  if (entry.profile !== undefined) entry.profile = _card_enum('profile', entry.profile);
  if (entry.name !== undefined && entry.name !== null) entry.name = String(entry.name);
  if (typeof entry.icon !== 'string' || !entry.icon.trim()) delete entry.icon;
  return entry;
}

/** Whole card config → { card-level options..., entities: [entry...] }. Throws helpful Errors. */
function _card_normConfig(config) {
  if (!_card_plainObj(config)) throw _card_err('invalid configuration (expected an object).');
  const rawEntries = [];
  if (config.entity !== undefined && config.entity !== null && config.entity !== '') rawEntries.push(config.entity);
  if (config.entities !== undefined && config.entities !== null) {
    if (!Array.isArray(config.entities)) {
      if (typeof config.entities === 'string' || _card_plainObj(config.entities)) rawEntries.push(config.entities);
      else throw _card_err('"entities" must be a list.');
    } else rawEntries.push(...config.entities);
  }
  if (!rawEntries.length) {
    throw _card_err('define at least one climate entity — e.g. "entity: climate.ac_sala" or "entities: [climate.ac_sala, climate.ac_quarto]". / Defina pelo menos uma entidade climate.');
  }
  const seen = new Set();
  const entities = [];
  rawEntries.forEach((raw, i) => {
    const entry = _card_normEntry(raw, i);
    if (seen.has(entry.entity)) {
      console.warn(`[acha-card] duplicate entity ${entry.entity} ignored`);
      return;
    }
    seen.add(entry.entity);
    entities.push(entry);
  });
  const out = { ...config };
  delete out.entity;
  out.entities = entities;
  out.profile = _card_enum('profile', config.profile);
  out.theme = _card_enum('theme', config.theme);
  out.layout = _card_enum('layout', config.layout);
  out.language = _card_enum('language', config.language);
  out.show_unit = _card_bool(config.show_unit, _card_DEFAULTS.show_unit);
  if (config.title === undefined || config.title === null) delete out.title;
  else out.title = String(config.title);
  return out;
}

/** Card-level options merged under one entry → the `config` handed to <acha-panel>. */
function _card_panelConfig(cardCfg, entry, index) {
  const base = { ...cardCfg };
  delete base.entities;
  delete base.type;
  const merged = { ...base, ...entry, index };
  merged.profile = entry.profile || cardCfg.profile;
  return merged;
}

/** Hash-free stable storage key for a set of entities. */
function _card_storageKey(entities) {
  return _card_STORAGE_PREFIX + entities.map((e) => e.entity).join('|');
}

function _card_readStore(key) {
  try {
    return window.localStorage ? window.localStorage.getItem(key) : null;
  } catch (e) {
    return null;
  }
}

function _card_writeStore(key, value) {
  try {
    if (window.localStorage) window.localStorage.setItem(key, value);
  } catch (e) {
    /* private mode / blocked storage — ignore */
  }
}

function _card_reducedMotion() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) {
    return false;
  }
}

function _card_haptic(ms) {
  try {
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms);
  } catch (e) {
    /* unsupported */
  }
}

function _card_setText(node, text) {
  const v = text === undefined || text === null ? '' : String(text);
  if (node && node.textContent !== v) node.textContent = v;
}

function _card_el(tag, cls, attrs) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (attrs) for (const k of Object.keys(attrs)) node.setAttribute(k, attrs[k]);
  return node;
}

/** Mode colour for an entry/state (profile → user override → fallback palette). */
function _card_modeColor(entryCfg, st) {
  const mode = st && isOn(st) ? String(st.state) : 'off';
  let colors = null;
  try {
    const prof = resolveProfile(entryCfg, st);
    colors = prof && prof.colors;
  } catch (e) {
    colors = null;
  }
  const user = entryCfg && _card_plainObj(entryCfg.colors);
  return (user && user[mode]) || (colors && colors[mode]) || _card_PALETTE[mode] || _card_PALETTE.off;
}

/** Human mode label for a pill tooltip / aria label. */
function _card_modeLabel(entryCfg, st, lang) {
  if (!st || st.state === 'unavailable' || st.state === 'unknown') return t(lang, 'ui.unavailable');
  const mode = String(st.state);
  try {
    const prof = resolveProfile(entryCfg, st);
    const d = describeOption('hvac_mode', mode, prof, lang);
    if (d && d.label) return d.label;
  } catch (e) {
    /* fall back to i18n */
  }
  return t(lang, 'mode.' + mode);
}

/** Current indoor temperature (sensor → current_temperature attr), or null. */
function _card_currentTemp(hass, entry, st) {
  if (entry.indoor_temperature) {
    const s = stateObj(hass, entry.indoor_temperature);
    const v = numAttr(s);
    if (v !== null) return v;
  }
  return numAttr(st, 'current_temperature');
}

/** Turn one climate entity off using the best available service. */
function _card_turnOff(hass, st) {
  const id = st.entity_id;
  const modes = (st.attributes && st.attributes.hvac_modes) || [];
  if (supports(st, SUPPORT.TURN_OFF) || !modes.includes('off')) return callClimate(hass, 'turn_off', id);
  return callClimate(hass, 'set_hvac_mode', id, { hvac_mode: 'off' });
}

/** Entity ids whose state affects one panel (climate + optional sensors + extras). */
function _card_relevantIds(entry) {
  const ids = [entry.entity];
  for (const key of ['indoor_temperature', 'outdoor_temperature', 'humidity', 'power']) if (entry[key]) ids.push(entry[key]);
  for (const x of entry.extras || []) ids.push(x.entity);
  return ids;
}

/** True when anything a panel renders differs between two hass objects. */
function _card_hassChanged(prev, next, ids) {
  if (!prev || !next) return true;
  if (prev === next) return false;
  if (prev.locale !== next.locale || prev.language !== next.language) return true;
  if (prev.themes !== next.themes || prev.config !== next.config) return true;
  const a = prev.states || {};
  const b = next.states || {};
  for (const id of ids) if (a[id] !== b[id]) return true;
  return false;
}

const _card_EXCLUDE_TAGS = ['ACHA-DIAL', 'ACHA-SHEET', 'INPUT', 'TEXTAREA', 'SELECT', 'HA-SLIDER', 'HA-TEXTFIELD'];

/** Whether a pointerdown should be left alone by the swipe gesture (dial drag, open sheet, inputs...). */
function _card_swipeBlocked(ev) {
  const path = typeof ev.composedPath === 'function' ? ev.composedPath() : [];
  for (const node of path) {
    if (!node || node.nodeType !== 1) continue;
    if (node.classList && node.classList.contains('acha-viewport')) break;
    if (_card_EXCLUDE_TAGS.includes(node.tagName)) return true;
    if (node.hasAttribute('data-no-swipe') || node.getAttribute('role') === 'slider') return true;
    if (node.isContentEditable) return true;
  }
  return false;
}

class AchaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = null;
    this._hass = null;
    this._lang = 'en';
    this._theme = null;
    this._index = 0;
    this._recs = []; // [{ entry, cfg, el, pill, parts, ids, hass }]
    this._root = null;
    this._drag = null;
    this._suppressClick = false;
    this._suppressTimer = 0;
    this._heightTimer = 0;
    this._indRaf = 0;
    this._indPlaced = false;
    this._ro = null;
    this._busyOff = false;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onClickCapture = this._onClickCapture.bind(this);
    this._onSwitcherKey = this._onSwitcherKey.bind(this);
    this._onAllOff = this._onAllOff.bind(this);
    this._onResize = this._onResize.bind(this);
  }

  // ---------------------------------------------------------------- Lovelace API

  static getConfigElement() {
    return document.createElement('acha-card-editor');
  }

  static getStubConfig(hass) {
    const ids = Object.keys((hass && hass.states) || {})
      .filter((id) => id.startsWith('climate.'))
      .sort()
      .slice(0, 2);
    return {
      profile: 'auto',
      theme: 'auto',
      layout: 'tabs',
      show_unit: true,
      entities: (ids.length ? ids : ['climate.ac']).map((entity) => ({ entity })),
    };
  }

  setConfig(config) {
    const cfg = _card_normConfig(config); // throws helpful errors → HA shows an error card
    this._config = cfg;
    this._storageKey = _card_storageKey(cfg.entities);
    this._lang = this._resolveLang();
    this._build();
    if (this._hass) this._update(true);
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config || !this._root) return;
    this._update(false);
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    const cfg = this._config;
    const n = cfg ? cfg.entities.length : 1;
    const per = cfg && cfg.show_unit === false ? 8 : 11;
    if (!cfg || cfg.layout === 'tabs') return per + (n > 1 ? 2 : 0);
    if (cfg.layout === 'grid') return per * Math.ceil(n / 2) + 1;
    return per * n + 1;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: 'auto' };
  }

  connectedCallback() {
    if (!this._ro && typeof ResizeObserver !== 'undefined') this._ro = new ResizeObserver(this._onResize);
    this._observeAll();
    if (this._root) this._scheduleLayout(false);
  }

  disconnectedCallback() {
    if (this._ro) this._ro.disconnect();
    if (this._indRaf) cancelAnimationFrame(this._indRaf);
    this._indRaf = 0;
    clearTimeout(this._heightTimer);
    clearTimeout(this._suppressTimer);
    this._endDrag(false);
  }

  // ---------------------------------------------------------------- build (once) + reconcile (on setConfig)

  _resolveLang() {
    try {
      return resolveLang(this._hass, this._config ? this._config.language : 'auto') || 'en';
    } catch (e) {
      return 'en';
    }
  }

  _buildSkeleton() {
    const sr = this.shadowRoot;
    const style = _card_el('style');
    style.textContent = ACHA_CARD_CSS + _card_EXTRA_CSS;
    const card = _card_el('ha-card', 'acha-card');

    const header = _card_el('div', 'acha-header');
    const titleWrap = _card_el('div', 'acha-title-wrap');
    const title = _card_el('h2', 'acha-title');
    const summary = _card_el('span', 'acha-summary', { role: 'status', 'aria-live': 'polite' });
    const summaryDot = _card_el('span', 'acha-summary-dot');
    const summaryText = _card_el('span', 'acha-summary-text');
    summary.append(summaryDot, summaryText);
    titleWrap.append(title, summary);
    const allOff = _card_el('button', 'acha-alloff', { type: 'button', tabindex: '-1', 'aria-hidden': 'true' });
    const allOffIcon = _card_el('ha-icon', '', { icon: 'mdi:power' });
    const allOffLabel = _card_el('span', 'acha-alloff-label');
    allOff.append(allOffIcon, allOffLabel);
    allOff.addEventListener('click', this._onAllOff);
    header.append(titleWrap, allOff);

    const switcher = _card_el('div', 'acha-switcher', { role: 'tablist' });
    const indicator = _card_el('span', 'acha-pill-indicator', { 'aria-hidden': 'true' });
    switcher.appendChild(indicator);
    switcher.addEventListener('keydown', this._onSwitcherKey);

    const viewport = _card_el('div', 'acha-viewport');
    const track = _card_el('div', 'acha-track');
    viewport.appendChild(track);
    viewport.addEventListener('pointerdown', this._onPointerDown);
    viewport.addEventListener('pointermove', this._onPointerMove);
    viewport.addEventListener('pointerup', this._onPointerUp);
    viewport.addEventListener('pointercancel', this._onPointerUp);
    viewport.addEventListener('lostpointercapture', this._onPointerUp);
    viewport.addEventListener('click', this._onClickCapture, true);

    card.append(header, switcher, viewport);
    sr.append(style, card);
    this._root = { card, header, title, summary, summaryText, allOff, allOffLabel, switcher, indicator, viewport, track };
  }

  _build() {
    if (!this._root) this._buildSkeleton();
    const cfg = this._config;
    const r = this._root;
    const multi = cfg.entities.length > 1;

    this.setAttribute('data-layout', cfg.layout);
    r.card.className = 'acha-card layout-' + cfg.layout;
    r.track.style.alignItems = cfg.layout === 'tabs' ? 'flex-start' : '';
    if (cfg.layout !== 'tabs') {
      r.viewport.style.height = '';
      r.viewport.style.transition = '';
    }
    this._applyTheme(this._resolveTheme());

    // Reconcile panels by entity id: existing <acha-panel> elements are reused (no animation reset).
    const old = new Map(this._recs.map((rec) => [rec.entry.entity, rec]));
    const recs = cfg.entities.map((entry, i) => {
      const prev = old.get(entry.entity);
      old.delete(entry.entity);
      const el = prev ? prev.el : document.createElement('acha-panel');
      const pc = _card_panelConfig(cfg, entry, i);
      el.config = pc;
      return { entry, cfg: pc, el, pill: null, parts: null, ids: _card_relevantIds(entry), hass: null };
    });
    for (const rec of old.values()) {
      if (this._ro) this._ro.unobserve(rec.el);
      rec.el.remove();
    }
    recs.forEach((rec) => r.track.appendChild(rec.el)); // appendChild moves existing nodes into order
    this._recs = recs;

    // Pills are cheap: rebuild them.
    for (const stale of Array.from(r.switcher.querySelectorAll(".acha-pill"))) stale.remove();
    recs.forEach((rec, i) => {
      const pill = _card_el('button', 'acha-pill', { type: 'button', role: 'tab', 'aria-selected': 'false', tabindex: '-1' });
      const dot = _card_el('span', 'acha-pill-dot', { 'aria-hidden': 'true' });
      pill.appendChild(dot);
      let icon = null;
      if (rec.entry.icon) {
        icon = _card_el('ha-icon', '', { icon: rec.entry.icon });
        pill.appendChild(icon);
      }
      const name = _card_el('span', 'acha-pill-name');
      const temp = _card_el('span', 'acha-pill-temp');
      pill.append(name, temp);
      _card_setText(name, rec.entry.name || rec.entry.entity.split('.')[1]);
      pill.addEventListener('click', () => this._select(i, { animate: true }));
      r.switcher.appendChild(pill);
      rec.pill = pill;
      rec.parts = { dot, icon, name, temp };
    });

    r.switcher.hidden = !multi || cfg.layout !== 'tabs';
    r.header.hidden = !(multi || (cfg.title !== undefined && cfg.title !== ''));
    r.allOff.hidden = !multi;
    this._indPlaced = false;

    // Selected AC: remembered entity → current → first.
    let idx = -1;
    if (cfg.layout === 'tabs' && multi) {
      const saved = _card_readStore(this._storageKey);
      if (saved) idx = recs.findIndex((rec) => rec.entry.entity === saved);
    }
    if (idx < 0) idx = clamp(this._index, 0, recs.length - 1);
    this._index = idx;

    this._observeAll();
    this._renderStatic();
    this._applyIndex(false);
  }

  _observeAll() {
    if (!this._ro || !this._root) return;
    this._ro.disconnect();
    this._ro.observe(this._root.switcher);
    this._ro.observe(this._root.viewport);
    for (const rec of this._recs) this._ro.observe(rec.el);
  }

  /** Language-dependent static strings (title, all-off label, aria). */
  _renderStatic() {
    const r = this._root;
    const cfg = this._config;
    const lang = this._lang;
    const title = cfg.title !== undefined ? cfg.title : cfg.entities.length > 1 ? t(lang, 'ui.climate') : '';
    _card_setText(r.title, title);
    r.title.hidden = !title;
    _card_setText(r.allOffLabel, t(lang, 'ui.all_off'));
    r.allOff.setAttribute('aria-label', t(lang, 'ui.all_off'));
    r.switcher.setAttribute('aria-label', t(lang, 'ui.air_conditioners'));
  }

  _applyTheme(theme) {
    if (this._theme === theme) return;
    this._theme = theme;
    this.setAttribute('data-theme', theme);
  }

  _resolveTheme() {
    const pref = this._config ? this._config.theme : 'auto';
    if (pref === 'dark' || pref === 'light') return pref;
    const themes = this._hass && this._hass.themes;
    return themes && themes.darkMode === false ? 'light' : 'dark';
  }

  // ---------------------------------------------------------------- hass updates (patch only)

  _update(force) {
    const hass = this._hass;
    if (!hass || !this._root) return;
    const lang = this._resolveLang();
    const langChanged = lang !== this._lang;
    this._lang = lang;
    if (langChanged) this._renderStatic();
    this._applyTheme(this._resolveTheme());

    let onCount = 0;
    let pillsChanged = false;
    for (const rec of this._recs) {
      const changed = force || langChanged || _card_hassChanged(rec.hass, hass, rec.ids);
      // HA hands a new hass object on every state change anywhere; only panels whose own entities
      // (climate, sensors, extras) or locale/theme changed are patched.
      if (changed || !rec.hass) rec.el.hass = hass;
      rec.hass = hass;
      const st = stateObj(hass, rec.entry.entity);
      if (isOn(st)) onCount++;
      if (changed) {
        this._renderPill(rec, st);
        pillsChanged = true;
      }
    }
    this._renderSummary(onCount);
    this._updateAccent();
    if (pillsChanged) this._scheduleLayout(true);
  }

  _renderPill(rec, st) {
    const { pill, parts } = rec;
    if (!pill) return;
    const lang = this._lang;
    const hass = this._hass;
    const unavailable = !st || st.state === 'unavailable' || st.state === 'unknown';
    const on = !unavailable && isOn(st);
    const color = _card_modeColor(rec.cfg, st);
    rec.color = color;
    rec.on = on;
    pill.classList.toggle('on', on);
    pill.classList.toggle('unavailable', unavailable);
    if (pill.style.getPropertyValue('--acha-pill-color') !== color) pill.style.setProperty('--acha-pill-color', color);

    const friendly = st && st.attributes && st.attributes.friendly_name;
    const name = rec.entry.name || friendly || rec.entry.entity.split('.')[1];
    _card_setText(parts.name, name);

    const cur = unavailable ? null : _card_currentTemp(hass, rec.entry, st);
    const temp = cur === null ? '' : formatTemp(cur, 0.1).text + '°';
    _card_setText(parts.temp, temp);
    parts.temp.hidden = !temp;

    const status = on ? _card_modeLabel(rec.cfg, st, lang) : unavailable ? t(lang, 'ui.unavailable') : t(lang, 'mode.off');
    const label = [name, status, temp].filter(Boolean).join(' · ');
    if (pill.getAttribute('aria-label') !== label) {
      pill.setAttribute('aria-label', label);
      pill.title = label;
    }
  }

  _renderSummary(onCount) {
    const r = this._root;
    const lang = this._lang;
    const text = onCount > 0 ? t(lang, 'ui.n_on', { n: onCount }) : t(lang, 'ui.all_off_state');
    _card_setText(r.summaryText, text);
    r.summary.classList.toggle('on', onCount > 0);
    const show = onCount > 0 && this._recs.length > 1;
    r.allOff.classList.toggle('show', show);
    r.allOff.setAttribute('aria-hidden', show ? 'false' : 'true');
    r.allOff.tabIndex = show ? 0 : -1;
  }

  /** Card-level accent: selected AC (tabs) or first AC that is on (stack/grid). */
  _updateAccent() {
    const r = this._root;
    if (!r || !this._recs.length) return;
    let rec = this._recs[this._index];
    if (this._config.layout !== 'tabs') rec = this._recs.find((x) => x.on) || this._recs[0];
    const color = (rec && rec.on && rec.color) || _card_PALETTE.off;
    if (r.card.__achaAccent !== color) {
      r.card.__achaAccent = color;
      const rgb = hexToRgb(color, '107, 114, 128');
      r.card.style.setProperty('--acha-card-accent-rgb', rgb);
      r.card.style.setProperty('--acha-accent', color);
      r.card.style.setProperty('--acha-accent-rgb', rgb);
    }
    const active = this._recs[this._index];
    const ind = active && active.on && active.color ? `rgba(${hexToRgb(active.color)}, .55)` : 'transparent';
    r.switcher.style.setProperty('--acha-ind-color', ind);
  }

  // ---------------------------------------------------------------- selection, indicator, height

  _select(i, opts) {
    const o = opts || {};
    const n = this._recs.length;
    if (!n) return;
    const next = clamp(Math.round(i), 0, n - 1);
    const changed = next !== this._index;
    this._index = next;
    this._applyIndex(o.animate !== false);
    if (changed) {
      _card_haptic(6);
      const rec = this._recs[next];
      if (rec && this._config.layout === 'tabs') _card_writeStore(this._storageKey, rec.entry.entity);
      fireEvent(this, 'acha-select', { index: next, entity: rec ? rec.entry.entity : null }, { bubbles: false, composed: false });
    }
    if (o.focus && this._recs[next] && this._recs[next].pill) this._recs[next].pill.focus({ preventScroll: true });
  }

  _applyIndex(animate) {
    const r = this._root;
    if (!r) return;
    const tabs = this._config.layout === 'tabs';
    const idx = this._index;
    const instant = !animate || _card_reducedMotion();
    if (instant) r.track.classList.add('dragging');
    r.track.style.setProperty('--acha-index', tabs ? String(idx) : '0');
    r.track.style.setProperty('--acha-drag', '0px');
    if (instant) {
      void r.track.offsetWidth; // commit the jump before re-enabling the transition
      r.track.classList.remove('dragging');
    }
    this._recs.forEach((rec, i) => {
      const active = !tabs || i === idx;
      if (rec.el.active !== active) rec.el.active = active;
      rec.el.toggleAttribute('active', active);
      if (tabs) {
        rec.el.inert = !active;
        if (active) rec.el.removeAttribute('aria-hidden');
        else rec.el.setAttribute('aria-hidden', 'true');
      } else {
        rec.el.inert = false;
        rec.el.removeAttribute('aria-hidden');
      }
      if (rec.pill) {
        rec.pill.classList.toggle('active', i === idx);
        rec.pill.setAttribute('aria-selected', i === idx ? 'true' : 'false');
        rec.pill.tabIndex = i === idx ? 0 : -1;
      }
    });
    this._updateAccent();
    this._layoutIndicator(!instant);
    this._syncHeight(!instant);
  }

  _scheduleLayout(animate) {
    if (this._indRaf) return;
    this._indRaf = requestAnimationFrame(() => {
      this._indRaf = 0;
      this._layoutIndicator(animate);
      this._syncHeight(false);
    });
  }

  _onResize() {
    this._scheduleLayout(true);
  }

  /** Slide the pill indicator under the active pill and keep that pill scrolled into view. */
  _layoutIndicator(animate) {
    const r = this._root;
    const rec = this._recs[this._index];
    if (!r || !rec || !rec.pill || r.switcher.hidden) return;
    const pill = rec.pill;
    const w = pill.offsetWidth;
    if (!w) return; // not laid out yet (hidden / detached) — ResizeObserver will call again
    const x = pill.offsetLeft;
    const ind = r.indicator;
    const same = ind.style.getPropertyValue('--acha-ind-x') === x + 'px' && ind.style.getPropertyValue('--acha-ind-w') === w + 'px';
    if (!same) {
      const jump = !animate || !this._indPlaced;
      if (jump) ind.style.transition = 'none';
      ind.style.setProperty('--acha-ind-x', x + 'px');
      ind.style.setProperty('--acha-ind-w', w + 'px');
      if (jump) {
        void ind.offsetWidth;
        ind.style.transition = '';
      }
    }
    this._indPlaced = true;
    const sw = r.switcher;
    if (sw.scrollWidth > sw.clientWidth + 1) {
      const left = sw.scrollLeft;
      if (x < left + 8 || x + w > left + sw.clientWidth - 8) {
        const target = Math.max(0, x - (sw.clientWidth - w) / 2);
        try {
          sw.scrollTo({ left: target, behavior: animate && !_card_reducedMotion() ? 'smooth' : 'auto' });
        } catch (e) {
          sw.scrollLeft = target;
        }
      }
    }
  }

  /** Tabs layout: the viewport takes the height of the selected panel (animated on switch). */
  _syncHeight(animate) {
    const r = this._root;
    if (!r || this._config.layout !== 'tabs') return;
    const rec = this._recs[this._index];
    if (!rec) return;
    const h = rec.el.offsetHeight;
    if (!h) return;
    const px = h + 'px';
    if (r.viewport.style.height === px) return;
    if (animate && r.viewport.style.height) {
      r.viewport.style.transition = 'height 460ms cubic-bezier(.22, .8, .24, 1)';
      clearTimeout(this._heightTimer);
      this._heightTimer = setTimeout(() => {
        this._heightTimer = 0;
        r.viewport.style.transition = '';
      }, 500);
    }
    r.viewport.style.height = px;
  }

  // ---------------------------------------------------------------- swipe gesture (tabs layout)

  _onPointerDown(ev) {
    if (!this._config || this._config.layout !== 'tabs' || this._recs.length < 2) return;
    if (!ev.isPrimary || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    if (_card_swipeBlocked(ev)) return;
    this._drag = {
      id: ev.pointerId,
      type: ev.pointerType,
      x0: ev.clientX,
      y0: ev.clientY,
      dx: 0,
      decided: false,
      horizontal: false,
      captured: false,
      width: this._root.viewport.clientWidth || 1,
      samples: [{ x: ev.clientX, t: ev.timeStamp || performance.now() }],
    };
  }

  _onPointerMove(ev) {
    const d = this._drag;
    if (!d || ev.pointerId !== d.id) return;
    const dx = ev.clientX - d.x0;
    const dy = ev.clientY - d.y0;
    if (!d.decided) {
      if (Math.abs(dx) < _card_SWIPE_SLOP && Math.abs(dy) < _card_SWIPE_SLOP) return;
      d.decided = true;
      d.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (!d.horizontal) {
        this._drag = null; // vertical intent: let the page scroll
        return;
      }
      this._root.track.classList.add('dragging');
      try {
        this._root.viewport.setPointerCapture(d.id);
        d.captured = true;
      } catch (e) {
        /* capture unsupported — moves still arrive while inside */
      }
    }
    if (ev.cancelable) ev.preventDefault();
    const last = this._recs.length - 1;
    const atEdge = (this._index === 0 && dx > 0) || (this._index === last && dx < 0);
    const offset = atEdge ? dx * 0.28 : dx;
    d.dx = dx;
    d.samples.push({ x: ev.clientX, t: ev.timeStamp || performance.now() });
    if (d.samples.length > 6) d.samples.shift();
    this._root.track.style.setProperty('--acha-drag', offset.toFixed(1) + 'px');
  }

  _onPointerUp(ev) {
    const d = this._drag;
    if (!d || (ev && ev.pointerId !== d.id)) return;
    this._endDrag(!!ev && ev.type === 'pointerup');
  }

  /** Finish a drag: commit to prev/next when far or fast enough, else spring back. */
  _endDrag(commit) {
    const d = this._drag;
    this._drag = null;
    if (!d || !this._root) return;
    if (d.captured) {
      try {
        this._root.viewport.releasePointerCapture(d.id);
      } catch (e) {
        /* already released */
      }
    }
    if (!d.horizontal) return;
    this._root.track.classList.remove('dragging');
    let target = this._index;
    if (commit) {
      const s = d.samples;
      const first = s[0];
      const lastS = s[s.length - 1];
      const dt = Math.max(1, lastS.t - first.t);
      const v = (lastS.x - first.x) / dt; // px/ms over the last few samples
      const far = Math.abs(d.dx) > d.width * _card_SWIPE_RATIO;
      const fast = Math.abs(v) > _card_SWIPE_VELOCITY && Math.sign(v) === Math.sign(d.dx);
      if (far || fast) target = this._index + (d.dx < 0 ? 1 : -1);
    }
    // Swallow the click that follows a real swipe so tiles/pills underneath don't fire.
    this._suppressClick = true;
    clearTimeout(this._suppressTimer);
    this._suppressTimer = setTimeout(() => {
      this._suppressClick = false;
    }, 320);
    this._select(target, { animate: true });
  }

  _onClickCapture(ev) {
    if (!this._suppressClick) return;
    this._suppressClick = false;
    ev.stopPropagation();
    ev.preventDefault();
  }

  // ---------------------------------------------------------------- keyboard + actions

  _onSwitcherKey(ev) {
    const n = this._recs.length;
    if (n < 2) return;
    let next = null;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (this._index + 1) % n;
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (this._index - 1 + n) % n;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = n - 1;
    if (next === null) return;
    ev.preventDefault();
    this._select(next, { animate: true, focus: true });
  }

  _onAllOff(ev) {
    if (ev) ev.stopPropagation();
    const hass = this._hass;
    if (!hass || this._busyOff) return;
    const targets = this._recs
      .map((rec) => stateObj(hass, rec.entry.entity))
      .filter((st) => st && isOn(st));
    if (!targets.length) return;
    _card_haptic(12);
    this._busyOff = true;
    const btn = this._root.allOff;
    btn.setAttribute('aria-busy', 'true');
    const calls = targets.map((st) =>
      _card_turnOff(hass, st).catch((err) => {
        console.error('[acha-card] turn off failed for', st.entity_id, err);
      })
    );
    Promise.all(calls).then(() => {
      this._busyOff = false;
      btn.removeAttribute('aria-busy');
    });
  }
}

// ---------------------------------------------------------------- registration

if (!customElements.get('acha-card')) customElements.define('acha-card', AchaCard);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c && c.type === 'acha-card')) {
  window.customCards.push({
    type: 'acha-card',
    name: 'ACHA Climate Card',
    preview: true,
    description: 'Controlo de ar condicionado ao estilo Daikin Onecta: mostrador circular, unidade animada e vários ACs num só cartão.',
  });
}

if (_card_COMPONENTS.some((c) => typeof c !== 'function')) {
  console.warn('[acha-card] some sub-components failed to load; check the bundle order.');
}

if (!window.__achaCardBanner) {
  window.__achaCardBanner = true;
  console.info(
    `%c ACHA-CARD %c v${ACHA_CARD_VERSION} `,
    'color:#fff;background:#3fa9f5;font-weight:700;padding:2px 6px;border-radius:6px 0 0 6px',
    'color:#3fa9f5;background:#10121a;font-weight:500;padding:2px 6px;border-radius:0 6px 6px 0'
  );
}

})();
