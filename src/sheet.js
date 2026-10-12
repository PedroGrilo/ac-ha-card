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

export class AchaSheet extends HTMLElement {
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
    // Tall panels (phone): the sheet sits at the panel bottom, which may be below the fold.
    clearTimeout(this._revealTimer);
    this._revealTimer = setTimeout(() => {
      if (!this.isOpen) return;
      const r = this._sheetEl.getBoundingClientRect();
      if (r.bottom > window.innerHeight || r.top < 0) {
        this._sheetEl.scrollIntoView({ block: 'nearest', behavior: _sheet_reduced() ? 'auto' : 'smooth' });
      }
    }, 60);
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
