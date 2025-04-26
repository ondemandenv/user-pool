import {OdmdEdge} from '../OdmdEdge.ts';
import {EdgeOptions} from 'vis-network';
import {NetworkGraph} from '../../NetworkGraph.ts';

export class RepoToBuildEdge extends OdmdEdge {
    constructor(graph: NetworkGraph, from: string, to: string) {
        super(graph, from, to, 'owns');
    }

    getVisualOptions(): EdgeOptions {
        return {
            arrows: 'to',
            color: '#666666',
            font: {
                size: 10,
                align: 'middle',
                background: 'white',
            },
        };
    }
}