// ACHA Card — i18n (pt-PT + en)
// Exports: ACHA_STRINGS, resolveLang(hass, pref), t(lang, key, vars?)
// Keys are dot paths ('mode.cool'). Lookup: lang → en → key itself.
// Interpolation: '{n}' replaced from vars. Plural helper: when vars.n === 1 and
// '<key>_one' exists, that variant is used (e.g. ui.n_on → ui.n_on_one).

export const ACHA_STRINGS = {
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
export function resolveLang(hass, pref) {
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
export function t(lang, key, vars) {
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
