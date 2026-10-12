// ACHA demo — fake `hass` with two Daikin-like ACs.
//   Sala   : HA core `daikin` (local BRP069): Title-case fan/swing values, hvac_action reported.
//   Quarto : `daikin_onecta` (cloud): lowercase values, stop/swing, horizontal swing, dynamic supported_features.
// callService mutates state after 250 ms and hands a NEW hass object to `onChange` (like HA does).
// Invalid option values are rejected case-sensitively, like HA's _valid_mode_or_raise.

const DELAY = 250;

function iso() {
  return new Date().toISOString();
}

function mkState(entity_id, state, attributes) {
  const now = iso();
  return { entity_id, state: String(state), attributes: { ...attributes }, last_changed: now, last_updated: now, context: { id: Math.random().toString(36).slice(2), parent_id: null, user_id: null } };
}

const SALA = 'climate.ac_sala';
const QUARTO = 'climate.ac_quarto';

/** Onecta changes its feature bits with the mode (dry: no setpoint, no fan). */
function onectaFeatures(mode) {
  if (mode === 'dry') return 384 + 16 + 32 + 512; // 944
  if (mode === 'fan_only') return 384 + 8 + 16 + 32 + 512; // no setpoint
  return 953;
}

function initialStates() {
  const s = {};
  const add = (id, state, attrs) => {
    s[id] = mkState(id, state, attrs);
  };
  add(SALA, 'cool', {
    hvac_modes: ['fan_only', 'dry', 'cool', 'heat', 'heat_cool', 'off'],
    min_temp: 7,
    max_temp: 35,
    target_temp_step: 1,
    current_temperature: 23,
    temperature: 22,
    fan_mode: 'Auto',
    fan_modes: ['Auto', 'Silence', '1', '2', '3', '4', '5'],
    preset_mode: 'none',
    preset_modes: ['none', 'away', 'eco', 'boost'],
    swing_mode: 'Vertical',
    swing_modes: ['Off', 'Vertical', 'Horizontal', '3D'],
    hvac_action: 'cooling',
    friendly_name: 'AC Sala',
    supported_features: 441,
  });
  add('sensor.ac_sala_inside_temperature', 23, { unit_of_measurement: '°C', device_class: 'temperature', state_class: 'measurement', friendly_name: 'AC Sala Inside temperature' });
  add('sensor.ac_sala_outside_temperature', 31, { unit_of_measurement: '°C', device_class: 'temperature', state_class: 'measurement', friendly_name: 'AC Sala Outside temperature' });
  add('sensor.ac_sala_compressor_estimated_power_consumption', 0.62, { unit_of_measurement: 'kW', device_class: 'power', state_class: 'measurement', friendly_name: 'AC Sala Compressor estimated power consumption' });
  add('sensor.ac_sala_energy_consumption_today', 3.4, { unit_of_measurement: 'kWh', device_class: 'energy', state_class: 'total_increasing', friendly_name: 'AC Sala Energy consumption today' });
  add('switch.ac_sala_streamer', 'off', { friendly_name: 'AC Sala Streamer', icon: 'mdi:shimmer' });
  add('switch.ac_sala_power', 'on', { friendly_name: 'AC Sala Power' });

  add(QUARTO, 'off', {
    hvac_modes: ['off', 'fan_only', 'heat', 'cool', 'heat_cool', 'dry'],
    min_temp: 16,
    max_temp: 32,
    target_temp_step: 0.5,
    current_temperature: 21,
    temperature: 21,
    fan_mode: 'quiet',
    fan_modes: ['auto', 'quiet', '1', '2', '3', '4', '5'],
    preset_mode: 'none',
    preset_modes: ['away', 'boost', 'eco', 'none'],
    swing_mode: 'stop',
    swing_modes: ['stop', 'swing', 'windnice'],
    swing_horizontal_mode: 'stop',
    swing_horizontal_modes: ['stop', 'swing'],
    friendly_name: 'AC Quarto Room temperature',
    supported_features: 953,
  });
  add('sensor.ac_quarto_climatecontrol_room_temperature', 21, { unit_of_measurement: '°C', device_class: 'temperature', friendly_name: 'AC Quarto Room temperature' });
  add('sensor.ac_quarto_climatecontrol_outdoor_temperature', 30.5, { unit_of_measurement: '°C', device_class: 'temperature', friendly_name: 'AC Quarto Outdoor temperature' });
  add('sensor.ac_quarto_climatecontrol_room_humidity', 52, { unit_of_measurement: '%', device_class: 'humidity', friendly_name: 'AC Quarto Room humidity' });
  add('sensor.ac_quarto_climatecontrol_cooling_daily_electrical_consumption', 1.2, { unit_of_measurement: 'kWh', device_class: 'energy', friendly_name: 'AC Quarto Cooling daily electrical consumption' });
  add('switch.ac_quarto_climatecontrol_streamer_mode', 'off', { friendly_name: 'AC Quarto Streamer mode' });
  add('select.ac_quarto_climatecontrol_schedule', 'off', { options: ['0', '1', '2', 'off'], friendly_name: 'AC Quarto Schedule' });
  add('button.ac_quarto_refresh', 'unknown', { friendly_name: 'AC Quarto Refresh' });
  return s;
}

function registry() {
  const entities = {};
  const devices = {
    dev_sala: { id: 'dev_sala', manufacturer: 'Daikin', model: 'FTXM35R (BRP069C4x)', name: 'AC Sala', name_by_user: null },
    dev_quarto: { id: 'dev_quarto', manufacturer: 'Daikin', model_id: 'FTXJ25AW', model: 'Emura', name: 'AC Quarto', name_by_user: null },
  };
  const reg = (id, platform, device_id) => {
    entities[id] = { entity_id: id, platform, device_id, area_id: null, name: null, icon: null, hidden: false, labels: [], entity_category: null, has_entity_name: true };
  };
  for (const id of [SALA, 'sensor.ac_sala_inside_temperature', 'sensor.ac_sala_outside_temperature', 'sensor.ac_sala_compressor_estimated_power_consumption', 'sensor.ac_sala_energy_consumption_today', 'switch.ac_sala_streamer', 'switch.ac_sala_power']) reg(id, 'daikin', 'dev_sala');
  for (const id of [QUARTO, 'sensor.ac_quarto_climatecontrol_room_temperature', 'sensor.ac_quarto_climatecontrol_outdoor_temperature', 'sensor.ac_quarto_climatecontrol_room_humidity', 'sensor.ac_quarto_climatecontrol_cooling_daily_electrical_consumption', 'switch.ac_quarto_climatecontrol_streamer_mode', 'select.ac_quarto_climatecontrol_schedule', 'button.ac_quarto_refresh']) reg(id, 'daikin_onecta', 'dev_quarto');
  return { entities, devices };
}

class ServiceValidationError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'ServiceValidationError';
    this.code = 'service_validation_error';
  }
}

const TOGGLE_DOMAINS = ['switch', 'input_boolean', 'fan', 'light', 'automation'];

/**
 * createMockHass({ onChange(hass), onCall({domain, service, data}), onError({..., error}), language, darkMode }) →
 *   { hass, setLanguage(l), setDarkMode(b), setAvailable(entityId, bool), reset() }
 */
export function createMockHass(opts = {}) {
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};
  const onCall = typeof opts.onCall === 'function' ? opts.onCall : () => {};
  const onError = typeof opts.onError === 'function' ? opts.onError : () => {};
  let language = opts.language || 'pt';
  let darkMode = opts.darkMode !== false;
  let states = initialStates();
  const reg = registry();
  const models = {};
  const lastMode = {};
  const unavailable = new Set();
  let hass = null;

  function initModels() {
    for (const id of [SALA, QUARTO]) {
      models[id] = { mode: states[id].state, attrs: { ...states[id].attributes } };
      lastMode[id] = id === SALA ? 'cool' : 'cool';
    }
  }

  /** Public state of a climate entity derived from its full model (feature-gated attributes). */
  function derive(id) {
    const m = models[id];
    if (unavailable.has(id)) {
      // HA keeps the capability attributes (not the state ones) on an unavailable climate.
      const feat = id === SALA ? Number(m.attrs.supported_features) || 0 : onectaFeatures(m.mode);
      const a = { friendly_name: m.attrs.friendly_name, supported_features: feat };
      for (const k of ['hvac_modes', 'min_temp', 'max_temp', 'target_temp_step']) if (m.attrs[k] !== undefined) a[k] = m.attrs[k];
      const gated = { fan_modes: 8, preset_modes: 16, swing_modes: 32, swing_horizontal_modes: 512 };
      for (const k of Object.keys(gated)) if (feat & gated[k] && m.attrs[k] !== undefined) a[k] = m.attrs[k];
      return { state: 'unavailable', attributes: a };
    }
    const a = { ...m.attrs };
    if (id === SALA) {
      delete a.hvac_action;
      const cur = Number(a.current_temperature);
      const tgt = Number(a.temperature);
      if (m.mode === 'off') a.hvac_action = 'off';
      else if (m.mode === 'cool') a.hvac_action = cur > tgt + 0.05 ? 'cooling' : 'idle';
      else if (m.mode === 'heat') a.hvac_action = cur < tgt - 0.05 ? 'heating' : 'idle';
    } else {
      a.supported_features = onectaFeatures(m.mode);
      if (!(a.supported_features & 1)) {
        delete a.temperature;
        delete a.target_temp_step;
      }
      if (!(a.supported_features & 8)) {
        delete a.fan_mode;
        delete a.fan_modes;
      }
    }
    return { state: m.mode, attributes: a };
  }

  // Like real HA, only `states` (and locale/themes when they change) get new identities; the rest stays the same
  // object across updates, so the card's per-panel change filter is exercised for real.
  const USER = { id: 'demo', name: 'Demo', is_admin: true, is_owner: true };
  const CONFIG = { unit_system: { temperature: '°C', length: 'km', mass: 'kg', volume: 'L' }, version: '2026.10.0', components: ['climate', 'daikin', 'daikin_onecta'], location_name: 'Casa', time_zone: 'Europe/Lisbon' };
  const CONNECTION = {
    subscribeEvents: async () => () => {},
    subscribeMessage: async () => () => {},
    sendMessagePromise: async () => ({}),
  };
  const callWS = async (msg) => {
    console.info('[mock-hass] callWS', msg);
    return [];
  };
  const callApi = async () => ({});
  const localize = (key) => key;
  const formatEntityState = (st) => (st ? st.state : '');
  const formatEntityAttributeValue = (st, attr) => (st && st.attributes ? String(st.attributes[attr]) : '');
  const hassUrl = (p = '') => p;
  const mkLocale = () => ({ language, number_format: 'language', time_format: '24', date_format: 'language', first_weekday: 'monday' });
  const mkThemes = () => ({ darkMode, theme: 'default', default_theme: 'default', themes: {} });
  let locale = mkLocale();
  let themes = mkThemes();

  function build() {
    hass = {
      states,
      entities: reg.entities,
      devices: reg.devices,
      areas: {},
      user: USER,
      language,
      selectedLanguage: language,
      locale,
      themes,
      selectedTheme: null,
      config: CONFIG,
      panelUrl: 'lovelace',
      callService,
      callWS,
      callApi,
      connection: CONNECTION,
      localize,
      formatEntityState,
      formatEntityAttributeValue,
      hassUrl,
    };
    return hass;
  }

  function commit(changes) {
    const next = { ...states };
    for (const id of Object.keys(changes)) {
      const prev = states[id];
      const c = changes[id];
      const st = mkState(id, c.state, c.attributes);
      if (prev && prev.state === st.state) st.last_changed = prev.last_changed;
      next[id] = st;
    }
    states = next;
    hass = { ...hass, states }; // HA swaps only `states` on a state change
    onChange(hass);
  }

  function climateChange(id, changes) {
    changes[id] = derive(id);
    const m = models[id];
    // keep the mirrored sensors / power switch consistent
    if (id === SALA) {
      changes['switch.ac_sala_power'] = { state: m.mode === 'off' ? 'off' : 'on', attributes: states['switch.ac_sala_power'].attributes };
    }
  }

  function inList(list, v, what) {
    if (!Array.isArray(list) || !list.includes(v)) throw new ServiceValidationError(`${what} "${v}" is not valid. Valid: ${(list || []).join(', ')}`);
  }

  function applyClimate(service, id, data, changes) {
    const m = models[id];
    if (!m) throw new Error(`Entity ${id} not found`);
    if (unavailable.has(id)) throw new Error(`Entity ${id} is unavailable`);
    const pub = derive(id).attributes;
    const feat = Number(pub.supported_features) || 0;
    const setMode = (mode) => {
      inList(m.attrs.hvac_modes, mode, 'HVAC mode');
      m.mode = mode;
      if (mode !== 'off') lastMode[id] = mode;
    };
    switch (service) {
      case 'set_hvac_mode':
        setMode(data.hvac_mode);
        break;
      case 'turn_on':
        if (!(feat & 256)) throw new ServiceValidationError('turn_on not supported');
        if (m.mode === 'off') m.mode = lastMode[id] || 'cool';
        break;
      case 'turn_off':
        if (!(feat & 128)) throw new ServiceValidationError('turn_off not supported');
        m.mode = 'off';
        break;
      case 'toggle':
        m.mode = m.mode === 'off' ? lastMode[id] || 'cool' : 'off';
        break;
      case 'set_temperature': {
        if (data.hvac_mode) setMode(data.hvac_mode);
        const after = derive(id).attributes;
        const f = Number(after.supported_features) || 0;
        if (data.temperature !== undefined) {
          if (!(f & 1)) throw new ServiceValidationError('Setting the target temperature is not supported in this mode');
          const v = Number(data.temperature);
          if (!(v >= m.attrs.min_temp && v <= m.attrs.max_temp)) throw new ServiceValidationError(`temp_out_of_range: ${v} (${m.attrs.min_temp}–${m.attrs.max_temp})`);
          m.attrs.temperature = id === SALA ? Math.round(v * 2) / 2 : v;
        }
        if (data.target_temp_low !== undefined || data.target_temp_high !== undefined) {
          if (!(f & 2)) throw new ServiceValidationError('target_temp_low/high not supported');
          m.attrs.target_temp_low = Number(data.target_temp_low);
          m.attrs.target_temp_high = Number(data.target_temp_high);
        }
        break;
      }
      case 'set_fan_mode':
        inList(pub.fan_modes, data.fan_mode, 'Fan mode');
        m.attrs.fan_mode = data.fan_mode;
        break;
      case 'set_swing_mode':
        inList(pub.swing_modes, data.swing_mode, 'Swing mode');
        m.attrs.swing_mode = data.swing_mode;
        break;
      case 'set_swing_horizontal_mode':
        inList(pub.swing_horizontal_modes, data.swing_horizontal_mode, 'Horizontal swing mode');
        m.attrs.swing_horizontal_mode = data.swing_horizontal_mode;
        break;
      case 'set_preset_mode':
        inList(pub.preset_modes, data.preset_mode, 'Preset mode');
        m.attrs.preset_mode = data.preset_mode;
        if (id === QUARTO && data.preset_mode === 'boost' && m.mode === 'off') m.mode = lastMode[id] || 'cool';
        break;
      default:
        throw new Error(`Service climate.${service} not found`);
    }
    climateChange(id, changes);
  }

  function applyOther(domain, service, id, data, changes) {
    const st = states[id];
    if (!st) throw new Error(`Entity ${id} not found`);
    const d = id.split('.')[0];
    if (d === 'climate') {
      const map = { toggle: 'toggle', turn_on: 'turn_on', turn_off: 'turn_off' };
      if (!map[service]) throw new Error(`Service ${domain}.${service} not found`);
      return applyClimate(map[service], id, data, changes);
    }
    if (service === 'toggle' || service === 'turn_on' || service === 'turn_off') {
      if (!TOGGLE_DOMAINS.includes(d)) throw new Error(`${domain}.${service} cannot target ${id}`);
      const on = service === 'toggle' ? st.state !== 'on' : service === 'turn_on';
      changes[id] = { state: on ? 'on' : 'off', attributes: st.attributes };
      return;
    }
    if (service === 'select_option') {
      inList(st.attributes.options, data.option, 'Option');
      changes[id] = { state: data.option, attributes: st.attributes };
      return;
    }
    if (service === 'press') {
      changes[id] = { state: iso(), attributes: st.attributes };
      return;
    }
    throw new Error(`Service ${domain}.${service} not found`);
  }

  function callService(domain, service, data = {}, target) {
    const payload = { ...(data || {}), ...(target || {}) };
    onCall({ domain, service, data: payload });
    const ids = [].concat(payload.entity_id || []);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const changes = {};
          for (const id of ids) {
            if (domain === 'climate') applyClimate(service, id, payload, changes);
            else applyOther(domain, service, id, payload, changes);
          }
          if (Object.keys(changes).length) commit(changes);
          resolve({ context: { id: Math.random().toString(36).slice(2) } });
        } catch (err) {
          console.warn('[mock-hass]', `${domain}.${service}`, err.message);
          onError({ domain, service, data: payload, error: err });
          reject(err);
        }
      }, DELAY);
    });
  }

  // slow physics: room temperature drifts towards the setpoint while running
  function tick() {
    const changes = {};
    for (const id of [SALA, QUARTO]) {
      const m = models[id];
      if (unavailable.has(id)) continue;
      const cur = Number(m.attrs.current_temperature);
      const tgt = Number(m.attrs.temperature);
      let next = cur;
      if (m.mode === 'cool' && cur > tgt) next = cur - 0.1;
      else if (m.mode === 'heat' && cur < tgt) next = cur + 0.1;
      else if (m.mode === 'off') next = cur + (id === SALA ? 0.05 : 0.03) * Math.sign(27 - cur);
      next = Math.round(next * 10) / 10;
      if (next !== cur) {
        m.attrs.current_temperature = next;
        climateChange(id, changes);
        const sensor = id === SALA ? 'sensor.ac_sala_inside_temperature' : 'sensor.ac_quarto_climatecontrol_room_temperature';
        changes[sensor] = { state: next, attributes: states[sensor].attributes };
      }
    }
    const pw = 'sensor.ac_sala_compressor_estimated_power_consumption';
    const salaOn = models[SALA].mode !== 'off' && !unavailable.has(SALA);
    const kw = salaOn ? Math.round((0.35 + Math.random() * 0.5) * 100) / 100 : 0;
    if (String(kw) !== states[pw].state) changes[pw] = { state: kw, attributes: states[pw].attributes };
    if (Object.keys(changes).length) commit(changes);
  }

  initModels();
  build();
  const timer = setInterval(tick, 5000);

  return {
    get hass() {
      return hass;
    },
    setLanguage(l) {
      language = l || 'pt';
      locale = mkLocale();
      build();
      onChange(hass);
    },
    setDarkMode(b) {
      darkMode = !!b;
      themes = mkThemes();
      hass = { ...hass, themes };
      onChange(hass);
    },
    setAvailable(id, available) {
      if (!models[id]) return;
      if (available) unavailable.delete(id);
      else unavailable.add(id);
      const changes = {};
      climateChange(id, changes);
      commit(changes);
    },
    reset() {
      states = initialStates();
      unavailable.clear();
      initModels();
      build();
      onChange(hass);
    },
    stop() {
      clearInterval(timer);
    },
  };
}
