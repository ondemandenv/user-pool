import {OdmdEdge} from '../OdmdEdge.ts';
import {EdgeOptions} from 'vis-network';

export class RepoToBuildEdge extends OdmdEdge {
    constructor(from: string, to: string) {
        super(from, to, 'owns');
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