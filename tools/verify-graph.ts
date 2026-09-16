#!/usr/bin/env node
/**
 * Dataset integrity + connectivity checker for the San Andreas road graph.
 *
 * Usage:
 *   tsx tools/verify-graph.ts                       # every official file, then the merged graph
 *   tsx tools/verify-graph.ts public/data/foo.json  # checks one file
 *   tsx tools/verify-graph.ts --json                # machine-readable output
 *
 * The merged pass is the important one: it builds the same three-layer graph the app builds
 * (via loadNetworkFromDisk) and checks the invariants that only break across layers — ids
 * colliding between official and custom nodes, connectors pointing at nodes that a curation
 * pass trimmed, and the weak/strong component divergence that one-way shortcut edges made
 * possible.
 *
 * Exit code is 1 if any INVARIANT fails, 0 otherwise. WARN lines never fail the run.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadNetworkFromDisk } from './loadNetworkFs';
import type { LoadedShortcut } from './loadNetworkFs';
import type { RawDataset } from '../src/engine/types';

interface DatasetReport {
  path: string;
  bytes: number;
  nodeCount: number;
  edgeCount: number;
  duplicateIds: string[];
  duplicateEdges: string[];
  dangling: string[];
  selfLoops: string[];
  outOfBounds: Array<number | string>;
  nonFiniteZ: number;
  namedNodes: number;
  speeds: number[];
  maxNominalSpeed: number;
  reciprocal: number;
  oneWay: number;
  components: number;
  giant: number;
  orphaned: number;
  orphanShare: number;
  binaryBytes: number;
  /** Merged pass only: size of the largest strongly-connected component. */
  strongCore?: number;
  /** Merged pass only: shortcut docs flagged oneWay whose edges include a reverse. */
  oneWayViolations?: string[];
  /** Merged pass only: world positions occupied by more than one node. */
  coincident?: string[];
}

interface NodeValidationResult {
  indexOf: Map<string, number>;
  duplicateIds: string[];
  outOfBounds: Array<number | string>;
  namedNodes: number;
  nonFiniteZ: number;
}

interface EdgeValidationResult {
  seen: Set<string>;
  dangling: string[];
  duplicateEdges: string[];
  selfLoops: string[];
  speeds: Set<number>;
  maxNominalSpeed: number;
}

const WORLD_MIN = -3000;
const WORLD_MAX = 3000;
const MIN_GIANT_COMPONENT_SHARE = 0.9;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const files = args.filter((a) => !a.startsWith('--'));

function discoverDatasets(): string[] {
  const paths: string[] = [];
  try {
    const offFiles = readdirSync('public/data/official')
      .filter((f) => f.endsWith('.json'))
      .map((f) => join('public/data/official', f));
    paths.push(...offFiles);
  } catch {
    // fallback
  }
  return paths;
}

function findRoot(parent: Int32Array, a: number): number {
  let curr = a;
  while (parent[curr] !== undefined && parent[curr] !== curr) {
    const parentCurr = parent[curr];
    if (parentCurr !== undefined) {
      parent[curr] = parent[parentCurr] ?? parentCurr;
      curr = parentCurr;
    }
  }
  return curr;
}

/**
 * Union-find over node indices. This is direction-blind, so it yields WEAK components.
 * The custom layer introduced one-way edges, so weak no longer implies strong — the merged
 * pass compares this against largestStronglyConnectedSize to catch the divergence.
 */
function componentSizes(nodeCount: number, edges: RawDataset['edges'], indexOf: Map<string, number>): number[] {
  const parent = new Int32Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) parent[i] = i;

  for (const edge of edges) {
    const a = indexOf.get(String(edge.from));
    const b = indexOf.get(String(edge.to));
    if (a === undefined || b === undefined) continue;
    const ra = findRoot(parent, a);
    const rb = findRoot(parent, b);
    if (ra !== rb) parent[ra] = rb;
  }

  const counts = new Map<number, number>();
  for (let i = 0; i < nodeCount; i++) {
    const root = findRoot(parent, i);
    counts.set(root, (counts.get(root) ?? 0) + 1);
  }
  return [...counts.values()].sort((a, b) => b - a);
}

function validateNodes(nodes: RawDataset['nodes']): NodeValidationResult {
  const indexOf = new Map<string, number>();
  const duplicateIds: string[] = [];
  const outOfBounds: Array<number | string> = [];
  let namedNodes = 0;
  let nonFiniteZ = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;

    const id = String(node.id);
    if (indexOf.has(id)) duplicateIds.push(id);
    else indexOf.set(id, i);

    if (node.name) namedNodes++;
    if (node.z === undefined || !Number.isFinite(node.z)) nonFiniteZ++;
    if (
      node.x < WORLD_MIN || node.x > WORLD_MAX ||
      node.y < WORLD_MIN || node.y > WORLD_MAX
    ) {
      outOfBounds.push(node.id);
    }
  }

  return { indexOf, duplicateIds, outOfBounds, namedNodes, nonFiniteZ };
}

function validateEdges(edges: RawDataset['edges'], indexOf: Map<string, number>): EdgeValidationResult {
  const seen = new Set<string>();
  const dangling: string[] = [];
  const duplicateEdges: string[] = [];
  const selfLoops: string[] = [];
  const speeds = new Set<number>();
  let maxNominalSpeed = 0;

  for (const edge of edges) {
    const from = String(edge.from);
    const to = String(edge.to);

    if (!indexOf.has(from) || !indexOf.has(to)) dangling.push(`${from}->${to}`);
    if (from === to) selfLoops.push(from);

    const key = `${from} ${to}`;
    if (seen.has(key)) duplicateEdges.push(`${from}->${to}`);
    seen.add(key);

    const speed = edge.speed ?? 80;
    speeds.add(speed);
    if (speed > maxNominalSpeed) maxNominalSpeed = speed;
  }

  return { seen, dangling, duplicateEdges, selfLoops, speeds, maxNominalSpeed };
}

function countReciprocalEdges(seen: Set<string>): number {
  let reciprocal = 0;
  for (const key of seen) {
    const parts = key.split(' ');
    const from = parts[0];
    const to = parts[1];
    if (from && to && seen.has(`${to} ${from}`)) reciprocal++;
  }
  return reciprocal;
}

/**
 * Typed-array read that satisfies noUncheckedIndexedAccess.
 *
 * Every index passed below comes from a bounded loop or from `indexOf`, so the fallback is
 * unreachable; -1 is used for it because that is already the "absent" sentinel for head,
 * next and index.
 */
function intAt(values: ArrayLike<number | undefined>, i: number): number {
  return values[i] ?? -1;
}

/** Forward-star adjacency: compact, allocation-free traversal of a node's outgoing edges. */
interface ForwardStar {
  /** head[v] = index of v's first outgoing edge, or -1. */
  readonly head: Int32Array;
  /** target[e] = destination node index of edge e. */
  readonly target: number[];
  /** next[e] = the next edge leaving the same node, or -1. */
  readonly next: number[];
}

interface GraphShape {
  readonly nodeCount: number;
  readonly edges: RawDataset['edges'];
  readonly indexOf: Map<string, number>;
}

function buildForwardStar({ nodeCount, edges, indexOf }: GraphShape): ForwardStar {
  const head = new Int32Array(nodeCount).fill(-1);
  const target: number[] = [];
  const next: number[] = [];

  for (const edge of edges) {
    const from = indexOf.get(String(edge.from));
    const to = indexOf.get(String(edge.to));
    if (from === undefined || to === undefined) continue;
    target.push(to);
    next.push(intAt(head, from));
    head[from] = target.length - 1;
  }

  return { head, target, next };
}

/** One node on Tarjan's explicit call stack, with its traversal cursor. */
interface SccFrame {
  readonly node: number;
  /** Next outgoing edge to follow, or -1 when the node is exhausted. */
  edge: number;
}

interface SccState {
  readonly graph: ForwardStar;
  readonly index: Int32Array;
  readonly low: Int32Array;
  readonly onStack: Uint8Array;
  readonly stack: number[];
  readonly frames: SccFrame[];
  counter: number;
  largest: number;
}

function createSccState(nodeCount: number, graph: ForwardStar): SccState {
  return {
    graph,
    index: new Int32Array(nodeCount).fill(-1),
    low: new Int32Array(nodeCount),
    onStack: new Uint8Array(nodeCount),
    stack: [],
    frames: [],
    counter: 0,
    largest: 0
  };
}

/** Assigns a node its discovery index and opens a frame for it. */
function openFrame(state: SccState, node: number): void {
  state.index[node] = state.counter;
  state.low[node] = state.counter;
  state.counter++;
  state.stack.push(node);
  state.onStack[node] = 1;
  state.frames.push({ node, edge: intAt(state.graph.head, node) });
}

/** Advances the frame's cursor and returns the target it points at, or -1 when exhausted. */
function takeNextTarget(state: SccState, frame: SccFrame): number {
  const edge = frame.edge;
  if (edge === -1) return -1;
  frame.edge = intAt(state.graph.next, edge);
  return intAt(state.graph.target, edge);
}

function lowerLink(state: SccState, node: number, candidate: number): void {
  if (candidate < intAt(state.low, node)) state.low[node] = candidate;
}

function visitTarget(state: SccState, from: number, to: number): void {
  if (intAt(state.index, to) === -1) {
    openFrame(state, to);
    return;
  }
  if (state.onStack[to] === 1) lowerLink(state, from, intAt(state.index, to));
}

/** Pops one strongly-connected component off the stack and records its size. */
function collectComponent(state: SccState, root: number): void {
  let size = 0;
  for (;;) {
    const node = state.stack.pop();
    if (node === undefined) break;
    state.onStack[node] = 0;
    size++;
    if (node === root) break;
  }
  if (size > state.largest) state.largest = size;
}

/** Closes an exhausted frame, emitting its component if it is a root. */
function closeFrame(state: SccState, node: number): void {
  if (intAt(state.low, node) === intAt(state.index, node)) collectComponent(state, node);
  state.frames.pop();
  const parent = state.frames.at(-1);
  if (parent) lowerLink(state, parent.node, intAt(state.low, node));
}

function exploreFrom(state: SccState, start: number): void {
  openFrame(state, start);

  while (state.frames.length > 0) {
    const frame = state.frames.at(-1);
    if (!frame) return;

    const to = takeNextTarget(state, frame);
    if (to === -1) closeFrame(state, frame.node);
    else visitTarget(state, frame.node, to);
  }
}

/**
 * Size of the largest strongly-connected component, via iterative Tarjan.
 *
 * Iterative because the graph is ~29k nodes deep in places and a recursive version
 * overflows the stack. Compared against the weak giant: while every edge was reciprocal
 * the two were identical by construction, and RoadGraph's `onlyGiant` gate still assumes
 * it. One-way shortcut edges can break that silently, stranding nodes that the app would
 * still offer as routable snap targets.
 */
function largestStronglyConnectedSize(graph: GraphShape): number {
  const { nodeCount } = graph;
  const state = createSccState(nodeCount, buildForwardStar(graph));

  for (let node = 0; node < nodeCount; node++) {
    if (intAt(state.index, node) === -1) exploreFrom(state, node);
  }

  return state.largest;
}

/**
 * A shortcut doc marked `oneWay: true` must not ship reverse edges.
 *
 * RoadGraph only copies the flag onto the adjacency entry (its sole consumer is a tooltip
 * badge), so nothing at runtime stops a reverse edge from being routed. The flag is only as
 * true as the data, and these are cliff drops and stunt jumps: a reverse edge means the
 * router can send the player up a sheer rock face.
 */
function findOneWayViolations(shortcuts: readonly LoadedShortcut[]): string[] {
  const violations: string[] = [];

  for (const { path: filePath, doc } of shortcuts) {
    if (doc.oneWay !== true) continue;

    const directed = new Set<string>();
    for (const e of doc.edges ?? []) directed.add(`${String(e.from)} ${String(e.to)}`);

    const reversed: string[] = [];
    for (const key of directed) {
      const [from, to] = key.split(' ');
      if (from && to && directed.has(`${to} ${from}`)) reversed.push(`${from}->${to}`);
    }

    if (reversed.length > 0) {
      violations.push(`${basename(filePath)}: oneWay but ${reversed.length} edge(s) have a reverse, e.g. ${reversed[0]}`);
    }
  }

  return violations;
}

/**
 * World positions occupied by more than one node.
 *
 * Two nodes at the same point make findNearestNode's strict `<` tie-break decide by scan
 * order, which today is "official layer first" only because init concatenates it first.
 * Reported as a warning: the shipped data has seven of these by construction (shortcut
 * endpoints snapped onto their official node) and they are not breaking anything yet.
 */
function findCoincidentNodes(nodes: RawDataset['nodes']): string[] {
  const byPosition = new Map<string, string[]>();

  for (const node of nodes) {
    if (!node) continue;
    const key = `${node.x},${node.y},${node.z ?? 0}`;
    const ids = byPosition.get(key);
    if (ids) ids.push(String(node.id));
    else byPosition.set(key, [String(node.id)]);
  }

  const collisions: string[] = [];
  for (const [position, ids] of byPosition) {
    if (ids.length > 1) collisions.push(`${ids.join(' == ')} @ ${position}`);
  }
  return collisions;
}

function analyzeDataset(path: string, bytes: number, data: RawDataset): DatasetReport {
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];


  const nodeStats = validateNodes(nodes);
  const edgeStats = validateEdges(edges, nodeStats.indexOf);

  const reciprocal = countReciprocalEdges(edgeStats.seen);
  const oneWay = edgeStats.seen.size - reciprocal;

  const components = componentSizes(nodes.length, edges, nodeStats.indexOf);
  const giant = components[0] ?? 0;
  const orphaned = nodes.length - giant;

  const undirectedEdges = oneWay + reciprocal / 2;
  const binaryBytes = nodes.length * 12 + Math.round(undirectedEdges) * 9;

  return {
    path,
    bytes,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    duplicateIds: nodeStats.duplicateIds,
    duplicateEdges: edgeStats.duplicateEdges,
    dangling: edgeStats.dangling,
    selfLoops: edgeStats.selfLoops,
    outOfBounds: nodeStats.outOfBounds,
    nonFiniteZ: nodeStats.nonFiniteZ,
    namedNodes: nodeStats.namedNodes,
    speeds: [...edgeStats.speeds].sort((a, b) => a - b),
    maxNominalSpeed: edgeStats.maxNominalSpeed,
    reciprocal,
    oneWay,
    components: components.length,
    giant,
    orphaned,
    orphanShare: nodes.length ? orphaned / nodes.length : 0,
    binaryBytes
  };
}

function analyze(path: string): DatasetReport {
  const bytes = statSync(path).size;
  const data: RawDataset = JSON.parse(readFileSync(path, 'utf8'));
  return analyzeDataset(path, bytes, data);
}

/**
 * Builds the three-layer graph exactly as the app does and analyses it as one dataset,
 * plus the invariants that only exist across layers.
 */
function analyzeMergedNetwork(): DatasetReport {
  const network = loadNetworkFromDisk();

  const nodes = [...network.official.nodes, ...(network.custom?.nodes ?? [])];
  const edges = [...network.official.edges, ...(network.custom?.edges ?? [])];

  let bytes = statSync(network.officialPath).size;
  if (network.patchesPath) bytes += statSync(network.patchesPath).size;
  for (const s of network.shortcuts) bytes += statSync(s.path).size;

  const report = analyzeDataset('merged network (official + patches + shortcuts)', bytes, { nodes, edges });

  const indexOf = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node && !indexOf.has(String(node.id))) indexOf.set(String(node.id), i);
  }

  return {
    ...report,
    strongCore: largestStronglyConnectedSize({ nodeCount: nodes.length, edges, indexOf }),
    oneWayViolations: findOneWayViolations(network.shortcuts),
    coincident: findCoincidentNodes(nodes)
  };
}

function mb(n: number): string {
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function kb(n: number): string {
  return `${(n / 1024).toFixed(0)} KB`;
}

function reportInvariants(
  r: DatasetReport,
  logSuccess: (label: string) => void,
  logProblem: (label: string, detail: string) => void
): void {
  if (r.duplicateIds.length === 0) logSuccess('unique node ids');
  else logProblem('unique node ids', `${r.duplicateIds.length} duplicates`);

  if (r.dangling.length === 0) logSuccess('no dangling edge endpoints');
  else logProblem('no dangling edge endpoints', `${r.dangling.length} edges reference missing nodes`);

  if (r.duplicateEdges.length === 0) logSuccess('no duplicate edges');
  else logProblem('no duplicate edges', `${r.duplicateEdges.length} repeated pairs`);

  if (r.selfLoops.length === 0) logSuccess('no self loops');
  else logProblem('no self loops', `${r.selfLoops.length} found`);

  if (r.outOfBounds.length === 0) logSuccess(`all nodes inside [${WORLD_MIN}, ${WORLD_MAX}]`);
  else logProblem(`all nodes inside [${WORLD_MIN}, ${WORLD_MAX}]`, `${r.outOfBounds.length} outside`);

  if (r.nonFiniteZ === 0) logSuccess('every node has a finite z');
  else logProblem('every node has a finite z', `${r.nonFiniteZ} missing or NaN`);

  if (r.orphanShare <= 1 - MIN_GIANT_COMPONENT_SHARE) {
    logSuccess(`giant component holds ≥${MIN_GIANT_COMPONENT_SHARE * 100}% of nodes`);
  } else {
    logProblem(
      `giant component holds ≥${MIN_GIANT_COMPONENT_SHARE * 100}% of nodes`,
      `${r.orphaned.toLocaleString()} nodes (${(r.orphanShare * 100).toFixed(1)}%) are unreachable from it`
    );
  }

  if (r.oneWayViolations) {
    if (r.oneWayViolations.length === 0) logSuccess('every oneWay shortcut is free of reverse edges');
    else logProblem('every oneWay shortcut is free of reverse edges', r.oneWayViolations.join('; '));
  }

  if (r.strongCore !== undefined) {
    if (r.strongCore === r.giant) {
      logSuccess(`weak giant == strongly-connected core (${r.giant.toLocaleString()})`);
    } else {
      logProblem(
        'weak giant == strongly-connected core',
        `giant ${r.giant.toLocaleString()} vs core ${r.strongCore.toLocaleString()} — ` +
          `${(r.giant - r.strongCore).toLocaleString()} node(s) are flagged routable but cannot be entered or left`
      );
    }
  }
}

function report(r: DatasetReport): { problems: string[]; warnings: string[] } {
  const problems: string[] = [];
  const warnings: string[] = [];

  function logSuccess(label: string): void {
    console.log(`  ✓ ${label}`);
  }

  function logProblem(label: string, detail: string): void {
    console.log(`  ✗ ${label} — ${detail}`);
    problems.push(`${basename(r.path)}: ${label}`);
  }

  function logWarning(label: string): void {
    console.log(`  ! ${label}`);
    warnings.push(`${basename(r.path)}: ${label}`);
  }

  console.log(`\n${r.path}  (${mb(r.bytes)})`);
  console.log(`  ${r.nodeCount.toLocaleString()} nodes, ${r.edgeCount.toLocaleString()} directed edges`);

  reportInvariants(r, logSuccess, logProblem);

  console.log(`  · speeds present: ${r.speeds.join(', ')} km/h (heuristic must assume ≥ ${Math.ceil(r.maxNominalSpeed * 1.1)})`);
  console.log(`  · components: ${r.components} — giant ${r.giant.toLocaleString()}, orphaned ${r.orphaned.toLocaleString()}`);
  console.log(`  · one-way edges: ${r.oneWay.toLocaleString()} of ${r.edgeCount.toLocaleString()}`);
  if (r.strongCore !== undefined) {
    console.log(`  · strongly-connected core: ${r.strongCore.toLocaleString()} of ${r.giant.toLocaleString()} in the weak giant`);
  }
  console.log(`  · packed binary would be ~${kb(r.binaryBytes)} (${(r.bytes / r.binaryBytes).toFixed(1)}x smaller)`);

  // One-way edges used to mean "extraction from NODES.DAT lost something"; since the CLEO
  // shortcut layer they are an intended part of the dataset, so their absence is not news.
  if (r.coincident && r.coincident.length > 0) {
    logWarning(
      `${r.coincident.length} world position(s) hold more than one node — findNearestNode breaks the tie by scan order (e.g. ${r.coincident[0]})`
    );
  }
  if (r.namedNodes === 0) logWarning('no node carries a `name` — place search needs a separate POI dataset');

  return { problems, warnings };
}

const targets = files.length ? files : discoverDatasets();
const results = targets.map(analyze);

// With no explicit file arguments, also check the graph the app actually builds.
if (files.length === 0) {
  results.push(analyzeMergedNetwork());
}

if (asJson) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

const allProblems: string[] = [];
const allWarnings: string[] = [];
for (const r of results) {
  const { problems, warnings } = report(r);
  allProblems.push(...problems);
  allWarnings.push(...warnings);
}

console.log('');
if (allWarnings.length) {
  console.log(`${allWarnings.length} warning(s):`);
  for (const w of allWarnings) console.log(`  ! ${w}`);
}
if (allProblems.length) {
  console.log(`\nFAIL — ${allProblems.length} invariant(s) broken:`);
  for (const p of allProblems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log('OK — all invariants hold.');
