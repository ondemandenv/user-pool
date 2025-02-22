#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {StackProps} from "aws-cdk-lib";
import {OndemandContractsSandbox} from "@ondemandenv/odmd-contracts-sandbox";
import {OdmdEnverCdk} from "@ondemandenv/contracts-lib-base";
import {UserPoolStack} from "../lib/user-pool-stack";
import {WebHostingStack} from "../lib/web-hosting-stack";
import {WebUiStack} from "../lib/web-ui-stack";

const app = new cdk.App();


async function main() {

    const buildRegion = process.env.CDK_DEFAULT_REGION;
    const buildAccount = process.env.CDK_DEFAULT_ACCOUNT;
    if (!buildRegion || !buildAccount) {
        throw new Error("buildRegion>>>" + buildRegion + "; buildAccount>" + buildAccount)
    }

    const props = {
        env: {
            account: buildAccount,
            region: buildRegion
        }
    } as StackProps;

    new OndemandContractsSandbox(app)

    const targetEnver = OndemandContractsSandbox.inst.getTargetEnver() as OdmdEnverCdk

    const hostedZoneId = 'Z07732022HSGPH3GRGCVY';
    const zoneName = 'auth.ondemandenv.link'

    const webHosting = new WebHostingStack(app, targetEnver.getRevStackNames()[1], {
        ...props, hostedZoneId, zoneName
    })

    const usrPool = new UserPoolStack(app, targetEnver.getRevStackNames()[0], {
        ...props, hostedZoneId, zoneName, webSubFQDN: webHosting.webSubFQDN
    })

    const webUi = new WebUiStack(app, targetEnver.getRevStackNames()[2], {
        ...props, bucket: webHosting.bucket, userPool: usrPool.userPool,
        userPoolDomain: usrPool.zoneName,
        webDomain: webHosting.webSubFQDN
    })

    await webUi.buildWebUiAndDeploy()
}


console.log("main begin.")
main().catch(e => {
    console.error(e)
    throw e
}).finally(() => {
    console.log("main end.")
})