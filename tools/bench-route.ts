#!/usr/bin/env node
/**
 * Benchmarks the shipped A* engine on a fixed set of origin/destination pairs.
 * Imports directly from src/engine/RoadGraph.ts.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { RoadGraph } from '../src/engine/RoadGraph';
import type { RawDataset } from '../src/engine/types';

interface OdPair {
  label: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

type BenchResult =
  | { label: string; ok: false; error: string }
  | { label: string; ok: true; medianMs: number; maxMs: number; hops: number; distanceKm: number; timeMin: number };

const OD_PAIRS: OdPair[] = [
  { label: 'Los Santos: Grove St → LS Airport', from: { x: 2500, y: -1670 }, to: { x: 1700, y: -2400 } },
  { label: 'Cross-state: San Fierro → Los Santos', from: { x: -1980, y: 130 }, to: { x: 1480, y: -1720 } },
  { label: 'Cross-state: Las Venturas → San Fierro', from: { x: 2030, y: 1600 }, to: { x: -1980, y: 130 } },
  { label: 'Mountain: Mt Chiliad → Angel Pine', from: { x: -2300, y: -1650 }, to: { x: -2160, y: -2400 } },
  { label: 'Desert: Bone County → Las Venturas', from: { x: 100, y: 1200 }, to: { x: 2030, y: 1600 } },
  { label: 'Short hop: LS downtown', from: { x: 1480, y: -1720 }, to: { x: 1180, y: -1330 } }
];

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const runs = Number(args.find((a) => a.startsWith('--runs='))?.slice(7) ?? 5);
const dataPath =
  args.find((a) => a.startsWith('--data='))?.slice(7) ?? 'public/data/official/san_andreas_official_nodes.json';
const patchesPath =
  args.find((a) => a.startsWith('--patches='))?.slice(10) ?? 'public/data/custom/custom_network.json';
const shortcutsPath =
  args.find((a) => a.startsWith('--shortcuts='))?.slice(12) ?? 'public/data/custom/shortcuts';

const parseStart = performance.now();
const data: RawDataset = JSON.parse(readFileSync(dataPath, 'utf8'));
let customData: import('../src/engine/types').CustomNetworkDataset | undefined;
try {
  const mergedNodes: import('../src/engine/types').CustomNode[] = [];
  const mergedEdges: import('../src/engine/types').CustomEdge[] = [];

  // Layer 2: Official patches
  if (existsSync(patchesPath)) {
    const patches = JSON.parse(readFileSync(patchesPath, 'utf8')) as {
      nodes?: import('../src/engine/types').CustomNode[];
      edges?: import('../src/engine/types').CustomEdge[];
    };
    if (patches.nodes) mergedNodes.push(...patches.nodes);
    if (patches.edges) mergedEdges.push(...patches.edges);
  }

  // Layer 3: Curated shortcuts
  if (existsSync(shortcutsPath)) {
    const manifestFile = path.join(shortcutsPath, 'manifest.json');
    if (existsSync(manifestFile)) {
      const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as {
        files?: string[];
      };
      for (const rel of manifest.files ?? []) {
        const itemPath = path.join(shortcutsPath, rel);
        if (existsSync(itemPath)) {
          const item = JSON.parse(readFileSync(itemPath, 'utf8')) as {
            id?: number | string;
            color?: string;
            description?: string;
            nodes?: import('../src/engine/types').CustomNode[];
            edges?: import('../src/engine/types').CustomEdge[];
          };
          const parentColor = item.color;
          const parentDesc = item.description;
          if (item.nodes) {
            for (const n of item.nodes) {
              mergedNodes.push({
                ...n,
                isCustom: n.isCustom ?? true,
                customType: 'shortcut',
                color: n.color ?? parentColor
              });
            }
          }
          if (item.edges) {
            for (const e of item.edges) {
              mergedEdges.push({
                ...e,
                speed: e.speed ?? 70,
                type: 'shortcut',
                color: e.color ?? parentColor,
                description: e.description ?? parentDesc
              });
            }
          }
        }
      }
    }
  }

  if (mergedNodes.length > 0 || mergedEdges.length > 0) {
    customData = {
      version: '1.0.0',
      description: 'Combined official patches and curated shortcuts',
      nodes: mergedNodes,
      edges: mergedEdges
    };
  }
} catch {
  // custom network is optional
}
const parseMs = performance.now() - parseStart;

const buildStart = performance.now();
const graph = new RoadGraph(data, customData);
const buildMs = performance.now() - buildStart;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

const results: BenchResult[] = OD_PAIRS.map(({ label, from, to }) => {
  const a = graph.findNearestNode({ x: from.x, y: from.y }).node;
  const b = graph.findNearestNode({ x: to.x, y: to.y }).node;
  const samples: number[] = [];
  let route = null;

  if (!a || !b) {
    return { label, ok: false, error: 'nearest node not found' };
  }

  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    route = graph.findShortestPath({ startId: a.id, goalId: b.id });
    samples.push(performance.now() - t0);
  }

  if (!route) {
    return { label, ok: false, error: 'no route found' };
  }

  const med = median(samples);
  const max = Math.max(...samples);
  const km = (route.totalDistance / 1000).toFixed(1);
  const min = (route.totalTimeSeconds / 60).toFixed(1);

  return {
    label,
    ok: true,
    medianMs: Number(med.toFixed(1)),
    maxMs: Number(max.toFixed(1)),
    hops: route.path.length,
    distanceKm: Number(km),
    timeMin: Number(min)
  };
});

if (asJson) {
  console.log(JSON.stringify({ dataset: dataPath, parseMs: Number(parseMs.toFixed(1)), buildMs: Number(buildMs.toFixed(1)), results }, null, 2));
} else {
  console.log(`\ndataset  ${dataPath}`);
  console.log(`parse    ${parseMs.toFixed(0)} ms   (TypeScript typed data)`);
  console.log(`build    ${buildMs.toFixed(0)} ms   (${graph.nodes.size.toLocaleString()} nodes)\n`);

  console.log(`${'route'.padEnd(42)} ${'median'.padStart(8)} ${'max'.padStart(8)} ${'hops'.padStart(6)} ${'km'.padStart(8)} ${'min'.padStart(8)}`);
  console.log('-'.repeat(82));

  for (const r of results) {
    if (!r.ok) {
      console.log(`${r.label.padEnd(42)} FAIL: ${r.error}`);
      continue;
    }
    console.log(
      `${r.label.padEnd(42)} ${`${r.medianMs}ms`.padStart(8)} ${`${r.maxMs}ms`.padStart(8)} ${String(r.hops).padStart(6)} ${String(r.distanceKm).padStart(8)} ${String(r.timeMin).padStart(8)}`
    );
  }

  const okResults = results.filter((r): r is Extract<BenchResult, { ok: true }> => r.ok);
  const slowest = okResults.length > 0 ? Math.max(...okResults.map((r) => r.medianMs)) : 0;
  console.log(`\nAll ${results.length} pairs routed. Slowest median: ${slowest} ms.\n`);
}
