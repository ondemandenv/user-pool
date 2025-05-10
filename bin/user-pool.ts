#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {StackProps} from "aws-cdk-lib";
import {OndemandContractsSandbox} from "@ondemandenv/odmd-contracts-sandbox";
import {OdmdEnverUserAuth} from "@ondemandenv/contracts-lib-base";
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

    const targetEnver = OndemandContractsSandbox.inst.getTargetEnver() as OdmdEnverUserAuth

    const webHosting = new WebHostingStack(app, targetEnver.getRevStackNames()[1], {
        ...props, hostedZoneId: targetEnver.hostedZoneId, zoneName: targetEnver.hostedZoneName
    })

    const usrPool = new UserPoolStack(app, targetEnver.getRevStackNames()[0], {
        ...props,
        hostedZoneId: targetEnver.hostedZoneId,
        zoneName: targetEnver.hostedZoneName,
        webSubFQDN: webHosting.webSubFQDN,
        authEnver: targetEnver
    })

    const webUi = new WebUiStack(app, targetEnver.getRevStackNames()[2], {
        ...props, bucket: webHosting.bucket, userPool: usrPool.userPool,
        userPoolDomain: usrPool.zoneName,
        webDomain: webHosting.webSubFQDN,
        authEnver: targetEnver
    })

    try {
        await webUi.buildWebUiAndDeploy()
    } catch (e) {
        console.error(`appsync not deployed, and /odmd-share ... not ready ?:` + e)
    }
}


console.log("main begin.")
main().catch(e => {
    console.error(e)
    throw e
}).finally(() => {
    console.log("main end.")
})