// acha-panel — one air conditioner's full control UI (header, unit + dial hero, stepper, chips, toggles, tiles, footer).
// Props: hass, config (one normalised entry merged with card-level options), active (bool).
// Builds its shadow DOM once; every hass update only patches text, classes, attributes and child props.
// Bundling: private top-level names prefixed PANEL_ / _panel_.

import { fireEvent, debounce, clamp, roundToStep, normKey, stateObj, callClimate, isOn, numAttr, formatTemp, SUPPORT, supports } from './utils.js';
import { resolveLang, t } from './i18n.js';
import { resolveProfile, describeOption, fanIntensity } from './profiles.js';
import { ACHA_PANEL_CSS } from './styles.js';

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

export class AchaPanel extends HTMLElement {
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
    const status = _panel_el('div', 'acha-p-status');
    // Only the mode/action text is live; temperatures change on every sensor update and must not be announced.
    const statusMain = _panel_el('b', '', { 'aria-live': 'polite' });
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
    // Card limits only narrow the entity's own range (HA rejects values outside it: temp_out_of_range).
    const aMin = numAttr(st, 'min_temp');
    const aMax = numAttr(st, 'max_temp');
    const cMin = cfg.min_temp !== undefined && Number.isFinite(Number(cfg.min_temp)) ? Number(cfg.min_temp) : null;
    const cMax = cfg.max_temp !== undefined && Number.isFinite(Number(cfg.max_temp)) ? Number(cfg.max_temp) : null;
    let min = cMin !== null ? (aMin !== null ? Math.max(cMin, aMin) : cMin) : aMin;
    let max = cMax !== null ? (aMax !== null ? Math.min(cMax, aMax) : cMax) : aMax;
    if (min === null || !Number.isFinite(min)) min = unit === '°F' ? 61 : 16;
    if (max === null || !Number.isFinite(max)) max = unit === '°F' ? 86 : 30;
    if (min > max) {
      // Card range does not overlap the entity's: fall back to the entity range (never offer rejected values).
      if (aMin !== null && aMax !== null && aMin <= aMax) [min, max] = [aMin, aMax];
      else [min, max] = [max, min];
    }
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
    const canOff = supports(st, SUPPORT.TURN_OFF) || vm.modes.includes('off');
    _panel_prop(e.power, 'disabled', vm.unavailable || (vm.on && !canOff));
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
      // turn_off needs bit 128; otherwise only an 'off' hvac mode can switch it off.
      if (supports(st, SUPPORT.TURN_OFF)) this._call('turn_off');
      else if (modes.includes('off')) this._call('set_hvac_mode', { hvac_mode: 'off' });
      else return;
      this._powerPending = { on: false, until: Date.now() + PANEL_OPT_MS };
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

  /**
   * ± buttons: one step on press, auto-repeat while held; keyboard click = one step.
   * Touch defers the first step to pointerup (or the hold timer), so a scroll / tab swipe that starts on a
   * button (pointercancel) never changes the setpoint. Mouse and pen step immediately.
   */
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
      const deferred = ev.pointerType === 'touch';
      const r = { btn, timer: 0, interval: 0, deferred, stepped: false };
      if (!deferred) {
        this._stepBy(dir);
        r.stepped = true;
      }
      r.timer = setTimeout(() => {
        if (this._repeat !== r) return;
        if (!r.stepped) {
          r.stepped = true;
          if (!this._stepBy(dir)) {
            this._stopRepeat();
            return;
          }
        }
        r.interval = setInterval(() => {
          if (!this._stepBy(dir)) this._stopRepeat();
        }, PANEL_REPEAT_EVERY);
      }, PANEL_REPEAT_DELAY);
      this._repeat = r;
    });
    btn.addEventListener('pointerup', () => {
      const r = this._repeat;
      if (r && r.btn === btn && r.deferred && !r.stepped) {
        r.stepped = true;
        this._stopRepeat();
        this._stepBy(dir); // a clean touch tap = one step
        return;
      }
      this._stopRepeat();
    });
    for (const type of ['pointercancel', 'lostpointercapture']) btn.addEventListener(type, this._stopRepeat);
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
    // Next grid value strictly in the pressed direction (an off-grid 22.5 with step 1 → 23 / 22).
    const snap = (v) => {
      const k = dir > 0 ? Math.floor(v / step + 1e-9) + 1 : Math.ceil(v / step - 1e-9) - 1;
      return clamp(roundToStep(k * step, step), vm.min, vm.max);
    };
    let detail;
    if (vm.dual) {
      const low = snap(vm.low);
      const high = snap(vm.high);
      if (high - low < step / 2 || (low === vm.low && high === vm.high)) return false;
      detail = { low, high };
    } else {
      if (vm.target === null) return false;
      const value = snap(vm.target);
      if (dir > 0 ? value <= vm.target : value >= vm.target) return false;
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
