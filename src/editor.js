// acha-card-editor — visual editor for custom:acha-card (Lovelace UI editor).
// Uses HA's <ha-form> (lazy-loaded via loadCardHelpers) with a native-input fallback when it is not available.
// API: setConfig(config), hass; emits `config-changed` {config}. Bundling: private names prefixed EDITOR_ / _editor_.

import { fireEvent } from './utils.js';
import { resolveLang, t } from './i18n.js';

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

export class AchaCardEditor extends HTMLElement {
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
    if (lang !== this._lang || this._unitNow() !== this._unit) this._render();
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

  /** '°F' on Fahrenheit installs, else '°C' (drives the min/max number bounds). */
  _unitNow() {
    const u = this._hass && this._hass.config && this._hass.config.unit_system && this._hass.config.unit_system.temperature;
    return u === '°F' ? '°F' : '°C';
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
    const fahrenheit = this._unitNow() === '°F';
    const tMin = fahrenheit ? 40 : 5;
    const tMax = fahrenheit ? 104 : 40;
    return [
      { name: 'entity', required: true, selector: { entity: { filter: { domain: 'climate' } } } },
      { type: 'grid', name: '', schema: [{ name: 'name', selector: { text: {} } }, { name: 'icon', selector: { icon: {} } }] },
      {
        type: 'grid',
        name: '',
        schema: [sensor('indoor_temperature', 'temperature'), sensor('outdoor_temperature', 'temperature'), sensor('humidity', 'humidity'), sensor('power')],
      },
      { type: 'grid', name: '', schema: [num('min_temp', tMin, tMax, 0.5), num('max_temp', tMin, tMax, 0.5), num('step', 0.1, 5, 0.1)] },
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
    this._unit = this._unitNow();
    const n = this._config.entities.length;
    const structure = [this._loading, this._haForm, this._lang, this._unit, n].join('|');
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
