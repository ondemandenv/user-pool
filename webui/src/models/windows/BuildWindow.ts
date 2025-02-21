import {FloatingWindow, FloatingWindowOptions} from "../FloatingWindow.ts";
import {BuildNode} from "../nodes/BuildNode.ts";

export class BuildWindow extends FloatingWindow<BuildNode> {
    refreshWindowOptions(): FloatingWindowOptions {
        return {
            title: this.node.entity.id,
            content: `
<div>
  <h4>Build Details</h4>
  <p>Repo:${this.node.repo}</p>
  <p>Wkdirs: ${this.node.workDirs ? this.node.workDirs.join('/') : '.'}</p>
  <ul>
  </ul>
</div>
`
        };
    }

}