import {Network} from 'vis-network';
import {DataSet} from 'vis-data';
import {OdmdNode} from './models/OdmdNode.ts';
import {OdmdEdge} from './models/OdmdEdge.ts';
import {Entity} from "./gql/types.ts";
import {BuildNode} from "./models/nodes/BuildNode.ts";
import {RepoNode} from "./models/nodes/RepoNode.ts";
import {WbskGraphQLClient} from "./gql/WbskGraphQLClient.ts";
import {ParamService} from "./ssm/ParamService.ts";
import {ProductNode} from "./models/nodes/ProductNode.ts";
import {TooltipWindow} from "./models/TooltipWindow.ts";

export class NetworkGraph {
    private container: HTMLElement;
    readonly network!: Network;
    readonly visNodes: DataSet<any>;
    readonly visEdges: DataSet<any>;
    readonly odmdNodes: Map<string, OdmdNode<any>>;
    readonly odmdEdges: Map<string, OdmdEdge>;
    private repoToBuild: Map<string, BuildNode[]> | undefined
    private buildNodes: BuildNode[] = []

    constructor(containerId: string) {
        this.container = document.getElementById(containerId)!;
        
        // Make the container and all its child elements non-selectable
        this.container.style.userSelect = 'none';
        (this.container.style as any)['-webkit-user-select'] = 'none';
        (this.container.style as any)['-ms-user-select'] = 'none';
        (this.container.style as any)['-moz-user-select'] = 'none';
        
        this.visNodes = new DataSet<any>();
        this.visEdges = new DataSet<any>();
        this.odmdNodes = new Map<string, OdmdNode<any>>();
        this.odmdEdges = new Map<string, OdmdEdge>();

        const options = {
            edges: {
                length: 200,
            },
            interaction: {
                hover: true,
            },
        };

        this.network = new Network(
            this.container,
            {nodes: this.visNodes, edges: this.visEdges},
            options
        );
        
        // Apply non-selectable styling to network canvas
        const canvasElement = this.container.querySelector('canvas');
        if (canvasElement) {
            (canvasElement as HTMLCanvasElement).style.userSelect = 'none';
            ((canvasElement as HTMLCanvasElement).style as any)['-webkit-user-select'] = 'none';
            ((canvasElement as HTMLCanvasElement).style as any)['-ms-user-select'] = 'none';
            ((canvasElement as HTMLCanvasElement).style as any)['-moz-user-select'] = 'none';
        }

        let activeNode: OdmdNode<any> | null = null;
        let activeEdge: OdmdEdge | null = null;

        this.network.on('hoverNode', (params) => {
            const node = this.getNodeById(params.node);
            if (node) {
                const pointer = params.pointer;
                const canvas = this.container.getElementsByTagName('canvas')[0];
                const boundingRect = canvas.getBoundingClientRect();

                const x = boundingRect.left + pointer.DOM.x;
                const y = boundingRect.top + pointer.DOM.y;

                node.showTooltip(x, y);
                activeNode = node;
            }
        });

        this.network.on('blurNode', () => {
            setTimeout(() => {
                TooltipWindow.hideAllTooltips();
                activeNode = null;
            }, 100);
        });

        this.network.on('hoverEdge', (params) => {
            const edge = this.getEdgeById(params.edge);
            if (edge) {
                const pointer = params.pointer;
                const canvas = this.container.getElementsByTagName('canvas')[0];
                const boundingRect = canvas.getBoundingClientRect();

                const x = boundingRect.left + pointer.DOM.x;
                const y = boundingRect.top + pointer.DOM.y;

                edge.showTooltip(x, y);
                activeEdge = edge;
            }
        });

        this.network.on('blurEdge', () => {
            setTimeout(() => {
                TooltipWindow.hideAllTooltips();
                activeEdge = null;
            }, 100);
        });

        // Add double click event listener here, after network is set
        this.network.on('doubleClick', (event) => {
            if (event.nodes.length > 0) {
                const nodeId = event.nodes[0];
                this.odmdNodes.get(nodeId)?.togglePhysicsLock()
            }
        });

        // Add dragEnd event listener here
        this.network.on('dragEnd', (event) => {
            if (event.nodes.length > 0) {
                const nodeId = event.nodes[0];
                this.odmdNodes.get(nodeId)?.togglePhysicsLock(false);
            }
        });
    }

    private getNodeById(id: string): OdmdNode<any> | null {
        return this.odmdNodes.get(id) || null;
    }

    private getEdgeById(id: string): OdmdEdge | null {
        return this.odmdEdges.get(id) || null;
    }

    public addNode(node: OdmdNode<any>) {
        if (!this.visNodes.get(node.entity.id)) {
            this.visNodes.add(node.getNodeData());
        }
        this.odmdNodes.set(node.entity.id, node);
    }

    public addEdge(edge: OdmdEdge) {
        if (!this.visEdges.get(edge.id)) {
            let edgeData = edge.getEdgeData();
            this.visEdges.add(edgeData);
            this.odmdEdges.set(edge.id, edge);
            return edge;
        }
        return null;
    }

    public cleanup() {
        this.odmdNodes.forEach(node => node.cleanup());
        this.visNodes.clear();
        this.visEdges.clear();
        this.odmdNodes.clear();
        this.odmdEdges.clear();
    }

    public async renderBuilds(buildEntities: Entity[]) {
        const newBuildIds = buildEntities.map(entity => entity.id);

        const toRemove = [] as string[];
        this.odmdNodes.forEach(n => {
            if (n instanceof RepoNode) {
                if (!n.buildNodes.find(bn => newBuildIds.includes(bn.entity.id))) {
                    toRemove.push(n.entity.id)
                }
            } else {
                if (!newBuildIds.includes(n.entity.id.split('/')[0])) {
                    toRemove.push(n.entity.id)
                }
            }
        })

        toRemove.forEach(entityId => {
            this.removeNodeById(entityId);
        })
        buildEntities.forEach(be => {
            if (this.buildNodes.find(bn => bn.entity.id === be.id)) {
                console.log(`renderBuilds found existing entity with id ${be.id}`)
            } else {
                console.log(`renderBuilds add new entity with id ${be.id}`)
                this.buildNodes.push(new BuildNode(be, this))
            }
        })

        this.repoToBuild = this.buildNodes.reduce((p, v) => {
            if (!p.has(v.repo)) {
                p.set(v.repo, [])
            }
            p.get(v.repo)!.push(v);
            return p;
        }, new Map<string, BuildNode[]>());

        let repoIdx = 0;
        const repoDi = (2 * Math.PI) / this.repoToBuild.size;
        this.repoToBuild.forEach((v, k) => {
            if (this.odmdNodes.has(k)) {
                this.removeNodeById(k)
            }

            const repoNode = new RepoNode({id: k, class: 'REPOSITORY'} as Entity, this, v);
            this.addNode(repoNode)
            this.distributeNode(repoNode.entity.id, repoDi * repoIdx, 30, true)

            const bStart = repoDi * repoIdx - repoDi / 2
            const buildDi = repoDi / (repoNode.buildNodes.length + 1)
            repoNode.buildNodes.forEach((bn, bIdx) => {
                this.distributeNode(bn.entity.id, bStart + buildDi * (bIdx + 1), 200, true)

                const eStart = bStart + buildDi * bIdx - repoDi / 2
                const enverDi = repoDi / (repoNode.buildNodes.length + 1)
                Array.from(bn.entityIdToEnverNode.values()).forEach((en, eIdx) => {
                    this.distributeNode(en.entity.id, eStart + enverDi * (eIdx + 1), 300, false)
                })
            })
            repoIdx++
        })

        const userInfo = localStorage.getItem('user_info');
        if (userInfo) {
            if (!ParamService.getInstance()) {
                new ParamService()
            }
            await WbskGraphQLClient.inst.connect()
            this.odmdNodes.forEach(n => {
                if (!(n instanceof ProductNode)) n.subscribe()
            })
        }
    }

    removeNodeById(entityId: string) {
        this.odmdNodes.get(entityId)!.cleanup()

        const removedEdges = this.visEdges.get({filter: (e) => e.from == entityId || e.to == entityId})
        for (const edge of removedEdges) {
            this.odmdEdges.delete(edge.id);
            this.visEdges.remove(edge);
        }
        
        const removedNodes = this.visNodes.remove(entityId)
        this.odmdNodes.delete(entityId)
        for( let i = 0; i < this.buildNodes.length; i++ ) {
            if( this.buildNodes[i].entity.id === entityId ) {
                this.buildNodes.splice(i, 1)
            }
        }
    }

    private distributeNode(nodeId: string, angle: number, margin: number, isFxd: boolean) {
        const canvasWidth = this.container.clientWidth;
        const canvasHeight = this.container.clientHeight;

        // Elliptical distribution
        const x = (canvasWidth / 2 - margin) * Math.cos(angle)// + canvasWidth / 2;
        const y = (canvasHeight / 2 - margin) * Math.sin(angle)// + canvasHeight / 2;

        try {
            this.network.updateClusteredNode(nodeId, {
                x: x,
                y: y,
                physics: !isFxd,
                // fixed: !isFxd
            });
        } catch (e) {
            console.log(e)
        }
    }
}