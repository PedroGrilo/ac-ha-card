// ACHA Card — shared helpers (no dependencies, no DOM assumptions beyond CustomEvent).
// Bundling rules: named exports only, private top-level helpers prefixed with `_utils_`.

/** Climate entity feature bits (homeassistant.components.climate.ClimateEntityFeature). */
export const SUPPORT = Object.freeze({
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
export function fireEvent(node, type, detail, options) {
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
export function debounce(fn, ms) {
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
export function clamp(v, min, max) {
  let lo = min === null || min === undefined || Number.isNaN(Number(min)) ? -Infinity : Number(min);
  let hi = max === null || max === undefined || Number.isNaN(Number(max)) ? Infinity : Number(max);
  if (lo > hi) [lo, hi] = [hi, lo];
  const n = Number(v);
  if (Number.isNaN(n)) return Number.isFinite(lo) ? lo : 0;
  return Math.min(Math.max(n, lo), hi);
}

/** Snap v to the nearest multiple of step, free of float noise (22.499999 → 22.5). step <= 0 → v. */
export function roundToStep(v, step) {
  const n = Number(v);
  const s = Math.abs(Number(step));
  if (!Number.isFinite(n)) return n;
  if (!Number.isFinite(s) || s === 0) return n;
  const r = Math.round(n / s) * s;
  const out = Number(r.toFixed(_utils_decimals(s)));
  return Object.is(out, -0) ? 0 : out;
}

/** 'fan_only' → 'Fan only', 'heat_cool' → 'Heat cool', 'Silence' → 'Silence'. null → ''. */
export function prettify(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Matching key: lowercase, strip spaces, underscores and hyphens ('Fan_Only' → 'fanonly'). */
export function normKey(v) {
  if (v === null || v === undefined) return '';
  return String(v).toLowerCase().replace(/[\s_-]+/g, '');
}

/** hass.states[id] or null (never throws). */
export function stateObj(hass, id) {
  if (!hass || !id || !hass.states) return null;
  return hass.states[id] || null;
}

/**
 * Call a climate service: callClimate(hass, 'set_hvac_mode', 'climate.x', { hvac_mode: 'cool' }).
 * `service` may also be 'domain.service' (e.g. 'homeassistant.toggle') to target another domain.
 * `entityId` may be a string or an array. Keys with `undefined` values are dropped.
 * Returns the hass.callService promise (rejects like HA does); resolves undefined if hass/entity missing.
 */
export function callClimate(hass, service, entityId, data) {
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
export function isOn(st) {
  const s = typeof st === 'string' ? st : st && st.state;
  if (s === null || s === undefined || s === '') return false;
  return !_utils_OFF_STATES.includes(String(s).toLowerCase());
}

/**
 * Finite number from st.attributes[name], else null. Numeric strings are parsed.
 * With `name` omitted/null, parses st.state instead (handy for sensors).
 */
export function numAttr(st, name) {
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
export function formatTemp(v, step) {
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
export function lerpColor(a, b, t) {
  const ca = _utils_parseColor(a);
  const cb = _utils_parseColor(b);
  if (!ca && !cb) return typeof a === 'string' ? a : typeof b === 'string' ? b : '#000000';
  if (!ca) return _utils_toHex(cb);
  if (!cb) return _utils_toHex(ca);
  const k = clamp(Number(t) || 0, 0, 1);
  return _utils_toHex(ca.map((c, i) => c + (cb[i] - c) * k));
}

/** '#3fa9f5' → '63, 169, 245' (for rgba(var(--x-rgb), .3)). Invalid → `fallback` (default '0, 0, 0'). */
export function hexToRgb(hex, fallback) {
  const rgb = _utils_parseColor(hex);
  if (!rgb) return fallback === undefined ? '0, 0, 0' : fallback;
  return rgb.join(', ');
}

/** True when the entity's supported_features includes every bit in `bit` (use SUPPORT.*). */
export function supports(st, bit) {
  const b = Number(bit) || 0;
  if (!b || !st || !st.attributes) return false;
  const f = Number(st.attributes.supported_features) || 0;
  return (f & b) === b;
}
