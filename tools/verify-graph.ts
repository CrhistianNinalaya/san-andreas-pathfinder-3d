#!/usr/bin/env node
/**
 * Dataset integrity + connectivity checker for the San Andreas road graph.
 *
 * Usage:
 *   tsx tools/verify-graph.ts                       # checks every public/data/official/*.json
 *   tsx tools/verify-graph.ts public/data/foo.json  # checks one file
 *   tsx tools/verify-graph.ts --json                # machine-readable output
 *
 * Exit code is 1 if any INVARIANT fails, 0 otherwise. WARN lines never fail the run.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
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

/** Union-find over node indices; the graph is reciprocal so weak == strong components. */
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

function analyze(path: string): DatasetReport {
  const bytes = statSync(path).size;
  const data: RawDataset = JSON.parse(readFileSync(path, 'utf8'));
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
  console.log(`  · packed binary would be ~${kb(r.binaryBytes)} (${(r.bytes / r.binaryBytes).toFixed(1)}x smaller)`);

  if (r.oneWay === 0) logWarning('graph is fully reciprocal — no one-way roads survived extraction from NODES.DAT');
  if (r.namedNodes === 0) logWarning('no node carries a `name` — place search needs a separate POI dataset');

  return { problems, warnings };
}

const targets = files.length ? files : discoverDatasets();
const results = targets.map(analyze);

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
