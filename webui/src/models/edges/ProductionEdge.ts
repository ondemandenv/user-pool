import { OdmdEdge } from '../OdmdEdge.ts';
import { EdgeOptions } from 'vis-network';

export class ProductionEdge extends OdmdEdge {
  constructor(from: string, to: string) {
    super(from, to, 'produces');
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