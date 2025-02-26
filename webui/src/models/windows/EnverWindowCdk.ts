import {EnverWindow} from "./EnverWindow.ts";
import {FloatingWindowOptions} from "../FloatingWindow.ts";
import {EnverNodeCdk} from "../nodes/EnverNodeCdk.ts";

export class EnverWindowCdk extends EnverWindow {

    get cdkNode() {
        return this.node as EnverNodeCdk
    }


    refreshWindowOptions(): FloatingWindowOptions {
        const ret = super.refreshWindowOptions();
        let contents: string[];
        if (localStorage.getItem('user_info')) {
            contents = this.cdkNode.stackNamePaths.map(sp => {
                    let stk = this.cdkNode.parameters.get(sp);
                    return `
<div>
${stk?.ARN}
<br>
<textarea id="ta" readonly style="width: 95%; height: 150px; resize: both;">
${stk?.Value}
</textarea>
</div>
`
                }
            );
        } else {
            contents = [`Login to see details of ${this.cdkNode.stackNamePaths.length}: stacks`];
        }

        ret.content += contents.join('<br>')
        return ret;
    }
}