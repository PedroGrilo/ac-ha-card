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

export class AchaUnit extends HTMLElement {
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
