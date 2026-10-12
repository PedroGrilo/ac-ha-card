// acha-dial — circular 270° setpoint dial (gap at the bottom), Onecta style.
// Props: value, min, max, step, mode, color, disabled, current, low, high, dual, label, sublabel, unit, name.
// Events (bubbling, composed): acha-input {value} | {low,high} while dragging; acha-change on release / key.
// Built once; prop setters schedule a patch-only render. Bundling: private names prefixed DIAL_ / _dial_.

import { fireEvent, clamp, roundToStep, formatTemp } from './utils.js';

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
.hit { fill: none; stroke: transparent; stroke-width: 36; stroke-linecap: round; pointer-events: stroke; touch-action: none; cursor: pointer; }
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

export class AchaDial extends HTMLElement {
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

  /**
   * Grid used to *display* values: the step when the setpoints sit on it, else the finest of 0.5 / 0.1 they
   * fit (HA core daikin reports step 1 but holds 22.5). Snapping to `step` stays in drag / keyboard only.
   */
  _dispStep() {
    const p = this._p;
    const vals = (p.dual ? [p.low, p.high] : [p.value]).filter((v) => v !== null);
    const on = (g) => vals.every((v) => Math.abs(roundToStep(v, g) - v) < 1e-6);
    for (const g of [p.step, 1, 0.5, 0.1]) if (g <= p.step && on(g)) return g;
    return Math.min(p.step, 0.1);
  }

  /** Display value on the display grid (no clamping to the step grid). */
  _disp(v, ds) {
    const [lo, hi] = this._range();
    return clamp(roundToStep(v, ds), lo, hi);
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
    const ds = this._dispStep();
    // Fractional grids keep a stable decimal slot ('22.0' / '22.5') so the big integer never shifts sideways.
    const fracGrid = Math.abs(ds % 1) > 1e-9;
    const fmt = (v) => {
      const ft = formatTemp(v === null ? null : this._disp(v, ds), ds);
      if (fracGrid && ft.value !== null) {
        const n = (String(ds).split('.')[1] || '0').length;
        ft.dec = '.' + ft.dec.slice(1).padEnd(n, '0');
        ft.text = ft.int + ft.dec;
      }
      return ft;
    };
    const setText = (node, txt) => {
      const v = txt === null || txt === undefined ? '' : String(txt);
      if (node.textContent !== v) node.textContent = v;
    };
    setText(el.label, p.label);
    if (dual) {
      setText(el.lo, fmt(s.low).text);
      setText(el.hi, fmt(s.high).text);
      setText(el.u, p.unit);
    } else {
      const ft = fmt(s.value);
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
      const now = val === null ? '' : String(this._disp(val, ds));
      const txt = val === null ? '--' : formatTemp(this._disp(val, ds), ds).text + ' ' + p.unit;
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
    // Touch on the ring (not a thumb) is only *armed*: it must move along the ring to drag, or be a clean tap.
    // A swipe that merely starts on the ring never jumps the setpoint.
    const armed = ev.pointerType === 'touch' && ev.currentTarget === this._el.hit;
    this._drag = { id: ev.pointerId, which, start: { value: p.value, low: p.low, high: p.high }, lastDeg: null, armed, x0: ev.clientX, y0: ev.clientY };
    try {
      this._el.svg.setPointerCapture(ev.pointerId);
    } catch (e) {
      /* capture unsupported */
    }
    if (armed) return;
    this._grab();
    this._dragTo(this._degFromEvent(ev));
  }

  _grab() {
    const d = this._drag;
    if (!d) return;
    d.armed = false;
    (d.which === 'high' ? this._el.t1 : this._el.t0).classList.add('grab');
  }

  /** Armed touch: 'drag' once it moved > 8px along the ring, 'abort' when it went mostly radial, else null. */
  _armedIntent(ev) {
    const d = this._drag;
    const rect = this._el.svg.getBoundingClientRect();
    const rx = d.x0 - (rect.left + rect.width / 2);
    const ry = d.y0 - (rect.top + rect.height / 2);
    const len = Math.hypot(rx, ry) || 1;
    const mx = ev.clientX - d.x0;
    const my = ev.clientY - d.y0;
    const radial = Math.abs((mx * rx + my * ry) / len);
    const tangential = Math.abs((mx * ry - my * rx) / len);
    if (tangential > 8 && tangential >= radial) return 'drag';
    if (radial > 12) return 'abort';
    return null;
  }

  _cancelDrag() {
    const d = this._drag;
    this._drag = null;
    if (!d) return;
    try {
      if (this._el.svg.hasPointerCapture && this._el.svg.hasPointerCapture(d.id)) this._el.svg.releasePointerCapture(d.id);
    } catch (e) {
      /* already released */
    }
    this._el.t0.classList.remove('grab');
    this._el.t1.classList.remove('grab');
  }

  _onMove(ev) {
    const d = this._drag;
    if (!d || ev.pointerId !== d.id) return;
    if (ev.cancelable) ev.preventDefault();
    if (d.armed) {
      const intent = this._armedIntent(ev);
      if (intent === 'abort') {
        this._cancelDrag();
        return;
      }
      if (intent !== 'drag') return;
      this._grab();
    }
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
    if (d.armed) {
      // never moved along the ring: a clean tap sets the value there; a cancelled gesture changes nothing
      if (!ev || ev.type !== 'pointerup') {
        this._cancelDrag();
        return;
      }
      this._grab();
      this._dragTo(this._degFromEvent(ev));
    }
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
    // n grid steps strictly in one direction from cur (an off-grid 22.5 with step 1: up → 23, down → 22)
    const move = (n) => {
      const k = n > 0 ? Math.floor(cur / p.step + 1e-9) + n : Math.ceil(cur / p.step - 1e-9) + n;
      return k * p.step;
    };
    let next = null;
    switch (ev.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        next = move(1);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        next = move(-1);
        break;
      case 'PageUp':
        next = move(4);
        break;
      case 'PageDown':
        next = move(-4);
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
