/**
 * Motor de Navegación A* Optimizado con MinHeap y Spatial Index
 * para grafos masivos (+30,000 nodos)
 */

class MinHeap {
  constructor() {
    this.heap = [];
  }
  push(node, priority) {
    this.heap.push({ node, priority });
    this._bubbleUp(this.heap.length - 1);
  }
  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._bubbleDown(0);
    }
    return top.node;
  }
  isEmpty() {
    return this.heap.length === 0;
  }
  _bubbleUp(index) {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.heap[index].priority < this.heap[parent].priority) {
        [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
        index = parent;
      } else break;
    }
  }
  _bubbleDown(index) {
    const length = this.heap.length;
    while (true) {
      let left = (index << 1) + 1;
      let right = left + 1;
      let smallest = index;

      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest !== index) {
        [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
        index = smallest;
      } else break;
    }
  }
}

class RoadGraph {
  constructor(data) {
    this.nodes = new Map();
    this.adjacencyList = new Map();
    this.grid = new Map(); // Spatial Hash Index (celdas de 200x200m)
    this.cellSize = 200;
    this.init(data);
  }

  _cellKey(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  init(data) {
    // 1. Guardar Nodos y construir Spatial Hash
    for (const node of data.nodes) {
      const nodeObj = {
        id: String(node.id),
        name: node.name || `Nodo ${node.id}`,
        x: node.x,
        y: node.y,
        z: node.z || 0
      };
      this.nodes.set(nodeObj.id, nodeObj);
      this.adjacencyList.set(nodeObj.id, []);

      const ckey = this._cellKey(node.x, node.y);
      if (!this.grid.has(ckey)) this.grid.set(ckey, []);
      this.grid.get(ckey).push(nodeObj);
    }

    // 2. Guardar Aristas
    for (const edge of data.edges) {
      const fromId = String(edge.from);
      const toId = String(edge.to);

      const n1 = this.nodes.get(fromId);
      const n2 = this.nodes.get(toId);
      if (!n1 || !n2) continue;

      const distance = Math.hypot(n1.x - n2.x, n1.y - n2.y);
      const speed = edge.speed || 80;
      const speedMps = (speed * 1000) / 3600;
      const baseTimeSeconds = distance / speedMps;

      this.adjacencyList.get(fromId).push({
        to: toId,
        distance,
        speed,
        baseTimeSeconds
      });

      // Si no es dirigida, agregar vuelta
      if (edge.bidirectional) {
        this.adjacencyList.get(toId).push({
          to: fromId,
          distance,
          speed,
          baseTimeSeconds
        });
      }
    }
  }

  // Búsqueda espacial ultrarrápida O(1) usando Spatial Hash
  findNearestNode(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    let nearest = null;
    let minDist = Infinity;

    // Buscar en la celda y celdas vecinas (radio expandible)
    for (let r = 0; r <= 3; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const key = `${cx + dx},${cy + dy}`;
          const cellNodes = this.grid.get(key);
          if (cellNodes) {
            for (const node of cellNodes) {
              const d = Math.hypot(node.x - x, node.y - y);
              if (d < minDist) {
                minDist = d;
                nearest = node;
              }
            }
          }
        }
      }
      if (nearest && minDist <= (r + 1) * this.cellSize) break;
    }

    // Fallback lineal si el clic fue en mar abierto o fuera del mapa
    if (!nearest) {
      for (const node of this.nodes.values()) {
        const d = Math.hypot(node.x - x, node.y - y);
        if (d < minDist) {
          minDist = d;
          nearest = node;
        }
      }
    }

    return { node: nearest, distance: minDist };
  }

  heuristic(nodeA, nodeB) {
    const maxSpeedMps = (120 * 1000) / 3600;
    const distance = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
    return distance / maxSpeedMps;
  }

  findShortestPath(startId, goalId, edgePenalties = new Map()) {
    startId = String(startId);
    goalId = String(goalId);

    if (!this.nodes.has(startId) || !this.nodes.has(goalId)) return null;
    if (startId === goalId) {
      return {
        path: [this.nodes.get(startId)],
        nodeIds: [startId],
        totalDistance: 0,
        totalTimeSeconds: 0,
        usedEdges: []
      };
    }

    const goalNode = this.nodes.get(goalId);
    const frontier = new MinHeap();
    frontier.push(startId, 0);

    const cameFrom = new Map();
    const costSoFar = new Map();
    const edgeUsed = new Map();

    cameFrom.set(startId, null);
    costSoFar.set(startId, 0);

    while (!frontier.isEmpty()) {
      const currentId = frontier.pop();
      if (currentId === goalId) break;

      const currentNode = this.nodes.get(currentId);
      const neighbors = this.adjacencyList.get(currentId) || [];

      for (const edge of neighbors) {
        const nextId = edge.to;
        const nextNode = this.nodes.get(nextId);
        if (!nextNode) continue;

        const edgeKey = `${currentId}->${nextId}`;
        const penalty = edgePenalties.get(edgeKey) || 1.0;
        const edgeCost = edge.baseTimeSeconds * penalty;
        const newCost = costSoFar.get(currentId) + edgeCost;

        if (!costSoFar.has(nextId) || newCost < costSoFar.get(nextId)) {
          costSoFar.set(nextId, newCost);
          const priority = newCost + this.heuristic(nextNode, goalNode);
          frontier.push(nextId, priority);
          cameFrom.set(nextId, currentId);
          edgeUsed.set(nextId, edge);
        }
      }
    }

    if (!cameFrom.has(goalId)) return null;

    const path = [];
    const nodeIds = [];
    const usedEdges = [];
    let curr = goalId;
    let totalDistance = 0;
    let totalTimeSeconds = 0;

    while (curr !== null) {
      nodeIds.unshift(curr);
      path.unshift(this.nodes.get(curr));
      const prev = cameFrom.get(curr);
      if (prev) {
        const edge = edgeUsed.get(curr);
        if (edge) {
          usedEdges.unshift(edge);
          totalDistance += edge.distance;
          totalTimeSeconds += edge.baseTimeSeconds;
        }
      }
      curr = prev;
    }

    return {
      path,
      nodeIds,
      totalDistance: Math.round(totalDistance),
      totalTimeSeconds: Math.round(totalTimeSeconds),
      usedEdges
    };
  }

  findRoutesWithAlternatives(startId, goalId, maxRoutes = 3) {
    const results = [];
    const edgePenalties = new Map();

    for (let i = 0; i < maxRoutes; i++) {
      const result = this.findShortestPath(startId, goalId, edgePenalties);
      if (!result) break;

      const pathSignature = result.nodeIds.join('>');
      if (!results.some(r => r.nodeIds.join('>') === pathSignature)) {
        results.push({
          ...result,
          index: i + 1,
          isOptimal: i === 0,
          label: i === 0 ? 'Ruta más rápida' : `Ruta alternativa ${i}`
        });
      }

      // Penalizar las aristas para forzar a A* a buscar rutas viales alternas
      for (let j = 0; j < result.nodeIds.length - 1; j++) {
        const u = result.nodeIds[j];
        const v = result.nodeIds[j + 1];
        const edgeKey = `${u}->${v}`;
        const currentPenalty = edgePenalties.get(edgeKey) || 1.0;
        edgePenalties.set(edgeKey, currentPenalty * 3.5);
      }
    }

    return results;
  }
}
