import {FloatingWindow, FloatingWindowOptions} from "../FloatingWindow.ts";
import {RepoNode} from "../nodes/RepoNode.ts";

export class RepoWindow extends FloatingWindow<RepoNode> {
    refreshWindowOptions(): FloatingWindowOptions {
        return {
            title: this.node.entity.id,
            content: `
<div>
  <h4>Repo Details</h4>
  <p> ${this.node.entity.id}</p>
</div>
`
        };
    }

}