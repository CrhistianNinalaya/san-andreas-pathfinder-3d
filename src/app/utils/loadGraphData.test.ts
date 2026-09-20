import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchShortcutDocs, loadFullRoadGraph } from './loadGraphData';

describe('loadGraphData', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('handles empty or missing shortcut manifest gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false
    } as Response);

    const shortcuts = await fetchShortcutDocs();
    expect(shortcuts).toEqual([]);
  });

  it('loads full road graph successfully when layers respond', async () => {
    const mockOfficial = {
      nodes: [{ id: 1, x: 0, y: 0, z: 0 }],
      edges: []
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('san_andreas_official_nodes.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOfficial)
        } as Response);
      }
      return Promise.resolve({
        ok: false
      } as Response);
    });

    const graph = await loadFullRoadGraph();
    expect(graph).toBeDefined();
    expect(graph.nodes.size).toBe(1);
  });
});
