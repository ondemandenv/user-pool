import {EnverNode} from "./EnverNode.ts";
import {Entity} from "../../gql/types.ts";
import {BuildNode} from "./BuildNode.ts";
import {ParamService} from "../../ssm/ParamService.ts";
import {Parameter} from "@aws-sdk/client-ssm";
import {EnverWindowCdk} from "../windows/EnverWindowCdk.ts";
import {EnverWindow} from "../windows/EnverWindow.ts";

export class EnverNodeCdk extends EnverNode {


    createFloatingWindow(): EnverWindow {
        return new EnverWindowCdk(this)
    }

    readonly stackNamePaths: string[]

    constructor(entity: Entity, build: BuildNode, contentObj: Object) {
        super(entity, build, contentObj);
        const {stacks} = contentObj as { stacks: string[]; };
        this.stackNamePaths = stacks?.map(s => `/odmd-managed-stack/${this.buildId}/${s}`) ?? []

    }

    async onReady(): Promise<void> {
        await super.onReady();

        ParamService.getInstance().fetchParams(
            this.stackNamePaths,
            this.onParam.bind(this)
        )
    }

    onParam(param: Parameter | string) {
        super.onParam(param);
        if (typeof param == 'object' && this.stackNamePaths.includes(param.Name!)) {

        }
    }

}