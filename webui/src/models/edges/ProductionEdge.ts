import { OdmdEdge } from '../OdmdEdge.ts';
import { EdgeOptions } from 'vis-network';
import { NetworkGraph } from '../../NetworkGraph.ts';

export class ProductionEdge extends OdmdEdge {
  constructor(graph: NetworkGraph, from: string, to: string) {
    super(graph, from, to, 'produces');
  }

  getVisualOptions(): EdgeOptions {
    return {
      arrows: 'to',
      color: '#00aa00',
      font: {
        size: 10,
        align: 'middle',
        background: 'white',
      },
    };
  }
} 