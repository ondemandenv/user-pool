import {FloatingWindow, FloatingWindowOptions} from "../FloatingWindow.ts";
import {ProductNode} from "../nodes/ProductNode.ts";
import {EnverNode} from "../nodes/EnverNode.ts";
import {GetParameterHistoryCommand, Parameter, ParameterHistory, SSMClient} from "@aws-sdk/client-ssm";
import {AuthService} from "../../auth/AuthService.ts";

export class ProductWindow extends FloatingWindow<ProductNode> {

    private paramHistory?: ParameterHistory[] | undefined;

    constructor(node: ProductNode) {
        super(node);
        const arr = node.entity.id
        this.enverNode = this.node.graph.odmdNodes.get(arr[0] + '/' + arr[1]) as EnverNode

        (async () => {
            await this.fetchParamHistory();
            this.onParam(this.node.param!)
        })();
    }

    private enverNode: EnverNode;

    refreshWindowOptions(): FloatingWindowOptions {

        const entityId = this.node.entity.id;

        return {
            title: entityId,
            content: `
<div>
  <textarea readonly style="width: 95%; height: 150px; resize: both;">Product: ${this.node.param ? JSON.stringify(this.node.param, null, 4) : 'not loaded'}</textarea>
  <textarea readonly style="width: 95%; height: 150px; resize: both;">History: ${this.paramHistory ? JSON.stringify(this.paramHistory, null, 4) : 'not loaded'}</textarea>
</div>
`
        };
    }

    private async fetchParamHistory(): Promise<void> {
        if( AuthService.instance.credentials ){
            try {
                const ssm = new SSMClient({
                    region: AuthService.instance.authConfig.region,
                    credentials: AuthService.instance.credentials
                });
                const response = await ssm.send(new GetParameterHistoryCommand({
                    Name: this.node.param!.Name
                }));
                this.paramHistory = response.Parameters;
            } catch (error) {
                console.error("Error fetching parameter history:", error);
                this.paramHistory = undefined; // Or handle error differently, e.g., set a flag to display an error message in the window
            }
        }
    }


    onParam(param: Parameter) {
        (async () => {
            if (!this.paramHistory) {
                await this.fetchParamHistory();
            }
            super.onParam(param);
        })();
    }
}