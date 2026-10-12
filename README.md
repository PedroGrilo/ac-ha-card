# ACHA Climate Card

Cartão Lovelace para controlar ar condicionado no Home Assistant, com o aspeto da app **Daikin Onecta**:
mostrador circular grande, cores por modo, seletores em folha deslizante (bottom sheet) e uma unidade interior
animada com o fluxo de ar. Funciona com qualquer entidade `climate`, e tem perfis dedicados para **Daikin (local)**
e **Daikin Onecta**.

- Vários ACs num só cartão: comutador em "pílulas" com deslize (swipe) entre unidades, ou disposição empilhada / em grelha.
- Mostrador de 270° com arrastar, teclado, valor animado e modo de intervalo (`heat_cool` com mínimo/máximo).
- Botões − / + com repetição ao manter premido; os pedidos são agrupados (700 ms) para poupar a quota da cloud Onecta.
- Mosaicos para Modo, Velocidade, Oscilação vertical/horizontal e Modo especial, mais atalhos Econo / Potente.
- Entidades extra (Streamer, horários, botões, sensores) como mosaicos. Toque longo abre "Mais informações".
- Temas escuro (vidro) e claro (estilo Onecta), `auto` segue o modo escuro do Home Assistant.
- Português (pt-PT) e inglês. Respeita `prefers-reduced-motion`. Sem dependências externas.

## Instalação

### HACS (repositório personalizado)
1. HACS → menu ⋮ → **Repositórios personalizados** → adicione o URL deste repositório, categoria **Dashboard**.
2. Instale **ACHA Climate Card** e recarregue o browser.

### Manual
1. Corra `npm run build` (ou use o ficheiro já gerado) e copie `dist/acha-card.js` para `/config/www/acha-card.js`.
2. Em **Definições → Painéis → ⋮ → Recursos**, adicione `/local/acha-card.js` com o tipo **Módulo JavaScript**.
3. Recarregue o browser (Ctrl+F5).

## Configuração

O editor visual cobre todas as opções. Em YAML:

```yaml
type: custom:acha-card
title: Climatização          # opcional
profile: auto                # auto | daikin | daikin_onecta | generic
theme: auto                  # auto | dark | light
layout: tabs                 # tabs | stack | grid
show_unit: true              # unidade interior animada
language: auto               # auto | pt | en
entities:
  - entity: climate.ac_sala
    name: Sala
    icon: mdi:sofa
    indoor_temperature: sensor.ac_sala_inside_temperature
    outdoor_temperature: sensor.ac_sala_outside_temperature
    humidity: sensor.ac_sala_humidity
    power: sensor.ac_sala_compressor_estimated_power_consumption
    extras:
      - entity: switch.ac_sala_streamer
        name: Streamer
        icon: mdi:shimmer
    hide: [swing_horizontal]
    min_temp: 18
    max_temp: 30
    step: 0.5
    labels:
      fan_mode: { Silence: Noite }
    colors: { cool: '#3fa9f5' }
  - climate.ac_quarto        # também aceita só o id
```

Também pode usar `entity: climate.ac_sala` em vez de `entities` quando há só um AC.

### Opções do cartão

| Opção | Valores | Por omissão | Descrição |
|---|---|---|---|
| `title` | texto | "Climatização" (com 2+ ACs) | Título do cabeçalho |
| `profile` | `auto`, `daikin`, `daikin_onecta`, `generic` | `auto` | Perfil de marca (etiquetas, ícones, ordem dos modos). `auto` deteta pelo registo de entidades e pelos atributos |
| `theme` | `auto`, `dark`, `light` | `auto` | `auto` segue `hass.themes.darkMode` |
| `layout` | `tabs`, `stack`, `grid` | `tabs` | `tabs`: um painel de cada vez com pílulas e deslize; `stack`: todos empilhados; `grid`: lado a lado |
| `show_unit` | `true` / `false` | `true` | Mostra a unidade interior animada |
| `language` | `auto`, `pt`, `en` | `auto` | `auto` usa o idioma do Home Assistant |

### Opções por AC (`entities[]`)

| Opção | Descrição |
|---|---|
| `entity` | Entidade `climate` (obrigatória) |
| `name`, `icon` | Nome e ícone (`mdi:...`) |
| `indoor_temperature` | Sensor de temperatura interior (senão usa `current_temperature`) |
| `outdoor_temperature` | Sensor de temperatura exterior |
| `humidity` | Sensor de humidade (senão usa `current_humidity`) |
| `power` | Sensor de potência (W/kW) ou energia (kWh), mostrado no rodapé |
| `extras` | Lista de entidades extra: `switch`, `input_boolean`, `fan`, `light` (alternar), `select`/`input_select` (lista), `button`/`input_button`/`script`/`scene` (premir), `sensor`/`binary_sensor` (só leitura) |
| `hide` | Ocultar controlos: `modes`, `fan`, `swing`, `swing_horizontal`, `preset`, `power_btn` |
| `min_temp`, `max_temp`, `step` | Limites e incremento do mostrador (senão vêm dos atributos e do perfil) |
| `labels` | Etiquetas próprias por valor bruto: `labels: { fan_mode: { Silence: Noite } }` |
| `icons` | Ícones próprios por valor bruto: `icons: { preset_mode: { eco: mdi:leaf } }` |
| `colors` | Cores por modo: `colors: { cool: '#3fa9f5', heat: '#ff8a3d' }` |
| `profile` | Perfil só para este AC |

Os valores são sempre enviados ao Home Assistant exatamente como aparecem nas listas da entidade
(`fan_modes`, `swing_modes`, …). A normalização serve só para etiquetas e ícones.

## Daikin

- **Daikin local** (integração `daikin`): velocidades `Auto`, `Silence`, `1`–`5`; oscilação `Off`, `Vertical`,
  `Horizontal`, `3D`; modos especiais `away`, `eco`, `boost`. O Streamer é `switch.<ac>_streamer`.
- **Daikin Onecta** (`daikin_onecta`, HACS): valores em minúsculas (`quiet`, `stop`, `swing`, `windnice`),
  oscilação horizontal separada, e as funcionalidades mudam com o modo (em Desumidificar não há temperatura nem
  velocidade, e o cartão adapta-se). O Streamer é `switch.<ac>_climatecontrol_streamer_mode`.
- A cloud Onecta tem limite diário de pedidos: o cartão agrupa as alterações de temperatura e mostra o valor
  pedido de imediato (otimista) enquanto espera pela confirmação.

Mais detalhes em [`docs/DAIKIN_NOTES.md`](docs/DAIKIN_NOTES.md).

## Desenvolvimento

Sem dependências: só Node ≥ 18.

```bash
npm run build     # junta src/*.js em dist/acha-card.js (IIFE) e valida com node --check
npm run check     # o mesmo, validando também cada ficheiro de src/
npm run demo      # servidor local em http://localhost:8765/demo/
```

A demo (`demo/index.html`) usa um `hass` simulado com dois ACs (Sala: Daikin local a arrefecer a 22 °C;
Quarto: Onecta desligado a 21 °C). Tem barra para mudar tema, disposição, idioma, largura, mostrar a unidade e pôr
o Quarto indisponível, um registo das chamadas de serviço e o editor visual. Os ícones MDI vêm de
`cdn.jsdelivr.net` (`@mdi/js`). Acrescente `?dist=1` ao URL para testar o ficheiro final em vez de `src/`.

Arquitetura e regras de empacotamento: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) e
[`docs/FILE_SPECS.md`](docs/FILE_SPECS.md).

## Licença

MIT
