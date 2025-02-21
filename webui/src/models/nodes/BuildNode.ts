import {OdmdNode, MenuOptions} from '../OdmdNode.ts';
import {NodeOptions} from 'vis-network';
import {EnverNode} from './EnverNode.ts';
import {Entity} from "../../gql/types.ts";
import {BuildToEnverEdge} from "../edges/BuildToEnverEdge.ts";
import {NetworkGraph} from "../../NetworkGraph.ts";
import {TooltipOptions} from "../Tooltip.ts";
import {BuildWindow} from "../windows/BuildWindow.ts";
import {HttpGraphQLClient} from "../../gql/HttpGraphQLClient.ts";
import {LIST_ENTITIES_QUERY} from "../../gql/ops.ts";
import {EnverNodeCtnImg} from "./EnverNodeCtnImg.ts";
import {EnverNodeCdk} from "./EnverNodeCdk.ts";

export class BuildNode extends OdmdNode<BuildWindow> {

    static async QueryByBuildIds(buildIds: string[]) {
        const initResp = await HttpGraphQLClient.inst.query<any>({
            query: LIST_ENTITIES_QUERY,
            variables: {
                class: 'BUILD', filter: JSON.stringify(buildIds), pagination: {limit: 1000}
            }
        });

        return initResp.data.listEntitiesWithFilter.items as Entity[];
    }


    readonly entityIdToEnverNode: Map<string, EnverNode> = new Map<string, EnverNode>();

    createFloatingWindow(): BuildWindow {
        return new BuildWindow(this)
    }

    constructor(entity: Entity, networkManager: NetworkGraph) {
        super(entity, networkManager);
        const entityCtt = typeof entity.content == 'object' ? entity.content : JSON.parse(entity.content!)

        const {owner, name} = entityCtt.repo
        this.repo = owner + '/' + name
        this.workDirs = entityCtt.workDirs

        const contentEnvers = entityCtt.envers as Array<Entity>;

        contentEnvers.forEach(ce => {
            let cttObj = JSON.parse(ce.content!);
            const resType = cttObj.csResType as 'CmdsGH' | 'CdkGithubWF' | 'ContainerImageEcr'

            let en: EnverNode;
            if (resType == 'CmdsGH') {
                en = new EnverNode(ce, this, cttObj);
            } else if (resType == 'CdkGithubWF') {
                en = new EnverNodeCdk(ce, this, cttObj);
            } else if (resType == 'ContainerImageEcr') {
                en = new EnverNodeCtnImg(ce, this, cttObj);
            } else {
                throw new Error('N/a')
            }
            this.entityIdToEnverNode.set(ce.id, en)
            this.addChildNode(en);
            this.addEdge(new BuildToEnverEdge(this.entity.id, en.entity.id));
        })
    }

    readonly repo: string
    readonly workDirs?: string[]

    getVisualOptions(): NodeOptions {
        return {
            shape: 'square',
            color: {
                background: '#99ff99',
                border: '#00ff00',
            },
            size: 16,
            font: {
                size: 12,
            },
        };
    }

    getTooltipOptions(): TooltipOptions {
        const enverNodes = Array.from(this.entityIdToEnverNode.values());

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
    max-width: 300px;
">
    <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
        ${this.entity.id}
    </div>

    <div style="margin-bottom: 5px;">
        <strong>Repository:</strong> <span style="font-weight: normal;">${this.repo}</span>
    </div>

    ${enverNodes.length > 0 ? `
    <div>
        <strong>Environments:</strong>
        <ul style="margin-top: 5px; margin-bottom: 0; padding-left: 20px;">
            ${enverNodes.map(enver => `<li>${enver.entity.id.split('/').slice(1).join('/')}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</div>
      `,
            style: {
                maxWidth: '300px',
            }
        };
    }


    getMenuOptions(): MenuOptions {
        return {
            items: [
                {
                    icon: 'play_arrow',
                    label: 'Run Job',
                    action: () => {
                        console.log('Run job:', this.entity.id);
                    }
                },
                {
                    icon: 'schedule',
                    label: 'Schedule',
                    action: () => {
                        console.log('Schedule job:', this.entity.id);
                    }
                },
                {
                    icon: 'analytics',
                    label: 'View Logs',
                    action: () => {
                        console.log('View logs for:', this.entity.id);
                    }
                }
            ]
        };
    }

    onReady(): void {
        console.log('Method not implemented.');
    }

    async onData(change: { operation: "Delete" | "Update" | "Create"; name: string; type: string }) {
        if (change.name.startsWith('/odmd-enver')) {
            const [entity] = await BuildNode.QueryByBuildIds([this.entity.id])

            const entityCtt = typeof entity.content == 'object' ? entity.content : JSON.parse(entity.content!)

            const newEnverEntities = entityCtt.envers as Array<Entity>;

            const toRemove = Array.from(this.entityIdToEnverNode.keys())
                .filter(exId => newEnverEntities.find(nwe => nwe.id == exId) == undefined)

            toRemove.forEach(eid => {
                this.graph.removeNodeById(eid)
                this.entityIdToEnverNode.delete(eid)
            })
            newEnverEntities.forEach(ce => {
                if (!this.entityIdToEnverNode.has(ce.id)) {

                    let cttObj = JSON.parse(ce.content!);
                    const resType = cttObj.csResType as 'CmdsGH' | 'CdkGithubWF' | 'ContainerImageEcr'

                    let en: EnverNode;
                    if (resType == 'CmdsGH') {
                        en = new EnverNode(ce, this, cttObj);
                    } else if (resType == 'CdkGithubWF') {
                        en = new EnverNodeCdk(ce, this, cttObj);
                    } else if (resType == 'ContainerImageEcr') {
                        en = new EnverNodeCtnImg(ce, this, cttObj);
                    } else {
                        throw new Error('N/a')
                    }

                    this.entityIdToEnverNode.set(ce.id, en)
                    this.addChildNode(en);
                    this.addEdge(new BuildToEnverEdge(this.entity.id, en.entity.id));
                }
            })
        }
    }
}