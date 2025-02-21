import { FloatingWindow, FloatingWindowOptions } from "../FloatingWindow.ts";
import { EnverNode } from "../nodes/EnverNode.ts";

export class EnverWindow extends FloatingWindow<EnverNode> {

    refreshWindowOptions(): FloatingWindowOptions {
        const workflowStatus = this.node.parameters.get(this.node.workflowStatusPath);
        const lastVer = workflowStatus?.Version?.toString() ?? 'n/a';
        const lastUpdate = workflowStatus?.LastModifiedDate?.toString() ?? 'n/a';

        let wflStatusJson: any = null;
        let wflStatusString: string = 'Never ran ...';

        if (workflowStatus?.Value) {
            try {
                wflStatusJson = JSON.parse(workflowStatus.Value);
                wflStatusString = JSON.stringify(wflStatusJson, null, 2); // Use 2 spaces for indentation
                wflStatusString += `\n--------------------\n${this.node.parameters.get(this.node.workflowTriggerMsgPath)?.Value ?? ''}`; // Handle potential undefined trigger message
            } catch (e) {
                console.error("Error parsing workflow status JSON:", e);
                wflStatusString = `Error parsing workflow status: ${e}`; // Display error message in the window
            }
        }


        const ctlPpStack = this.node.parameters.get(this.node.ctlPpStackPath)?.Value ?? 'N/A';
        const centralStack = this.node.parameters.get(this.node.centralStackPath)?.Value ?? 'N/A';


        return {
            title: this.node.entity.id,
            content: `
<div>
  <p>Enver: ${this.node.entity.id}</p>
  <p>Workflow: ${this.node.workflowStatusPath.split('/').pop()}</p>
  <p>Type: ${this.node.csResType}</p>
  <p>Version: ${lastVer} (updated on ${lastUpdate})</p>
  
  <label for="ta">Odmd Status:</label><br>
  <textarea id="ta" readonly style="width: 95%; height: 150px; resize: both;">
${wflStatusString}

${ctlPpStack}

${centralStack}
</textarea>
</div>
`
        };
    }

}