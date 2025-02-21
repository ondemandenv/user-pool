import {EnverWindow} from "./EnverWindow.ts";
import {FloatingWindowOptions} from "../FloatingWindow.ts";
import {EnverNodeCdk} from "../nodes/EnverNodeCdk.ts";

export class EnverWindowCdk extends EnverWindow {

    get cdkNode() {
        return this.node as EnverNodeCdk
    }


    refreshWindowOptions(): FloatingWindowOptions {
        const ret = super.refreshWindowOptions();
        const stackParams = this.cdkNode.stackNamePaths.map(sp => this.cdkNode.parameters.get(sp));

        ret.content += `
<div>
<textarea id="ta" readonly style="width: 95%; height: 150px; resize: both;">
  
        ${JSON.stringify(stackParams, null, 4)}
</textarea>
</div>
`
        return ret;
    }
}