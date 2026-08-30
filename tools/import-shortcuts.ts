import fs from 'node:fs';
import path from 'node:path';

interface ShortcutPoint {
  readonly pt: number;
  x: number;
  y: number;
  z: number;
}

interface ShortcutConfig {
  readonly name: string;
  readonly hex: string;
  readonly desc: string;
  readonly slug: string;
  readonly oneWay?: boolean;
}

interface OfficialNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface CustomNetworkNode {
  readonly id: string;
  readonly name?: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly isCustom?: boolean;
  readonly customType?: string;
  readonly color?: string;
}

interface CustomNetworkEdge {
  readonly from: string;
  readonly to: string;
  readonly speed?: number;
  readonly type?: string;
  readonly color?: string;
  readonly description?: string;
}

interface ShortcutFileDoc {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly color: string;
  readonly oneWay?: boolean;
  readonly nodes: CustomNetworkNode[];
  readonly edges: CustomNetworkEdge[];
}

interface ManifestDoc {
  readonly version: string;
  readonly description: string;
  readonly files: string[];
}

const DEFAULT_BOTTLES_PATH = '/home/crhis/.var/app/com.usebottles.bottles/data/bottles/bottles/GTA_SA_Dev/drive_c/Rockstar Games/GTA San Andreas/cleo/shortcuts.ini';
const LOCAL_CLEO_PATH = 'tools/cleo/shortcuts.ini';

function resolveInputPath(cliArg?: string): string {
  if (cliArg) {
    return cliArg;
  }
  if (fs.existsSync(LOCAL_CLEO_PATH)) {
    return LOCAL_CLEO_PATH;
  }
  if (fs.existsSync(DEFAULT_BOTTLES_PATH)) {
    return DEFAULT_BOTTLES_PATH;
  }
  return 'shortcuts.ini';
}

const inputPath = resolveInputPath(process.argv[2]);
const shortcutsDir = 'public/data/custom/shortcuts';
const manifestPath = path.join(shortcutsDir, 'manifest.json');
const officialNodesPath = 'public/data/official/san_andreas_official_nodes.json';

// Paleta de colores asignados por ID de atajo consecutivo (1..6)
// oneWay: true = salto/caida de acantilado fisicamente imposible en sentido inverso
const SHORTCUT_CONFIG: Record<number, ShortcutConfig> = {
  1: { name: 'Dorado', hex: '#f59e0b', desc: 'Glen Park -> Temple (Unidireccional)', slug: '1_glen_park_temple', oneWay: true },
  2: { name: 'Cyan Neón', hex: '#06b6d4', desc: 'Marina -> Rodeo', slug: '2_marina_rodeo', oneWay: false },
  3: { name: 'Rosa Fucsia', hex: '#ec4899', desc: 'Mount Chiliad / Whetstone (Salto de acantilado - Unidireccional)', slug: '3_mount_chiliad_whetstone', oneWay: true },
  4: { name: 'Verde Lima', hex: '#84cc16', desc: 'San Fierro Doherty -> Battery Pt (Unidireccional)', slug: '4_san_fierro_doherty', oneWay: true },
  5: { name: 'Naranja Fuego', hex: '#f97316', desc: 'Flint County -> Red County', slug: '5_flint_to_red_county', oneWay: false },
  6: { name: 'Púrpura Eléctrico', hex: '#a855f7', desc: 'Flint County -> Foster Valley (Caida de acantilado - Unidireccional)', slug: '6_flint_to_foster_valley', oneWay: true }
};

const DEFAULT_COLORS: ReadonlyArray<Readonly<{ name: string; hex: string }>> = [
  { name: 'Dorado', hex: '#f59e0b' },
  { name: 'Verde Esmeralda', hex: '#10b981' },
  { name: 'Cyan Neón', hex: '#06b6d4' },
  { name: 'Púrpura Eléctrico', hex: '#a855f7' },
  { name: 'Rosa Fucsia', hex: '#ec4899' },
  { name: 'Naranja Fuego', hex: '#f97316' },
  { name: 'Verde Lima', hex: '#84cc16' }
];

if (!fs.existsSync(inputPath)) {
  console.error(`❌ No se encontró el archivo INI en: ${inputPath}`);
  console.log(`Uso: tsx tools/import-shortcuts.ts [ruta_a_shortcuts.ini]`);
  process.exit(1);
}

console.log(`📖 Leyendo atajos desde: ${inputPath}`);
const content = fs.readFileSync(inputPath, 'utf8');
const lines = content.split(/\r?\n/);

const metaPoints = new Map<number, number>();
const rawPointMap = new Map<number, Map<number, ShortcutPoint>>();
let currentSection: string | null = null;

// Pase 1: Leer metadatos y puntos
for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line || line.startsWith(';') || line.startsWith('#')) continue;

  const sectionMatch = /^\[(.*)\]$/.exec(line);
  if (sectionMatch?.[1]) {
    currentSection = sectionMatch[1].trim();
    continue;
  }

  if (!currentSection || currentSection === 'meta') continue;

  const [rawKey, ...valParts] = line.split('=');
  if (!rawKey) continue;
  const key = rawKey.trim().toLowerCase();
  const value = valParts.join('=').trim();

  // Caso A: [1] con points=23
  if (/^\d+$/.test(currentSection)) {
    const scId = Number.parseInt(currentSection, 10);
    if (key === 'points') {
      metaPoints.set(scId, Number.parseInt(value, 10));
    }
    continue;
  }

  // Caso B: [1_1] con x, y, z
  const pointMatch = /^(\d+)_(\d+)$/.exec(currentSection);
  if (pointMatch?.[1] && pointMatch?.[2]) {
    const scId = Number.parseInt(pointMatch[1], 10);
    const ptIdx = Number.parseInt(pointMatch[2], 10);

    let ptMap = rawPointMap.get(scId);
    if (!ptMap) {
      ptMap = new Map<number, ShortcutPoint>();
      rawPointMap.set(scId, ptMap);
    }
    let ptObj = ptMap.get(ptIdx);
    if (!ptObj) {
      ptObj = { pt: ptIdx, x: 0, y: 0, z: 0 };
      ptMap.set(ptIdx, ptObj);
    }
    const num = Number.parseFloat(value);
    if (key === 'x') ptObj.x = num;
    if (key === 'y') ptObj.y = num;
    if (key === 'z') ptObj.z = num;
  }
}

// Pase 2: Construir lista limpia respetando el límite exacto de puntos
interface ParsedShortcut {
  readonly id: number;
  readonly points: ShortcutPoint[];
}

const shortcuts: ParsedShortcut[] = [];
for (const [scId, ptMap] of rawPointMap.entries()) {
  const maxPts = metaPoints.get(scId) ?? ptMap.size;
  const validPts: ShortcutPoint[] = [];

  for (let i = 1; i <= maxPts; i++) {
    const p = ptMap.get(i);
    if (p) {
      validPts.push(p);
    }
  }

  if (validPts.length >= 2) {
    shortcuts.push({ id: scId, points: validPts });
  }
}

shortcuts.sort(function (a, b) {
  return a.id - b.id;
});

// Cargar nodos oficiales para conectar automáticamente a la red
let officialNodes: OfficialNode[] = [];
if (fs.existsSync(officialNodesPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(officialNodesPath, 'utf8')) as { nodes?: OfficialNode[] };
    officialNodes = raw.nodes ?? [];
  } catch (e) {
    console.warn('No se pudo leer nodos oficiales para auto-conexión:', e);
  }
}

function findClosestOfficialNode(x: number, y: number): { node: OfficialNode | null; dist: number } {
  let best: OfficialNode | null = null;
  let bestDist = Infinity;
  for (const n of officialNodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return { node: best, dist: bestDist };
}

// Asegurar directorio de atajos
fs.mkdirSync(shortcutsDir, { recursive: true });

const manifestShortcuts: string[] = [];
let totalImportedNodes = 0;
let totalImportedEdges = 0;

for (const sc of shortcuts) {
  const fallbackIndex = (sc.id - 1) % DEFAULT_COLORS.length;
  const fallbackColor = DEFAULT_COLORS[fallbackIndex] ?? { name: 'Dorado', hex: '#f59e0b' };
  const conf: ShortcutConfig = SHORTCUT_CONFIG[sc.id] ?? {
    name: fallbackColor.name,
    hex: fallbackColor.hex,
    desc: `Atajo #${sc.id}`,
    slug: `${sc.id}_shortcut`
  };
  const color = conf.hex;
  const colorName = conf.name;
  const descPrefix = conf.desc || `Atajo #${sc.id}`;
  const pts = sc.points;

  const scNodes: CustomNetworkNode[] = [];
  const scEdges: CustomNetworkEdge[] = [];

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    const nodeId = `sc_${sc.id}_${p.pt}`;
    scNodes.push({
      id: nodeId,
      name: `Atajo #${sc.id} (${colorName}) - Punto ${p.pt}/${pts.length}`,
      x: p.x,
      y: p.y,
      z: p.z
    });

    // Conectar puntos consecutivos bidireccionalmente o unidireccionalmente
    if (i > 0) {
      const prevP = pts[i - 1];
      if (!prevP) continue;
      const prevNodeId = `sc_${sc.id}_${prevP.pt}`;
      if (conf.oneWay) {
        scEdges.push({
          from: prevNodeId,
          to: nodeId,
          speed: 70
        });
      } else {
        scEdges.push(
          {
            from: prevNodeId,
            to: nodeId,
            speed: 70
          },
          {
            from: nodeId,
            to: prevNodeId,
            speed: 70
          }
        );
      }
    }
  }

  // Conectar extremos con la red oficial más cercana
  const firstPt = pts.at(0);
  const lastPt = pts.at(-1);
  if (firstPt && lastPt) {
    const snapStart = findClosestOfficialNode(firstPt.x, firstPt.y);
    if (snapStart.node && snapStart.dist < 60) {
      const startCustomId = `sc_${sc.id}_${firstPt.pt}`;
      if (conf.oneWay) {
        scEdges.push({
          from: snapStart.node.id,
          to: startCustomId,
          speed: 60,
          description: `Entrada a Atajo #${sc.id} (${colorName})`
        });
      } else {
        scEdges.push(
          {
            from: snapStart.node.id,
            to: startCustomId,
            speed: 60,
            description: `Entrada a Atajo #${sc.id} (${colorName})`
          },
          {
            from: startCustomId,
            to: snapStart.node.id,
            speed: 60,
            description: `Entrada a Atajo #${sc.id} (${colorName})`
          }
        );
      }
    }

    const snapEnd = findClosestOfficialNode(lastPt.x, lastPt.y);
    if (snapEnd.node && snapEnd.dist < 60) {
      const endCustomId = `sc_${sc.id}_${lastPt.pt}`;
      if (conf.oneWay) {
        scEdges.push({
          from: endCustomId,
          to: snapEnd.node.id,
          speed: 60,
          description: `Salida de Atajo #${sc.id} (${colorName})`
        });
      } else {
        scEdges.push(
          {
            from: endCustomId,
            to: snapEnd.node.id,
            speed: 60,
            description: `Salida de Atajo #${sc.id} (${colorName})`
          },
          {
            from: snapEnd.node.id,
            to: endCustomId,
            speed: 60,
            description: `Salida de Atajo #${sc.id} (${colorName})`
          }
        );
      }
    }
  }

  const doc: ShortcutFileDoc = {
    id: sc.id,
    name: `Atajo #${sc.id} (${colorName})`,
    description: descPrefix,
    color,
    oneWay: conf.oneWay ?? false,
    nodes: scNodes,
    edges: scEdges
  };

  const relFileName = `${conf.slug}.json`;
  fs.writeFileSync(path.join(shortcutsDir, relFileName), JSON.stringify(doc, null, 2), 'utf8');
  manifestShortcuts.push(relFileName);
  totalImportedNodes += scNodes.length;
  totalImportedEdges += scEdges.length;
}

const manifest: ManifestDoc = {
  version: '1.0.0',
  description: 'Manifest of player-recorded shortcuts for San Andreas',
  files: manifestShortcuts
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log(`✅ ¡Atajos Curados Importados Exitosamente!`);
console.log(`   - Atajos activos : ${shortcuts.length}`);
for (const sc of shortcuts) {
  const fallbackIndex = (sc.id - 1) % DEFAULT_COLORS.length;
  const fallbackColor = DEFAULT_COLORS[fallbackIndex] ?? { name: 'Dorado', hex: '#f59e0b' };
  const c = SHORTCUT_CONFIG[sc.id] ?? {
    name: fallbackColor.name,
    hex: fallbackColor.hex,
    desc: '',
    slug: ''
  };
  console.log(`     * Atajo #${sc.id}: ${sc.points.length} puntos | Color: ${c.name} (${c.hex}) | ${c.desc}`);
}
console.log(`   - Nodos importados en atajos : ${totalImportedNodes}`);
console.log(`   - Aristas creadas            : ${totalImportedEdges}`);
console.log(`   - Manifest actualizado en    : ${manifestPath}`);
