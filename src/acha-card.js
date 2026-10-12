// ACHA Card — entry point: config normalisation, multi-AC switcher, layouts, registration.
// Element: <acha-card> (Lovelace `type: custom:acha-card`).
// Bundling rules: named exports only, single-line relative imports, private top-level names prefixed `_card_`.

import { fireEvent, clamp, stateObj, callClimate, isOn, numAttr, formatTemp, hexToRgb, SUPPORT, supports } from './utils.js';
import { resolveLang, t } from './i18n.js';
import { resolveProfile, describeOption } from './profiles.js';
import { ACHA_CARD_CSS } from './styles.js';
import { AchaDial } from './dial.js';
import { AchaUnit } from './unit.js';
import { AchaSheet } from './sheet.js';
import { AchaPanel } from './panel.js';
import { AchaCardEditor } from './editor.js';

export const ACHA_CARD_VERSION = '1.0.0';

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

/** True when some service can switch this climate off (turn_off needs bit 128, else an 'off' hvac mode). */
function _card_canTurnOff(st) {
  const modes = (st && st.attributes && st.attributes.hvac_modes) || [];
  return supports(st, SUPPORT.TURN_OFF) || (Array.isArray(modes) && modes.includes('off'));
}

/** Turn one climate entity off using the best available service (null when none applies). */
function _card_turnOff(hass, st) {
  const id = st.entity_id;
  const modes = (st.attributes && st.attributes.hvac_modes) || [];
  if (supports(st, SUPPORT.TURN_OFF)) return callClimate(hass, 'turn_off', id);
  if (Array.isArray(modes) && modes.includes('off')) return callClimate(hass, 'set_hvac_mode', id, { hvac_mode: 'off' });
  return null;
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

export class AchaCard extends HTMLElement {
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
    r.track.style.transform = ''; // drop the inline drag transform: the CSS transition springs to the index
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
      trackW: this._root.track.offsetWidth || this._root.viewport.clientWidth || 1,
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
    // Write the transform itself (not an inherited custom property): no style recalc of every panel per move.
    this._root.track.style.transform = `translate3d(${(-this._index * d.trackW + offset).toFixed(1)}px, 0, 0)`;
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
      .filter((st) => st && isOn(st) && _card_canTurnOff(st));
    if (!targets.length) return;
    _card_haptic(12);
    this._busyOff = true;
    const btn = this._root.allOff;
    btn.setAttribute('aria-busy', 'true');
    const calls = targets.map((st) =>
      Promise.resolve(_card_turnOff(hass, st)).catch((err) => {
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
