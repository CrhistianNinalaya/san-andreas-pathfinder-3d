#!/usr/bin/env node
/**
 * Benchmarks the shipped A* engine on a fixed set of origin/destination pairs.
 *
 * It evaluates js/elevation-cost.js and js/pathfinder.js as-is inside a VM context,
 * so it measures the real code rather than a copy that can drift. When those files
 * move to src/ during the TypeScript migration, update ENGINE_FILES below.
 *
 * Usage:
 *   node tools/bench-route.mjs                    # default dataset, 5 runs per pair
 *   node tools/bench-route.mjs --runs=20
 *   node tools/bench-route.mjs --data=data/san_fierro_official_nodes.json
 *   node tools/bench-route.mjs --json             # machine-readable, for regression tracking
 */

import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { performance } from 'node:perf_hooks';

const ENGINE_FILES = ['js/elevation-cost.js', 'js/pathfinder.js'];

/**
 * Fixed world coordinates, not node ids: ids are extraction-order dependent and
 * change whenever the dataset is regenerated, coordinates do not.
 */
const OD_PAIRS = [
  ['Los Santos: Grove St → LS Airport', { x: 2500, y: -1670 }, { x: 1700, y: -2400 }],
  ['Cross-state: San Fierro → Los Santos', { x: -1980, y: 130 }, { x: 1480, y: -1720 }],
  ['Cross-state: Las Venturas → San Fierro', { x: 2030, y: 1600 }, { x: -1980, y: 130 }],
  ['Mountain: Mt Chiliad → Angel Pine', { x: -2300, y: -1650 }, { x: -2160, y: -2400 }],
  ['Desert: Bone County → Las Venturas', { x: 100, y: 1200 }, { x: 2030, y: 1600 }],
  ['Short hop: LS downtown', { x: 1480, y: -1720 }, { x: 1180, y: -1330 }],
];

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const runs = Number(args.find((a) => a.startsWith('--runs='))?.slice(7) ?? 5);
const dataPath =
  args.find((a) => a.startsWith('--data='))?.slice(7) ?? 'data/san_andreas_official_nodes.json';

const sandbox = createContext({ console, performance, Math, Map, Set, Infinity, String, Number });
for (const file of ENGINE_FILES) {
  runInContext(readFileSync(file, 'utf8'), sandbox, { filename: file });
}

const parseStart = performance.now();
const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const parseMs = performance.now() - parseStart;

const buildStart = performance.now();
const graph = runInContext('(d) => new RoadGraph(d)', sandbox)(data);
const buildMs = performance.now() - buildStart;

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const results = OD_PAIRS.map(([label, from, to]) => {
  const a = graph.findNearestNode(from.x, from.y).node;
  const b = graph.findNearestNode(to.x, to.y).node;
  const samples = [];
  let route = null;
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    route = graph.findShortestPath(a.id, b.id);
    samples.push(performance.now() - t);
  }
  return {
    label,
    found: Boolean(route),
    hops: route?.path.length ?? 0,
    km: route ? route.totalDistance / 1000 : 0,
    minutes: route ? route.totalTimeSeconds / 60 : 0,
    medianMs: median(samples),
    maxMs: Math.max(...samples),
  };
});

if (asJson) {
  console.log(JSON.stringify({ dataPath, parseMs, buildMs, runs, results }, null, 2));
  process.exit(results.every((r) => r.found) ? 0 : 1);
}

console.log(`\ndataset  ${dataPath}`);
console.log(`parse    ${parseMs.toFixed(0)} ms   (blocks the main thread today — see SPEC.md phase 2)`);
console.log(`build    ${buildMs.toFixed(0)} ms   (${graph.nodes.size.toLocaleString()} nodes)`);
console.log(`\n${'route'.padEnd(40)} ${'median'.padStart(9)} ${'max'.padStart(8)} ${'hops'.padStart(6)} ${'km'.padStart(8)} ${'min'.padStart(7)}`);
console.log('-'.repeat(82));

for (const r of results) {
  if (!r.found) {
    console.log(`${r.label.padEnd(40)} ${'NO ROUTE'.padStart(9)}`);
    continue;
  }
  console.log(
    `${r.label.padEnd(40)} ${`${r.medianMs.toFixed(1)}ms`.padStart(9)} ${`${r.maxMs.toFixed(1)}ms`.padStart(8)} ` +
      `${String(r.hops).padStart(6)} ${r.km.toFixed(1).padStart(8)} ${r.minutes.toFixed(1).padStart(7)}`
  );
}

const failed = results.filter((r) => !r.found);
console.log('');
if (failed.length) {
  console.log(`${failed.length} pair(s) returned no route — likely snapped into an orphaned component.`);
  console.log('Run `node tools/verify-graph.mjs` to see component sizes.');
  process.exit(1);
}
console.log(`All ${results.length} pairs routed. Slowest median: ${Math.max(...results.map((r) => r.medianMs)).toFixed(1)} ms.`);
