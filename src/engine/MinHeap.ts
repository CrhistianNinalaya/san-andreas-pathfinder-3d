/**
 * Generic Binary MinHeap Priority Queue with Stale-Entry Detection
 */

export interface HeapItem<T> {
  node: T;
  priority: number;
  cost: number;
}

export class MinHeap<T> {
  private heap: HeapItem<T>[] = [];

  push(node: T, priority: number, cost = 0): void {
    this.heap.push({ node, priority, cost });
    this._bubbleUp(this.heap.length - 1);
  }

  pop(): HeapItem<T> | null {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    if (!top) return null;

    const bottom = this.heap.pop();
    if (this.heap.length > 0 && bottom !== undefined) {
      this.heap[0] = bottom;
      this._bubbleDown(0);
    }
    return top;
  }

  peek(): HeapItem<T> | null {
    return this.heap[0] ?? null;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  get size(): number {
    return this.heap.length;
  }

  clear(): void {
    this.heap = [];
  }

  private _bubbleUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      const currentItem = this.heap[index];
      const parentItem = this.heap[parent];

      if (currentItem && parentItem && currentItem.priority < parentItem.priority) {
        this.heap[index] = parentItem;
        this.heap[parent] = currentItem;
        index = parent;
      } else {
        break;
      }
    }
  }

  private _bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const left = (index << 1) + 1;
      const right = left + 1;
      let smallest = index;

      const leftItem = this.heap[left];
      const rightItem = this.heap[right];
      const smallestItem = this.heap[smallest];

      if (left < length && leftItem && smallestItem && leftItem.priority < smallestItem.priority) {
        smallest = left;
      }

      const updatedSmallestItem = this.heap[smallest];
      if (right < length && rightItem && updatedSmallestItem && rightItem.priority < updatedSmallestItem.priority) {
        smallest = right;
      }

      if (smallest !== index) {
        const itemAtSmallest = this.heap[smallest];
        const itemAtIndex = this.heap[index];
        if (itemAtSmallest && itemAtIndex) {
          this.heap[index] = itemAtSmallest;
          this.heap[smallest] = itemAtIndex;
        }
        index = smallest;
      } else {
        break;
      }
    }
  }
}
