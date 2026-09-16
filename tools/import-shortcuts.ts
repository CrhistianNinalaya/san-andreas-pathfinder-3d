import fs from 'node:fs';
import path from 'node:path';

interface ShortcutPoint {
  readonly pt: number;
  x: number;
  y: number;
  z: number;
  /** At least one coordinate could not be parsed as a finite number */
  invalid?: boolean;
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

const LOCAL_CLEO_PATH = 'tools/cleo/shortcuts.ini';

// cleo/ folder of the GTA:SA install. Machine-specific (Bottles prefix on Linux,
// "Rockstar Games/GTA San Andreas/cleo" on Windows), so it comes from the environment.
function resolveInputPath(cliArg?: string): string {
  if (cliArg) {
    return cliArg;
  }
  if (fs.existsSync(LOCAL_CLEO_PATH)) {
    return LOCAL_CLEO_PATH;
  }
  const envCleoDir = process.env.GTA_SA_CLEO_DIR;
  if (envCleoDir) {
    const envPath = path.join(envCleoDir, 'shortcuts.ini');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
  }
  return 'shortcuts.ini';
}

/**
 * Directory the app actually loads shortcuts from. Its contents are hand-curated:
 * bad takes discarded, endpoints trimmed, connectors re-pointed, oneWay decided,
 * chain edges annotated. This script knows none of that, so it never writes here
 * unless the operator spells the path out via --out-dir and confirms with --force.
 */
const PUBLISHED_DIR = 'public/data/custom/shortcuts';
/** Disposable scratch output. Wiped on every run and excluded from git. */
const DEFAULT_STAGING_DIR = '.import-staging/shortcuts';

interface CliOptions {
  readonly iniPath: string;
  readonly outDir: string;
  readonly force: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let iniArg: string | undefined;
  let outDir = DEFAULT_STAGING_DIR;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--out-dir') {
      const next = argv[i + 1];
      if (!next) {
        console.error('❌ --out-dir requires a path');
        process.exit(1);
      }
      outDir = next;
      i++;
      continue;
    }
    if (arg?.startsWith('--')) {
      console.error(`❌ Unknown option: ${arg}`);
      process.exit(1);
    }
    if (!iniArg) iniArg = arg;
  }

  return { iniPath: resolveInputPath(iniArg), outDir, force };
}

const cli = parseArgs(process.argv.slice(2));
const inputPath = cli.iniPath;
const shortcutsDir = cli.outDir;
const isStaging = path.resolve(shortcutsDir) === path.resolve(DEFAULT_STAGING_DIR);
const isPublished = path.resolve(shortcutsDir) === path.resolve(PUBLISHED_DIR);
const manifestPath = path.join(shortcutsDir, 'manifest.json');
const officialNodesPath = 'public/data/official/san_andreas_official_nodes.json';

function existingShortcutFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(function (f) {
    return f.endsWith('.json') && f !== 'manifest.json';
  });
}

// Writing over curated data is a deliberate act, never a side effect of re-running
// the import. .gitignore excludes *.ini, so the JSON in PUBLISHED_DIR is the only
// surviving copy of a curated shortcut.
if (!isStaging && !cli.force) {
  const existing = existingShortcutFiles(shortcutsDir);
  if (existing.length > 0) {
    console.error(`❌ ${shortcutsDir} already holds ${existing.length} shortcut file(s):`);
    for (const f of existing) console.error(`     - ${f}`);
    console.error(`   Overwriting them discards the manual curation (trimmed endpoints,`);
    console.error(`   connector choices, oneWay flags, edge descriptions) and rebuilds`);
    console.error(`   the manifest from this INI alone.`);
    console.error(`   Import to staging and diff first, or pass --force if you mean it.`);
    process.exit(1);
  }
}

if (isPublished && cli.force) {
  console.warn(`⚠️  Writing straight into ${PUBLISHED_DIR} — curated content will be replaced.`);
}

/**
 * Per-shortcut presentation and directionality, keyed by the CLEO recording ID.
 *
 * oneWay: true = jump or cliff drop that is physically impossible to reverse.
 *
 * KNOWN DESIGN FLAW — evaluate a proper fix separately.
 * The key is the `11@` counter from samp_shortcut_recorder.cs, which increments on
 * every `I` press. So `oneWay`, `slug`, `name` and `hex` are bound to *the order the
 * player happened to start recording in*, not to anything in the recorded geometry.
 * A discarded take, an accidental keypress or a counter reset shifts every later ID
 * by one, and a cliff drop silently inherits the config of a two-way dirt trail.
 *
 * `assertDirectionality` below contains the damage — it refuses to emit reverse
 * edges up an unclimbable slope — but the coupling itself remains. The real fix is
 * to stop keying on the counter: either have the CLEO script write a stable label
 * per trajectory, or match a recording to its config by start/end geometry.
 */
const SHORTCUT_CONFIG: Record<number, ShortcutConfig> = {
  1: { name: 'Gold', hex: '#f59e0b', desc: 'Glen Park -> Temple (one-way)', slug: '1_glen_park_temple', oneWay: true },
  2: { name: 'Neon Cyan', hex: '#06b6d4', desc: 'Marina -> Rodeo', slug: '2_marina_rodeo', oneWay: false },
  3: { name: 'Fuchsia Pink', hex: '#ec4899', desc: 'Mount Chiliad / Whetstone (cliff jump - one-way)', slug: '3_mount_chiliad_whetstone', oneWay: true },
  4: { name: 'Lime Green', hex: '#84cc16', desc: 'San Fierro Doherty -> Battery Pt (one-way)', slug: '4_san_fierro_doherty', oneWay: true },
  5: { name: 'Fire Orange', hex: '#f97316', desc: 'Flint County -> Red County', slug: '5_flint_to_red_county', oneWay: false },
  6: { name: 'Electric Purple', hex: '#a855f7', desc: 'Flint County -> Foster Valley (cliff drop - one-way)', slug: '6_flint_to_foster_valley', oneWay: true }
};

const DEFAULT_COLORS: ReadonlyArray<Readonly<{ name: string; hex: string }>> = [
  { name: 'Gold', hex: '#f59e0b' },
  { name: 'Emerald Green', hex: '#10b981' },
  { name: 'Neon Cyan', hex: '#06b6d4' },
  { name: 'Electric Purple', hex: '#a855f7' },
  { name: 'Fuchsia Pink', hex: '#ec4899' },
  { name: 'Fire Orange', hex: '#f97316' },
  { name: 'Lime Green', hex: '#84cc16' }
];

if (!fs.existsSync(inputPath)) {
  console.error(`❌ INI file not found at: ${inputPath}`);
  console.log(`Usage: tsx tools/import-shortcuts.ts [shortcuts.ini] [--out-dir <dir>] [--force]`);
  process.exit(1);
}

console.log(`📖 Reading shortcuts from: ${inputPath}`);
const content = fs.readFileSync(inputPath, 'utf8');
const lines = content.split(/\r?\n/);

const metaPoints = new Map<number, number>();
const rawPointMap = new Map<number, Map<number, ShortcutPoint>>();
let currentSection: string | null = null;

// Pass 1: read metadata and points
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

  // Case A: [1] with points=23
  if (/^\d+$/.test(currentSection)) {
    const scId = Number.parseInt(currentSection, 10);
    if (key === 'points') {
      metaPoints.set(scId, Number.parseInt(value, 10));
    }
    continue;
  }

  // Case B: [1_1] with x, y, z
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
    if (key !== 'x' && key !== 'y' && key !== 'z') continue;

    // IniFiles writes MSVC-style non-finite floats ("1.#QNAN", "-1.#IND") when the
    // actor is sampled during a load screen. parseFloat stops at the '#' and returns
    // 1 / -1, which would drop the node at the map origin with no warning.
    const num = Number.parseFloat(value);
    if (!/^[+-]?\d+(\.\d+)?$/.test(value) || !Number.isFinite(num)) {
      console.warn(`⚠️  Shortcut #${scId} point ${ptIdx}: unreadable ${key} coordinate ("${value}")`);
      ptObj.invalid = true;
      continue;
    }
    ptObj[key] = num;
  }
}

// Pass 2: build the clean list, honouring the declared point count
interface ParsedShortcut {
  readonly id: number;
  readonly points: ShortcutPoint[];
}

const shortcuts: ParsedShortcut[] = [];
for (const [scId, ptMap] of rawPointMap.entries()) {
  // 'points' may be missing or corrupt if the game died mid-write. Number.parseInt('')
  // is NaN, and NaN is not nullish, so '??' is not a sufficient guard: 'i <= NaN' is
  // false on the first iteration and the shortcut would be dropped silently.
  const declaredPts = metaPoints.get(scId);
  const hasValidCount = declaredPts !== undefined && Number.isInteger(declaredPts) && declaredPts > 0;
  const maxPts = hasValidCount ? declaredPts : ptMap.size;

  if (declaredPts !== undefined && !hasValidCount) {
    console.warn(`⚠️  Shortcut #${scId}: invalid 'points' key; falling back to the ${ptMap.size} sections found`);
  } else if (hasValidCount && declaredPts !== ptMap.size) {
    console.warn(`⚠️  Shortcut #${scId}: 'points' declares ${declaredPts} but ${ptMap.size} [${scId}_n] sections exist`);
  }

  const validPts: ShortcutPoint[] = [];

  for (let i = 1; i <= maxPts; i++) {
    const p = ptMap.get(i);
    if (p) {
      validPts.push(p);
    }
  }

  const corrupt = validPts.filter(function (p) {
    return p.invalid === true;
  });
  if (corrupt.length > 0) {
    console.warn(`❌ Shortcut #${scId} dropped: ${corrupt.length} point(s) with unreadable coordinates`);
    continue;
  }

  if (validPts.length >= 2) {
    shortcuts.push({ id: scId, points: validPts });
  } else {
    console.warn(`❌ Shortcut #${scId} dropped: only ${validPts.length} usable point(s)`);
  }
}

shortcuts.sort(function (a, b) {
  return a.id - b.id;
});

/**
 * Steepest gradient a vehicle can be asked to climb. Above this the reverse of a
 * descent is not a slow road, it is a wall.
 */
const MAX_CLIMBABLE_SLOPE = 0.5;

/**
 * Refuses to build a bidirectional shortcut whose reverse direction is unclimbable.
 *
 * ElevationPhysics floors the uphill response at MIN_UPHILL_RESPONSE = 0.2, so a
 * +180% grade is still priced at a finite, *cheap* speed (70 km/h nominal becomes
 * ~14 km/h over a ~10 m edge) and A* prefers it precisely because it is short. A
 * mis-keyed oneWay flag therefore does not degrade a route, it invents one through
 * a cliff face.
 */
function assertDirectionality(sc: ParsedShortcut, conf: ShortcutConfig): string[] {
  if (conf.oneWay) return [];

  const offenders: string[] = [];
  for (let i = 1; i < sc.points.length; i++) {
    const a = sc.points[i - 1];
    const b = sc.points[i];
    if (!a || !b) continue;
    const dist2D = Math.hypot(b.x - a.x, b.y - a.y);
    if (dist2D < 0.1) continue;
    const slope = (b.z - a.z) / dist2D;
    if (Math.abs(slope) > MAX_CLIMBABLE_SLOPE) {
      offenders.push(`point ${a.pt}->${b.pt}: slope ${slope.toFixed(2)} over ${dist2D.toFixed(1)} m`);
    }
  }
  return offenders;
}

// Load official nodes so shortcut endpoints can be wired into the network
let officialNodes: OfficialNode[] = [];
if (fs.existsSync(officialNodesPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(officialNodesPath, 'utf8')) as { nodes?: OfficialNode[] };
    officialNodes = raw.nodes ?? [];
  } catch (e) {
    console.warn('Could not read official nodes for auto-connection:', e);
  }
}

/** Maximum horizontal radius for accepting an official node as a connector */
const SNAP_RADIUS_2D = 60;
/**
 * Maximum vertical gap tolerated on a connector. Without this guard the closest
 * candidate in plan view can be the road passing UNDERNEATH an overpass, a cliff
 * ledge or a rooftop: the 2D distance is ~0, the connector is emitted, and since
 * calculateSlope returns 0 when dist2D < 0.1 the vertical drop is priced at the
 * full nominal speed. Largest |dz| across the shipped connectors is 1.61 m.
 */
const SNAP_MAX_DZ = 6;

function findClosestOfficialNode(x: number, y: number, z: number): { node: OfficialNode | null; dist: number } {
  let best: OfficialNode | null = null;
  let bestDist = Infinity;
  for (const n of officialNodes) {
    if (Math.hypot(n.x - x, n.y - y) > SNAP_RADIUS_2D) continue;
    if (Math.abs(n.z - z) > SNAP_MAX_DZ) continue;
    const d = Math.hypot(n.x - x, n.y - y, n.z - z);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return { node: best, dist: bestDist };
}

function configFor(id: number): ShortcutConfig {
  const fallbackIndex = (id - 1) % DEFAULT_COLORS.length;
  const fallbackColor = DEFAULT_COLORS[fallbackIndex] ?? { name: 'Gold', hex: '#f59e0b' };
  return SHORTCUT_CONFIG[id] ?? {
    name: fallbackColor.name,
    hex: fallbackColor.hex,
    desc: `Shortcut #${id}`,
    slug: `${id}_shortcut`
  };
}

// Validate every shortcut before writing anything, so a rejected one cannot leave
// half an import on disk.
let directionalityFailures = 0;
for (const sc of shortcuts) {
  const offenders = assertDirectionality(sc, configFor(sc.id));
  if (offenders.length === 0) continue;
  directionalityFailures++;
  console.error(`❌ Shortcut #${sc.id} is configured oneWay: false but has ${offenders.length} unclimbable segment(s):`);
  for (const o of offenders) console.error(`     - ${o}`);
}
if (directionalityFailures > 0) {
  console.error(`   Reverse edges here would be routable and cheap, sending the player up a cliff.`);
  console.error(`   Either the recording IDs shifted (see SHORTCUT_CONFIG) or these shortcuts are oneWay.`);
  process.exit(1);
}

// Ensure the output directory exists
if (isStaging && fs.existsSync(shortcutsDir)) {
  fs.rmSync(shortcutsDir, { recursive: true, force: true });
}
fs.mkdirSync(shortcutsDir, { recursive: true });

const manifestShortcuts: string[] = [];
let totalImportedNodes = 0;
let totalImportedEdges = 0;

for (const sc of shortcuts) {
  const conf = configFor(sc.id);
  const color = conf.hex;
  const colorName = conf.name;
  const descPrefix = conf.desc || `Shortcut #${sc.id}`;
  const pts = sc.points;

  const scNodes: CustomNetworkNode[] = [];
  const scEdges: CustomNetworkEdge[] = [];

  /*
   * KNOWN ISSUE — display strings are baked into the data. Fix separately.
   * The `name` and `description` written below are rendered verbatim by the UI
   * (useNodesLayer.ts reads `node.name` straight into the popup), so they bypass
   * src/i18n/translations.ts entirely and show the same language whatever the user
   * picked. Shortcut labels should be composed at render time from a translation
   * key plus structured fields (shortcut id, colour token, point index / total),
   * with this script emitting those fields instead of a formatted sentence.
   * Changing it touches the importer, the curated JSON under
   * public/data/custom/shortcuts/, and the popup renderers, so it is out of scope
   * here; the strings below are English only to match the rest of the file.
   */
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    const nodeId = `sc_${sc.id}_${p.pt}`;
    scNodes.push({
      id: nodeId,
      name: `Shortcut #${sc.id} (${colorName}) - Point ${p.pt}/${pts.length}`,
      x: p.x,
      y: p.y,
      z: p.z
    });

    // Link consecutive points, one-way or both ways
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

  // Wire the endpoints into the nearest official nodes
  const firstPt = pts.at(0);
  const lastPt = pts.at(-1);
  if (firstPt && lastPt) {
    const snapStart = findClosestOfficialNode(firstPt.x, firstPt.y, firstPt.z);
    if (!snapStart.node) {
      console.warn(`⚠️  Shortcut #${sc.id}: no official node for the entry (radius ${SNAP_RADIUS_2D} m, |dz| ${SNAP_MAX_DZ} m)`);
    }
    if (snapStart.node) {
      const startCustomId = `sc_${sc.id}_${firstPt.pt}`;
      if (conf.oneWay) {
        scEdges.push({
          from: snapStart.node.id,
          to: startCustomId,
          speed: 60,
          description: `Entry to Shortcut #${sc.id} (${colorName})`
        });
      } else {
        scEdges.push(
          {
            from: snapStart.node.id,
            to: startCustomId,
            speed: 60,
            description: `Entry to Shortcut #${sc.id} (${colorName})`
          },
          {
            from: startCustomId,
            to: snapStart.node.id,
            speed: 60,
            description: `Entry to Shortcut #${sc.id} (${colorName})`
          }
        );
      }
    }

    const snapEnd = findClosestOfficialNode(lastPt.x, lastPt.y, lastPt.z);
    if (!snapEnd.node) {
      console.warn(`⚠️  Shortcut #${sc.id}: no official node for the exit (radius ${SNAP_RADIUS_2D} m, |dz| ${SNAP_MAX_DZ} m)`);
    }
    if (snapEnd.node) {
      const endCustomId = `sc_${sc.id}_${lastPt.pt}`;
      if (conf.oneWay) {
        scEdges.push({
          from: endCustomId,
          to: snapEnd.node.id,
          speed: 60,
          description: `Exit from Shortcut #${sc.id} (${colorName})`
        });
      } else {
        scEdges.push(
          {
            from: endCustomId,
            to: snapEnd.node.id,
            speed: 60,
            description: `Exit from Shortcut #${sc.id} (${colorName})`
          },
          {
            from: snapEnd.node.id,
            to: endCustomId,
            speed: 60,
            description: `Exit from Shortcut #${sc.id} (${colorName})`
          }
        );
      }
    }
  }

  const doc: ShortcutFileDoc = {
    id: sc.id,
    name: `Shortcut #${sc.id} (${colorName})`,
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

console.log(`✅ Import finished — review the output before promoting it.`);
console.log(`   - Shortcuts imported : ${shortcuts.length}`);
for (const sc of shortcuts) {
  const c = configFor(sc.id);
  console.log(`     * Shortcut #${sc.id}: ${sc.points.length} points | Colour: ${c.name} (${c.hex}) | ${c.desc}`);
}
console.log(`   - Nodes written      : ${totalImportedNodes}`);
console.log(`   - Edges created      : ${totalImportedEdges}`);
console.log(`   - Manifest           : ${manifestPath}`);
console.log(`   - Output directory   : ${shortcutsDir}${isStaging ? ' (staging — copy by hand once reviewed)' : ''}`);
