import { describe, it, expect } from 'vitest';
import { MinHeap } from './MinHeap';

describe('MinHeap', () => {
  it('should extract elements in ascending priority order', () => {
    const heap = new MinHeap<string>();
    heap.push('c', 30);
    heap.push('a', 10);
    heap.push('b', 20);

    expect(heap.pop()?.node).toBe('a');
    expect(heap.pop()?.node).toBe('b');
    expect(heap.pop()?.node).toBe('c');
    expect(heap.pop()).toBeNull();
  });

  it('should correctly report empty and size', () => {
    const heap = new MinHeap<number>();
    expect(heap.isEmpty()).toBe(true);
    expect(heap.size).toBe(0);

    heap.push(100, 5);
    expect(heap.isEmpty()).toBe(false);
    expect(heap.size).toBe(1);

    heap.pop();
    expect(heap.isEmpty()).toBe(true);
  });

  it('should preserve cost metadata for stale-entry checks', () => {
    const heap = new MinHeap<string>();
    heap.push('node_1', 15.5, 8.2);

    const popped = heap.pop();
    expect(popped?.node).toBe('node_1');
    expect(popped?.priority).toBe(15.5);
    expect(popped?.cost).toBe(8.2);
  });
});
