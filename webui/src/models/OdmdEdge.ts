import { EdgeOptions } from 'vis-network';

export abstract class OdmdEdge {
  id: string;
  from: string;
  to: string;
  label: string;

  constructor(from: string, to: string, label: string) {
    this.id = `${from} -> ${to}`;
    this.from = from;
    this.to = to;
    this.label = label;
  }

  abstract getVisualOptions(): EdgeOptions;

  getEdgeData() {
    return {
      id: this.id,
      from: this.from,
      to: this.to,
      label: this.label,
      ...this.getVisualOptions(),
    };
  }
} 