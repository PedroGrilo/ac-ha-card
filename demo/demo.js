// ACHA demo bootstrap: ha-icon / ha-card polyfills, mock hass, toolbar, editor, service-call log.
// ?dist=1 loads the bundle (dist/acha-card.js) instead of the ES modules in src/.
import { createMockHass } from './mock-hass.js';

// ------------------------------------------------------------------ polyfills (HA provides these for real)
const MDI_URL = 'https://cdn.jsdelivr.net/npm/@mdi/js@7.4.47/+esm';
const ICON_FALLBACK = 'M12,4A8,8 0 1,0 20,12A8,8 0 0,0 12,4Z';
let mdiModule = null;
const missingIcons = new Set();

function loadMdi() {
  if (!mdiModule) {
    mdiModule = import(MDI_URL).catch((err) => {
      console.warn('[demo] could not load MDI icons from', MDI_URL, err);
      return {};
    });
  }
  return mdiModule;
}

/** 'mdi:fan-speed-1' → 'mdiFanSpeed1' */
function mdiKey(icon) {
  return 'mdi' + String(icon).replace(/^mdi:/, '').split('-').map((p) => (p ? p[0].toUpperCase() + p.slice(1) : '')).join('');
}

if (!customElements.get('ha-icon')) {
  customElements.define(
    'ha-icon',
    class extends HTMLElement {
      static get observedAttributes() {
        return ['icon'];
      }
      constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        root.innerHTML =
          '<style>:host{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);flex:none;line-height:0}svg{width:100%;height:100%;display:block;fill:currentColor}</style><svg viewBox="0 0 24 24" aria-hidden="true"><path></path></svg>';
        this._path = root.querySelector('path');
      }
      get icon() {
        return this.getAttribute('icon');
      }
      set icon(v) {
        if (v) this.setAttribute('icon', v);
        else this.removeAttribute('icon');
      }
      connectedCallback() {
        this._load();
      }
      attributeChangedCallback() {
        this._load();
      }
      async _load() {
        const icon = this.getAttribute('icon');
        if (!icon) {
          this._path.setAttribute('d', '');
          return;
        }
        const mdi = await loadMdi();
        if (this.getAttribute('icon') !== icon) return;
        const d = mdi[mdiKey(icon)];
        if (!d && Object.keys(mdi).length && !missingIcons.has(icon)) {
          missingIcons.add(icon);
          console.warn('[demo] unknown MDI icon:', icon);
        }
        this._path.setAttribute('d', d || ICON_FALLBACK);
      }
    }
  );
}

if (!customElements.get('ha-card')) {
  customElements.define(
    'ha-card',
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = '<style>:host{display:block}</style><slot></slot>';
      }
    }
  );
}

// ------------------------------------------------------------------ options (per-viewer, persisted best-effort)
const STORE_KEY = 'acha-demo:opts';
const DEFAULTS = { theme: 'auto', dark: '1', layout: 'tabs', lang: 'auto', width: '420', unit: '1', avail: '1' };
let opts = { ...DEFAULTS };
try {
  opts = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
} catch (e) {
  /* storage blocked */
}
opts.avail = '1';
const saveOpts = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(opts));
  } catch (e) {
    /* ignore */
  }
};

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const logEl = $('log');
const cfgEl = $('cfg');

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function log(text, isErr) {
  const li = document.createElement('li');
  if (isErr) li.className = 'err';
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('pt-PT');
  li.append(time, document.createTextNode(text));
  logEl.prepend(li);
  while (logEl.children.length > 60) logEl.lastChild.remove();
}

function baseEntities() {
  return [
    {
      entity: 'climate.ac_sala',
      name: 'Sala',
      icon: 'mdi:sofa',
      indoor_temperature: 'sensor.ac_sala_inside_temperature',
      outdoor_temperature: 'sensor.ac_sala_outside_temperature',
      power: 'sensor.ac_sala_compressor_estimated_power_consumption',
      min_temp: 16,
      max_temp: 30,
      step: 0.5,
      extras: [
        { entity: 'switch.ac_sala_streamer', name: 'Streamer', icon: 'mdi:shimmer' },
        { entity: 'sensor.ac_sala_energy_consumption_today', name: 'Energia hoje', icon: 'mdi:lightning-bolt' },
      ],
    },
    {
      entity: 'climate.ac_quarto',
      name: 'Quarto',
      icon: 'mdi:bed',
      indoor_temperature: 'sensor.ac_quarto_climatecontrol_room_temperature',
      outdoor_temperature: 'sensor.ac_quarto_climatecontrol_outdoor_temperature',
      humidity: 'sensor.ac_quarto_climatecontrol_room_humidity',
      power: 'sensor.ac_quarto_climatecontrol_cooling_daily_electrical_consumption',
      labels: { fan_mode: { quiet: 'Noite' } },
      extras: [
        { entity: 'switch.ac_quarto_climatecontrol_streamer_mode', name: 'Streamer', icon: 'mdi:shimmer' },
        { entity: 'select.ac_quarto_climatecontrol_schedule', name: 'Horário', icon: 'mdi:calendar-clock' },
        { entity: 'button.ac_quarto_refresh', name: 'Atualizar', icon: 'mdi:refresh' },
      ],
    },
  ];
}

let config = {
  type: 'custom:acha-card',
  profile: 'auto',
  theme: opts.theme,
  layout: opts.layout,
  language: opts.lang,
  show_unit: opts.unit === '1',
  entities: baseEntities(),
};

function applyPageTheme() {
  const light = opts.theme === 'light' || (opts.theme === 'auto' && opts.dark === '0');
  document.documentElement.setAttribute('data-page', light ? 'light' : 'dark');
  stage.style.setProperty('--stage-w', opts.width + 'px');
}

// ------------------------------------------------------------------ boot
const params = new URLSearchParams(location.search);
const useDist = params.get('dist') === '1';
$('src-label').textContent = useDist ? 'dist/acha-card.js' : 'src/ (ES modules)';
$('src-switch').textContent = useDist ? 'usar src/' : 'usar dist (?dist=1)';
$('src-switch').href = useDist ? '?' : '?dist=1';

let card = null;
let editor = null;

const mock = createMockHass({
  language: 'pt',
  darkMode: opts.dark === '1',
  onChange: (hass) => {
    if (card) card.hass = hass;
    if (editor) editor.hass = hass;
  },
  onCall: ({ domain, service, data }) => log(`${domain}.${service} ${JSON.stringify(data)}`),
  onError: ({ domain, service, error }) => log(`✖ ${domain}.${service}: ${error.message}`, true),
});
window.__achaMock = mock;

function showConfig() {
  cfgEl.textContent = JSON.stringify(config, null, 2);
}

function setCardConfig(next) {
  config = next;
  try {
    card.setConfig(config);
  } catch (err) {
    log('setConfig: ' + err.message, true);
    toast(err.message);
  }
  showConfig();
}

async function boot() {
  applyPageTheme();
  try {
    await import(useDist ? `../dist/acha-card.js?t=${Date.now()}` : '../src/acha-card.js');
  } catch (err) {
    stage.innerHTML = '<div class="box err-box"></div>';
    stage.firstChild.textContent = 'Falha ao carregar o cartão: ' + (err && err.message ? err.message : err) + (useDist ? '\nCorreu "npm run build"?' : '');
    throw err;
  }
  await customElements.whenDefined('acha-card');
  card = document.createElement('acha-card');
  setCardConfig(config);
  card.hass = mock.hass;
  stage.appendChild(card);
  window.__achaCard = card;

  window.addEventListener('hass-more-info', (ev) => {
    const id = ev.detail && ev.detail.entityId;
    log(`hass-more-info ${id}`);
    toast('Mais informações: ' + id);
  });

  // toolbar
  const bind = (id, key, apply) => {
    const el = $(id);
    el.value = opts[key];
    el.addEventListener('change', () => {
      opts[key] = el.value;
      saveOpts();
      apply(el.value);
      applyPageTheme();
    });
  };
  bind('opt-theme', 'theme', (v) => setCardConfig({ ...config, theme: v }));
  bind('opt-dark', 'dark', (v) => mock.setDarkMode(v === '1'));
  bind('opt-layout', 'layout', (v) => setCardConfig({ ...config, layout: v }));
  bind('opt-lang', 'lang', (v) => setCardConfig({ ...config, language: v }));
  bind('opt-width', 'width', () => {});
  bind('opt-unit', 'unit', (v) => setCardConfig({ ...config, show_unit: v === '1' }));
  bind('opt-avail', 'avail', (v) => mock.setAvailable('climate.ac_quarto', v === '1'));

  $('btn-reset').addEventListener('click', () => {
    mock.reset();
    $('opt-avail').value = '1';
    opts.avail = '1';
    log('estado reposto');
  });

  $('btn-editor').addEventListener('click', async () => {
    const box = $('editor-box');
    box.hidden = !box.hidden;
    if (box.hidden || editor) return;
    await customElements.whenDefined('acha-card-editor');
    editor = document.createElement('acha-card-editor');
    editor.hass = mock.hass;
    editor.setConfig(config);
    editor.addEventListener('config-changed', (ev) => {
      const next = { type: 'custom:acha-card', ...ev.detail.config };
      setCardConfig(next);
      editor.setConfig(next); // HA hands the config back to the editor
      log('config-changed');
    });
    $('editor-slot').appendChild(editor);
  });
}

boot();
