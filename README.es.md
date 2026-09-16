# 🧭 San Andreas Pathfinder 3D

> 🇺🇸 [Read in English](./README.md)

Navegador GPS interactivo y planificador de rutas para **Grand Theft Auto: San Andreas**, construido con **React 19**, **TypeScript**, el algoritmo **A\***, física de elevación 3D y **Leaflet.js**.

![Vista previa del GPS de GTA San Andreas](src/assets/mapa-gta-sa-hd.webp)

---

## 🚀 Características

### 🗺️ Red Vial Oficial de Rockstar Games
- **28,991 nodos vehiculares** y **59,620 segmentos viales dirigidos** extraídos del archivo oficial `NODES.DAT` del juego.
- Garantía de componente gigante (Union-Find): **27,083 nodos conectados**, 0 nodos huérfanos.

### ⚡ Motor A\* Ultra-Rápido
- Motor de dominio puro en TypeScript con `MinHeap` y un índice Spatial Hash Grid de O(1).
- Cálculo de ruta entre estados (ej. San Fierro → Los Santos) en **~23 ms de mediana**.
- Rutas alternativas ordenadas **por tiempo de viaje real** — la opción más rápida siempre aparece primero.

### 🛣️ Rutas Alternativas Inteligentes
- Hasta 2 rutas secundarias descubiertas mediante penalización dinámica de aristas y filtro de >70% de solapamiento.
- Cada candidata se ordena por `totalTimeSeconds`, así las rutas más cortas nunca quedan enterradas debajo de las más largas.

### 📍 Waypoints Multi-Parada Ilimitados
- Añade tantas paradas como quieras: A → B → C → D …
- Reubicación de marcadores con arrastrar y soltar, con recálculo de ruta en tiempo real.

### ⛰️ Física de Elevación y Terreno 3D
- Distancias euclidianas reales en 3D (ΔX, ΔY, ΔZ) con curvas de pendiente continua.
- **5 perfiles de vehículo:** Automóvil estándar, Deportivo, **Motocicleta (Recomendado)**, Camión, Todoterreno 4×4.
- Altímetro en vivo: ganancia/pérdida total de elevación y rango de altitud sobre el nivel del mar.

### 🏍️ Atajos Personalizados Curados (6 rutas)
- Trayectorias grabadas por jugadores (rutas off-road y circuitos de acrobacias) integradas al grafo vial.
- **Soporte de aristas unidireccionales:** caídas de acantilado y saltos acrobáticos marcados como `oneWay: true` — el GPS nunca propondrá un salto imposible en sentido inverso.
- Arquitectura de red en 3 capas:
  - **Capa 1** — Nodos oficiales de Rockstar (`san_andreas_official_nodes.json`)
  - **Capa 2** — Aristas de parche oficial (`network_patches.json`) que corrigen 2 errores de mapeo del juego original
  - **Capa 3** — Atajos curados (carpeta `shortcuts/`, un JSON por atajo)

### 🔍 Búsqueda de Lugares (POIs)
- Autocompletado con alias (Grove Street, Aeropuertos, Mount Chiliad, Four Dragons Casino, etc.).

### 🌐 Soporte Bilingüe y URLs Compartibles
- Traducciones completas en Español (referencia) e Inglés.
- Sincronización de URL bidireccional: `?w=2494,-1668;1707,-2438&r=0&v=bike&l=es`

---

## 🗂️ Estructura del Proyecto

```
san-andreas-pathfinder-3d/
├── src/
│   ├── engine/          ★ Dominio puro: MinHeap, RoadGraph (A*), tipos
│   ├── terrain/         ★ Dominio puro: ElevationPhysics y perfiles de vehículo
│   ├── geo/             ★ Dominio puro: Conversiones de coordenadas y límites
│   ├── map-bridge/      ★ Bridge imperativo Leaflet ↔ React
│   ├── features/        ★ Búsqueda, Tarjetas de ruta, Waypoints, estado URL
│   ├── i18n/            ★ Diccionarios ES/EN tipados y hook useTranslation
│   ├── ui/              ★ Variables CSS globales y componentes artesanales
│   └── app/             ★ Shell de la app y hooks
│
├── public/data/
│   ├── official/
│   │   └── san_andreas_official_nodes.json  # 28,991 nodos, 59,620 aristas
│   ├── custom/
│   │   ├── network_patches.json             # 2 aristas de parche oficial
│   │   └── shortcuts/
│   │       ├── manifest.json
│   │       ├── 1_glen_park_temple.json
│   │       ├── 2_marina_rodeo.json
│   │       ├── 3_mount_chiliad_whetstone.json  # oneWay: true (caída de acantilado)
│   │       ├── 4_san_fierro_doherty.json
│   │       ├── 5_flint_to_red_county.json
│   │       └── 6_flint_to_foster_valley.json  # oneWay: true (caída de acantilado)
│   └── pois.json
│
├── tools/
│   ├── loadNetworkFs.ts     # Lector en disco de las 3 capas (compartido por las CLI)
│   ├── verify-graph.ts      # Invariantes por archivo + del grafo fusionado
│   ├── bench-route.ts       # Benchmark A* contra línea base registrada
│   └── import-shortcuts.ts  # Pipeline: trayectoria CLEO → JSON de atajo
│
├── .agent/skills/           # Documentación de skills del agente
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 💻 Desarrollo

Requisitos: **Node.js ≥ 24.11.0** y **pnpm**.

```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo (HMR)
pnpm dev

# Ejecutar tests unitarios con Vitest
pnpm test

# Verificar invariantes del dataset (cada archivo oficial y el grafo fusionado)
pnpm run verify-graph

# Benchmark del motor A*
pnpm run bench

# Build de producción
pnpm run build
```

---

## 🗺️ Sistema de Coordenadas

| Sistema | Descripción |
|---------|-------------|
| **Unidades del mundo GTA** | Coordenadas nativas de `NODES.DAT`. `X` = Este/Oeste, `Y` = Norte/Sur, `Z` = Altitud. |
| **Leaflet CRS.Simple** | `lat` corresponde a GTA `Y`, `lng` a GTA `X`. **Los ejes están intercambiados.** |

> ⚠️ `lat` es GTA `Y` y `lng` es GTA `X`. Cada bug de marcador espejado es causado por este intercambio.

---

## 🏍️ Perfil de Vehículo Recomendado

El perfil **Motocicleta** (`bike`) es el predeterminado y el recomendado para todos los casos.  
Su `slopeSensitivity: 0.5` lo convierte en el perfil más equilibrado para el variado terreno
de San Andreas — evita sobre-penalizar pendientes pronunciadas mientras respeta los cambios
de elevación en los estimados de tiempo de viaje. Los demás perfiles siguen disponibles en
el selector de la interfaz.

---

## 🌐 Despliegue

```bash
npx vercel
```

---

## 📜 Licencia

Licencia MIT. Los assets del mapa y la red vial pertenecen a **Rockstar Games**.

---

## 🎮 Pipeline de Grabación de Atajos Personalizados

Los atajos personalizados se graban directamente en el juego usando dos scripts CLEO compilados con [Sanny Builder](https://sannybuilder.com/) para **GTA:SA / SA-MP**.

### `tools/cleo/samp_coords_hud.txt` — HUD de Coordenadas en Vivo

Script CLEO ligero que muestra las coordenadas del mundo GTA (`X`, `Y`, `Z`) del jugador en pantalla en tiempo real.

| Tecla | Acción |
|-------|--------|
| `K` o `H` | Activar / Desactivar HUD |

- Lee la posición vía `store_actor` (seguro para SA-MP, sin opcodes de vehículo).
- Visualización: Fila 1 = X (blanco), Fila 2 = Y (amarillo), Fila 3 = Z (celeste).
- Se usa para identificar visualmente los **nodos de entrada y salida** de cada atajo.

---

### `tools/cleo/samp_shortcut_recorder.txt` — Grabador de Trayectorias

Script CLEO que graba una trayectoria 3D continua (saltos, curvas, caminos off-road) y la guarda en `cleo/shortcuts.ini` usando el plugin nativo `IniFiles.cleo`. Sin handles de archivo abiertos/cerrados, sin punteros nulos, sin crasheos.

| Tecla | Acción |
|-------|--------|
| `I` o `Ctrl+1` | Iniciar grabación (REC) |
| `O` o `Ctrl+2` | Detener y guardar trayectoria (STOP) |

Formato de salida (`shortcuts.ini`):
```ini
[meta]                ; cuántas trayectorias lleva escritas el grabador
total_shortcuts = 6

[1]                   ; atajo #1 — cantidad de puntos, se reescribe en cada muestra
points = 23

[1_1]                 ; atajo #1, punto #1
x = -1389.0
y = -1412.9
z = 106.4
```

Las secciones se llaman `<atajo>` para el conteo y `<atajo>_<punto>` para las coordenadas;
`import-shortcuts.ts` matchea exactamente esas dos formas e ignora en silencio cualquier otra,
así que un INI reparado a mano tiene que respetarlas.

Muestreo automático cada **10.0 metros** de movimiento o caída libre, capturando la forma 3D completa de la trayectoria.
El umbral vive en el `.cs` como `dist_sq >= 100.0`. La separación medida en los atajos importados es de
10,33 m de media / 10,30 m de mediana — el sobrepaso es el terreno cubierto dentro de un tick de 10 ms.
Eso coincide con la red oficial, cuya arista mediana es de 11,26 m (10,56 m en corredores de grado 2).

---

### Pipeline Completo

```
Grabación en Juego          Herramienta de Importación   Curación manual        Router
──────────────────          ──────────────────────────   ───────────────        ──────────────
samp_shortcut_recorder  →   tools/import-shortcuts.ts →  quedarse con las    →  public/data/custom/
  (CLEO .cs)                  - snap a nodos oficiales    tomas buenas           shortcuts/<n>_nombre.json
  → cleo/shortcuts.ini        - copia puntos 1:1          corregir conectores
                              - genera aristas forward    marcar oneWay
                              - busca color/oneWay        recortar extremos
                                por ID de grabación
```

> **La última flecha es manual, y a propósito.** Una sesión de grabación produce tomas, no
> resultados: chocás, no te sale el salto del acantilado, volvés a grabar. Nada en la geometría
> distingue una corrida limpia de una fallida — solo lo sabe quien la manejó. Por eso la salida
> del importador es un *candidato*, y promover un candidato a
> `public/data/custom/shortcuts/` es una decisión humana.

> [!WARNING]
> **No vuelvas a correr el importador esperando que regenere los atajos publicados.** Los
> archivos en `public/data/custom/shortcuts/` fueron curados a mano (commits `df061fd`,
> `f356216`): extremos recortados, conectores reapuntados a mejores nodos oficiales, `oneWay`
> definido, aristas de cadena anotadas. El importador no sabe nada de eso y escribe sin
> condiciones, y reconstruye `manifest.json` desde cero solo con los IDs presentes en el INI
> actual.
>
> `.gitignore` excluye `*.ini`, así que las grabaciones crudas nunca se commitean — **el JSON
> curado es la única copia.**

El importador escribe por defecto en un directorio de staging descartable y se niega a publicar
por su cuenta:

```bash
pnpm import-shortcuts                                   # -> .import-staging/shortcuts (se limpia en cada corrida)
pnpm import-shortcuts ruta/a/shortcuts.ini              # INI explícito
pnpm import-shortcuts --out-dir public/data/custom/shortcuts --force   # publicar, a propósito
```

Sin `--force` aborta si el destino ya tiene archivos de atajos, listándolos. También rechaza
emitir un atajo configurado `oneWay: false` cuya geometría tenga un tramo intrepable, porque las
aristas inversas saldrían lo bastante baratas como para que A\* mande al jugador a subir un
acantilado. `GTA_SA_CLEO_DIR` apunta a la carpeta `cleo/` del juego cuando el INI no está copiado
en el repo.

> **Nota:** Los archivos fuente `.txt` deben compilarse a `.cs` con Sanny Builder antes de instalarlos en la carpeta `CLEO/` del juego. Ver [`.agent/skills/cleo-sanny-builder/SKILL.md`](.agent/skills/cleo-sanny-builder/SKILL.md) para instrucciones de compilación.
