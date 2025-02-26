import {OdmdNode, MenuOptions} from '../OdmdNode.ts';
import {NodeOptions} from 'vis-network';
import {ProductNode} from './ProductNode.ts';
import {Consuming, Entity} from "../../gql/types.ts";
import {ProductionEdge} from "../edges/ProductionEdge.ts";
import {ConsumptionEdge} from "../edges/ConsumptionEdge.ts";
import {TooltipOptions} from "../Tooltip.ts";
import {EnverWindow} from "../windows/EnverWindow.ts";
import {ParamService} from "../../ssm/ParamService.ts";
import {Parameter} from "@aws-sdk/client-ssm";
import {BuildNode} from "./BuildNode.ts";
import {GraphQlService} from "../../gql/GraphQlService.ts";

export class EnverNode extends OdmdNode<EnverWindow> {

    createFloatingWindow(): EnverWindow {
        return new EnverWindow(this)
    }

    readonly buildNode: BuildNode;
    readonly buildId: string;
    readonly account: [string, string];
    readonly csResType: string;
    readonly revRefPathPart: string;

    readonly sharingVerPath: string;
    readonly workflowStatusPath: string;
    readonly workflowTriggerMsgPath: string;
    readonly ctlPpStackPath: string;
    readonly centralStackPath: string

    constructor(entity: Entity, build: BuildNode, contentObj: Object) {
        super(entity, build.graph);
        const idArr = entity.id.split('/')
        this.buildNode = build
        this.buildId = idArr[0]
        this.revRefPathPart = idArr[1]
        this.sharingVerPath = `/odmd-share/${this.buildId}/${this.revRefPathPart}/share..version`;

        const {account, csResType, products, consumings} = contentObj as {
            account: [string, string]
            csResType: string
            products: Entity[]
            consumings: Consuming[]
        };
        this.account = account
        this.csResType = csResType

        this.productNodes = products.map(product => {
            return new ProductNode(product, this.graph);
        })

        this.productNodes.forEach(pn => {
            this.addChildNode(pn);
            const productionEdge = new ProductionEdge(this.entity.id, pn.entity.id);
            this.addEdge(productionEdge);
            this.productEdges.push(productionEdge);
        })

        consumings.forEach(consuming => {
            let consumptionEdge = new ConsumptionEdge(this.graph, this.entity.id, consuming.productId);
            this.addEdge(consumptionEdge)
            this.consumptionEdges.push(consumptionEdge);
        })

        const wflName = `ODMD_${this.buildId}-${this.csResType}${GraphQlService.region}-${this.account[0]}`;
        this.workflowStatusPath = `/odmd-github/${this.buildNode.repo}/${this.revRefPathPart.split('..').pop()}/.github/workflows/${wflName}.yaml`
        this.workflowTriggerMsgPath = this.workflowStatusPath + `/triggerMsg`

        this.ctlPpStackPath = `/odmd-managed-stack/${this.buildId}/odmd-ctl-BUILD-${this.buildId}-${this.account[1]}-pp-${this.revRefPathPart.split('..').pop()!.replace(/[^a-zA-Z0-9-]/g, '')}`
        this.centralStackPath = `/odmd-managed-stack/${this.buildId}/odmd-BUILD-${this.buildId}-${this.account[1]}`
    }

    readonly productNodes: ProductNode[] = [];
    readonly productEdges: ProductionEdge[] = [];
    readonly consumptionEdges: ConsumptionEdge[] = [];

    getVisualOptions(): NodeOptions {
        return {
            shape: 'dot',
            color: {
                background: '#9999ff',
                border: '#0000ff',
            },
            size: 16,
            font: {size: 12},
        };
    }

    getTooltipOptions(): TooltipOptions {
        const productions = this.productNodes.map(p => p.entity.id).join(', ');
        // Use the consumings array to display consumed products' IDs
        const consumedProductIds = this.consumptionEdges.map(edge => edge.to);

        let lastVer = this.parameters.get(this.workflowStatusPath)?.Version?.toString() ?? 'n/a';
        let lastUpdate = this.parameters.get(this.workflowStatusPath)?.LastModifiedDate?.toString() ?? 'n/a';

        let wflStatusJstr = this.parameters.get(this.workflowStatusPath)?.Value;
        if (wflStatusJstr) {
            wflStatusJstr = `WFL status: ${wflStatusJstr}<br>trigger msg: ${this.parameters.get(this.workflowTriggerMsgPath)?.Value}`
        }

        return {
            content: `
<div style="
    white-space: normal;
    word-wrap: normal;
    overflow: hidden;
    padding: 10px;
    border: 1px solid #ddd;
    background-color: #fff;
    border-radius: 5px;
    box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
    font-size: 14px;
    line-height: 1.4;
    max-width: 300px; /* Increased maxWidth for potentially longer lists */
">
    <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
        ${this.entity.id}
    </div>

    ${productions ? `
    <div style="margin-bottom: 5px;">
        <strong>Produces:</strong>
        <ul style="margin-top: 5px; margin-bottom: 0; padding-left: 20px;">
            ${this.productNodes.map(p => `<li>${p.entity.id.split('/').slice(2).join('/')}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${consumedProductIds.length > 0 ? `
    <div>
        <strong>Consumes:</strong>
        <ul style="margin-top: 5px; margin-bottom: 0; padding-left: 20px;">
            ${consumedProductIds.map(id => `<li>${id.split('/').slice(2).join('/')}</li>`).join('')}
        </ul>
    </div>
    
    
    ` : ''}
    
${this.workflowStatusPath}
<br>
Version: ${lastVer} updated on ${lastUpdate}
<br>
${wflStatusJstr ?? localStorage.getItem('user_info') ? 'Never ran ...' : 'Login to see details'}
</div>
      `,
            style: {maxWidth: '350px'} // Increased style maxWidth to match content maxWidth
        };
    }

    getMenuOptions(): MenuOptions {
        return {
            items: [
                {
                    icon: 'visibility',
                    label: 'Show Productions',
                    action: () => console.log('Show productions for:', this.entity.id)
                },
                {
                    icon: 'settings',
                    label: 'Environment Settings',
                    action: () => console.log('Open settings for:', this.entity.id)
                },
                {
                    icon: 'refresh',
                    label: 'Refresh Status',
                    action: () => console.log('Refresh status for:', this.entity.id)
                }
            ]
        };
    }


    async onReady() {

        this.consumptionEdges.forEach(consumptionEdge => {
            const [b, e, p] = consumptionEdge.to.split('/')
            const pEnverNode = this.graph.odmdNodes.get(b + '/' + e)! as EnverNode
            if (pEnverNode) {
                const found = pEnverNode.productNodes
                    .find(pn => pn.entity.id == consumptionEdge.to);
                found?.addConsumer(consumptionEdge)
            }
        })

        ParamService.getInstance().fetchParams(
            [
                ...this.productNodes.map(pn => '/odmd-share/' + pn.entity.id),
                this.sharingVerPath,
                this.workflowStatusPath,
                this.workflowTriggerMsgPath,
                this.ctlPpStackPath,
                this.centralStackPath,
            ],
            this.onParam.bind(this)
        )
    }

    readonly sharedToConsumedVer = new Map<string, number>()

    onParam(param: Parameter | string) {
        if (typeof param == 'object') {
            this.parameters.set(param.Name!, param)
            if (this.floatingWindow) {
                this.floatingWindow.onParam(param)
            }
            if (param.Name == this.sharingVerPath) {
                const arr = JSON.parse(param.Value!) as string[]
                arr.forEach(ae => {
                    console.log(ae)
                    const [k, bb] = ae.split(':')
                    const obj = JSON.parse(atob(bb).toString())
                    for (const kn in obj) {
                        if (kn != 'ContractsShareInNow') {
                            this.sharedToConsumedVer.set(`/odmd-share/${k}/${kn}`, obj[kn]);

                            this.consumptionEdges.find(c => {
                                c.consumingVersion = obj[kn]
                            })
                        }
                    }

                })
            } else if (param.Name?.startsWith('/odmd-share/')) {
                let productNode = this.productNodes.find(pn => ('/odmd-share/' + pn.entity.id) == param.Name)!;
                productNode.update(param)
            } else {
                console.log('')
            }
        } else {
            console.error('error: onParam: ' + param)
        }

    }

    onData(change: { operation: "Delete" | "Update" | "Create"; name: string; type: string }) {
        if (change.operation != "Delete") {
            ParamService.getInstance().fetchParams([change.name], this.onParam.bind(this))
        }
    }

    public async cleanup() {
        await super.cleanup()
        this.productNodes.forEach(node => node.cleanup());
    }
}