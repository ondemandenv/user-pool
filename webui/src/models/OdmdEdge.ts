import { EdgeOptions } from 'vis-network';
import { TooltipWindow } from './TooltipWindow';
import { TooltipOptions } from './Tooltip';
import { NetworkGraph } from '../NetworkGraph';

export abstract class OdmdEdge extends TooltipWindow {
  id: string;
  from: string;
  to: string;
  label: string;
  protected graph: NetworkGraph;

  constructor(graph: NetworkGraph, from: string, to: string, label: string) {
    super();
    this.id = `${from} -> ${to}`;
    this.from = from;
    this.to = to;
    this.label = label;
    this.graph = graph;
  }

  abstract getVisualOptions(): EdgeOptions;
  
  // Default implementation that can be overridden by subclasses
  getTooltipOptions(): TooltipOptions {
    return {
      content: `<div>
        <strong>${this.label}</strong><br>
        From: ${this.from}<br>
        To: ${this.to}
      </div>`,
      showDelay: 300,
      hideDelay: 500
    };
  }

  // This method is called when tooltip is clicked
  protected onTooltipClick(x: number, y: number): void {
    // Default behavior - can be overridden by subclasses
    // For example, they could show a details panel or menu
    console.log(`Edge ${this.id} clicked at position ${x},${y}`);
  }

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