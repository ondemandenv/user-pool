import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Bucket} from "aws-cdk-lib/aws-s3";
import {OdmdEnverUserAuthSbx, OndemandContractsSandbox} from "@ondemandenv/odmd-contracts-sandbox";
import {OdmdCrossRefConsumer} from "@ondemandenv/contracts-lib-base";

export class WebUiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: cdk.StackProps & { bucket: Bucket }) {
        super(scope, id, props);

        const myEnver = OndemandContractsSandbox.inst.getTargetEnver() as OdmdEnverUserAuthSbx

        const aaa = new OdmdCrossRefConsumer(myEnver, 'consumeidProviderClientId', myEnver.idProviderClientId).getSharedValue(this)

        new s3deploy.BucketDeployment(this, 'DeployWebsite', {
            sources: [s3deploy.Source.asset('webui/dist')],
            destinationBucket: props.bucket,
        });
    }
}
