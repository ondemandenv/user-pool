import {OdmdEdge} from '../OdmdEdge.ts';
import {EdgeOptions} from 'vis-network';
import {NetworkGraph} from "../../NetworkGraph.ts";
import {TooltipOptions} from "../Tooltip.ts";

export class ConsumptionEdge extends OdmdEdge {
    private _productVersion: number = -1;
    get productVersion(): number {
        return this._productVersion;
    }

    set productVersion(value: number) {
        this._productVersion = value;
        this.update()
    }

    private _consumingVersion: number = -1;
    get consumingVersion(): number {
        return this._consumingVersion;
    }

    set consumingVersion(value: number) {
        this._consumingVersion = value;
        this.update()
    }

    constructor(graph: NetworkGraph, from: string, to: string) {
        super(graph, from, to, `consumes`);
    }

    update() {
        this.label = `Consuming ${this.consumingVersion}`;
        this.graph.visEdges.update(this.getEdgeData());
    }

    getVisualOptions(): EdgeOptions {
        const isOutdated = this._consumingVersion < this._productVersion;

        return {
            arrows: 'to',
            color: isOutdated ? '#ff9900' : '#aa0000',
            dashes: isOutdated,
            font: {
                size: 10,
                align: 'middle',
                background: 'white',
                color: isOutdated ? '#ff9900' : '#aa0000',
            },
        };
    }

    override getTooltipOptions(): TooltipOptions {
        const isOutdated = this._consumingVersion < this._productVersion;
        const statusText = isOutdated 
            ? `<span style="color: #ff9900; font-weight: bold">⚠️ Outdated</span>` 
            : `<span style="color: #006600; font-weight: bold">✓ Up to date</span>`;
        
        return {
            content: `<div style="padding: 5px">
                <strong>Consumption Relationship</strong><br>
                <hr style="margin: 5px 0">
                Consumer: <strong>${this.from}</strong><br>
                Product: <strong>${this.to}</strong><br>
                <hr style="margin: 5px 0">
                Product Version: <strong>${this._productVersion}</strong><br>
                Consuming Version: <strong>${this._consumingVersion}</strong><br>
                Status: ${statusText}
            </div>`,
            showDelay: 300,
            hideDelay: 500,
            style: {
                minWidth: '200px',
                border: `2px solid ${isOutdated ? '#ff9900' : '#aa0000'}`,
                borderRadius: '6px'
            }
        };
    }
}