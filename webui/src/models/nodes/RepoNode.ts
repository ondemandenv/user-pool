import {OdmdNode, MenuOptions} from '../OdmdNode.ts';
import {NodeOptions} from 'vis-network';
import {BuildNode} from './BuildNode.ts';
import {Entity} from "../../gql/types.ts";
import {RepoToBuildEdge} from "../edges/RepoToBuildEdge.ts";
import {NetworkGraph} from "../../NetworkGraph.ts";
import {TooltipOptions} from "../Tooltip.ts";
import {RepoWindow} from "../windows/RepoWindow.ts";

export class RepoNode extends OdmdNode<RepoWindow> {

    createFloatingWindow(): RepoWindow {
        return new RepoWindow(this)
    }

    constructor(entity: Entity, networkManager: NetworkGraph, buildNodes: BuildNode[]) {
        super(entity, networkManager);
        this.buildNodes = buildNodes;
        this.buildNodes.forEach(bn => {
            this.addChildNode(bn);
            this.addEdge(new RepoToBuildEdge(this.entity.id, bn.entity.id));
        });
    }

    readonly buildNodes: BuildNode[] = [];

    getVisualOptions(): NodeOptions {
        return {
            shape: 'diamond',
            color: {
                background: '#ff9999',
                border: '#ff0000',
            },
            size: 16,
            font: {
                size: 12,
            },
        };
    }

    getTooltipOptions(): TooltipOptions {
        return {
            content: `
        <div>
          <strong>${this.entity.id}</strong><br>
          Envers: ${this.entity.content}
        </div>
      `,
            style: {
                maxWidth: '200px',
            }
        };
    }

    getMenuOptions(): MenuOptions {
        return {
            items: [
                {
                    icon: 'source',
                    label: 'View Source',
                    action: () => {
                        console.log('View source for:', this.entity.id);
                    }
                },
                {
                    icon: 'build',
                    label: 'Build Jobs',
                    action: () => {
                        console.log('Build jobs for:', this.entity.id);
                    }
                },
                {
                    icon: 'history',
                    label: 'View History',
                    action: () => {
                        console.log('View history for:', this.entity.id);
                    }
                }
            ]
        };
    }


    onReady(): void {
        console.log(this.entity.id + ' >> Ready!');
    }

    onData(change: { operation: 'Delete' | 'Update' | 'Create'; name: string; type: string; }): void {
        throw new Error('Method not implemented.');
    }

} 