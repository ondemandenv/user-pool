import {OdmdNode, MenuOptions} from '../OdmdNode.ts';
import {Node, NodeOptions} from 'vis-network';
import {TooltipOptions} from "../Tooltip.ts";
import {ProductWindow} from "../windows/ProductWindow.ts";
import {ConsumptionEdge} from "../edges/ConsumptionEdge.ts";
import {Parameter} from "@aws-sdk/client-ssm";

export class ProductNode extends OdmdNode<ProductWindow> {

    async subscribe(): Promise<void> {
        throw new Error('Implemented in enver');
    }

    onData(change: { operation: 'Delete' | 'Update' | 'Create'; name: string; type: string; }): void {
        throw new Error('Implemented in enver');
    }

    onReady = async () => {
        throw new Error('Implemented in enver');
    }

    createFloatingWindow(): ProductWindow {
        return new ProductWindow(this)
    }

    getVisualOptions(): NodeOptions {
        return {
            shape: 'triangle',
            color: {
                background: '#ffff99',
                border: '#ffff00',
            },
            size: 16,
            font: {size: 12},
        };
    }

    getTooltipOptions(): TooltipOptions {
        const label = this.entity.id.split('/')[2]

        let text: string
        if (this.param) {
            text = `
<div style="margin-bottom: 5px;">
    <strong>Version:</strong> <span style="font-weight: normal;">${this.param.Version}</span>
</div>
<div>
    <strong>Value:</strong> <span style="font-weight: normal; word-break: break-all;">${this.param.Value}</span>
</div>
`;
        } else {
            const userInfo = localStorage.getItem('user_info');
            if (userInfo) {
                text = '<div style="color: orange;">Version information unavailable. Enver not deployed.</div>';
            } else {
                text = '<div style="color: grey;">Login to view version details.</div>';
            }
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
">
    <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
        ${label}
    </div>
    ${text}
</div>
`,
            style: {maxWidth: '250px'}
        };
    }

    getMenuOptions(): MenuOptions {
        return {
            items: [
                {
                    icon: 'info',
                    label: 'View Details',
                    action: () => console.log('View details for:', this.entity.content)
                },
                {
                    icon: 'history',
                    label: 'Version History',
                    action: () => console.log('View version history for:', this.entity.content)
                }
            ]
        };
    }

    readonly consumingEdges = new Set<ConsumptionEdge>();

    addConsumer(consumptionEdge: ConsumptionEdge) {
        this.consumingEdges.add(consumptionEdge);
    }

    param?: Parameter

    update(param: Parameter) {
        this.param = param;
        if( this.floatingWindow ){
            this.floatingWindow.onParam( param )
        }
        this.consumingEdges.forEach(edge => edge.productVersion = param.Version!)
        this.graph.visNodes.update(this.getNodeData())
    }

    getNodeData(): Node {
        let ret = super.getNodeData();
        ret.label = this.entity.id.split('/')[2]
        if (this.param) {
            ret.label += ('@' + this.param.Version!)
        }
        return ret;
    }
}