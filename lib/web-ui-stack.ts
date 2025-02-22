import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Bucket} from "aws-cdk-lib/aws-s3";
import {OdmdEnverUserAuthSbx, OndemandContractsSandbox} from "@ondemandenv/odmd-contracts-sandbox";
import {AssumeRoleCommand, STSClient} from "@aws-sdk/client-sts";
import {GetParametersCommand, SSMClient} from "@aws-sdk/client-ssm";
import {UserPool} from "aws-cdk-lib/aws-cognito";
import {AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId} from "aws-cdk-lib/custom-resources";
import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {Readable} from "node:stream";

export class WebUiStack extends cdk.Stack {

    readonly targetBucket: Bucket;
    readonly userPool: UserPool;

    constructor(scope: Construct, id: string, props: cdk.StackProps & {
        bucket: Bucket, userPool: UserPool
    }) {
        super(scope, id, props);
        this.targetBucket = props.bucket;
        this.userPool = props.userPool;
    }

    async buildWebUiAndDeploy() {

        const myEnver = OndemandContractsSandbox.inst.getTargetEnver() as OdmdEnverUserAuthSbx


        const stsClient = new STSClient({region: this.region});
        const assumeRoleResponse = await stsClient.send(new AssumeRoleCommand({
            RoleArn: myEnver.centralRoleArn,
            RoleSessionName: 'getValsFromCentral'
        }));
        const credentials = assumeRoleResponse.Credentials!;

        const ssmClient = new SSMClient({
            region: this.region,
            credentials: {
                accessKeyId: credentials.AccessKeyId!,
                secretAccessKey: credentials.SecretAccessKey!,
                sessionToken: credentials.SessionToken
            },
        });

        const psOut = await ssmClient.send(new GetParametersCommand({
            Names: [
                myEnver.idProviderClientId.toSharePath(),
                myEnver.idProviderName.toSharePath(),
                myEnver.appsyncWssEndpoint.toSharePath(),
                myEnver.appsyncHttpEndpoint.toSharePath(),
                myEnver.identityPoolId.toSharePath(),
                //D:\odmd\seed\ONDEMAND_CENTRAL_REPO\src\lib\appsync\AppsyncBackendStack.ts
                `/odmd-share/${myEnver.owner.buildId}/${myEnver.targetRevision.toPathPartStr()}/centralBucketName`
            ],
            WithDecryption: true
        }));
        const ps = psOut.Parameters!
        const s3Client = new S3Client({region: OndemandContractsSandbox.inst.contractsLibBuild.envers[0].targetAWSRegion})
        const visDataOut = await s3Client.send(new GetObjectCommand({
            Bucket: ps.pop()!.Value!,
            Key: 'odmd.vis.data.json'
        }))

        const bodyStream = visDataOut.Body as Readable;
        const ooo = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            bodyStream.on('data', (chunk) => chunks.push(chunk));
            bodyStream.on('end', () => resolve(Buffer.concat(chunks)));
            bodyStream.on('error', reject); // Handle stream errors as well
        });

        const obj = {} as { [k: string]: any };
        ps.forEach(p => {
            obj[p.Name?.split('/').at(-1) as string] = p.Value!
        })

        obj.userPoolId = this.userPool.userPoolId
        obj.visData = ooo.toJSON()

        const configParams = {
            Bucket: this.targetBucket.bucketName,
            Key: 'config.json',
            Body: JSON.stringify(obj),
            ContentType: 'application/json'
        };
        const pubConfig = new AwsCustomResource(this, 'S3PutObject', {
            onCreate: {
                service: 'S3',
                action: 'putObject',
                parameters: configParams,
                physicalResourceId: PhysicalResourceId.of('s3PutObject')
            },
            onUpdate: {
                service: 'S3',
                action: 'putObject',
                parameters: configParams,
                physicalResourceId: PhysicalResourceId.of('s3PutObject')
            },
            policy: AwsCustomResourcePolicy.fromSdkCalls({
                resources: [this.targetBucket.arnForObjects('*')]
            })
        });

        pubConfig.node.addDependency(
            new s3deploy.BucketDeployment(this, 'DeployWebsite', {
                sources: [s3deploy.Source.asset('webui/dist')],
                destinationBucket: this.targetBucket,
            })
        )

    }

}
