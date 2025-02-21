import {OdmdEdge} from '../OdmdEdge.ts';
import {EdgeOptions} from 'vis-network';
import {NetworkGraph} from "../../NetworkGraph.ts";

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

    readonly graph: NetworkGraph

    constructor( graph:NetworkGraph, from: string, to: string) {
        super(from, to, `consumes`);
        this.graph = graph;
    }

    update() {
        this.label = `Consuming ${this.consumingVersion}`;
        this.graph.visEdges.update( this.getEdgeData())
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
}