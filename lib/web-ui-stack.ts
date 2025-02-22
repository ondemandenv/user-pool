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
import {UserPoolStack} from "./user-pool-stack";

export class WebUiStack extends cdk.Stack {

    readonly targetBucket: Bucket;
    readonly userPool: UserPool;
    readonly webDomain: string;

    constructor(scope: Construct, id: string, props: cdk.StackProps & {
        bucket: Bucket, userPool: UserPool, webDomain: string
    }) {
        super(scope, id, props);
        this.targetBucket = props.bucket;
        this.userPool = props.userPool;
        this.webDomain = props.webDomain;
    }

    async buildWebUiAndDeploy() {

        const myEnver = OndemandContractsSandbox.inst.getTargetEnver() as OdmdEnverUserAuthSbx

        const assumeRoleResponse = await new STSClient({region: this.region}).send(new AssumeRoleCommand({
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
        const s3Client = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: credentials.AccessKeyId!,
                secretAccessKey: credentials.SecretAccessKey!,
                sessionToken: credentials.SessionToken
            }
        })

        const bucketNameParamPath = `/odmd-share/${myEnver.owner.buildId}/${myEnver.targetRevision.toPathPartStr()}/centralBucketName`;
        const psOut = await ssmClient.send(new GetParametersCommand({
            Names: [
                myEnver.idProviderClientId.toSharePath(),
                myEnver.idProviderName.toSharePath(),
                myEnver.appsyncWssEndpoint.toSharePath(),
                myEnver.appsyncHttpEndpoint.toSharePath(),
                myEnver.identityPoolId.toSharePath(),
                //D:\odmd\seed\ONDEMAND_CENTRAL_REPO\src\lib\appsync\AppsyncBackendStack.ts
                bucketNameParamPath
            ],
            WithDecryption: true
        }));

        const bucketNameParamIdx = psOut.Parameters!.findIndex(p => p.Name == bucketNameParamPath)

        const ps = psOut.Parameters!
        const visDataOut = await s3Client.send(new GetObjectCommand({
            Bucket: ps.splice(bucketNameParamIdx, 1)[0]!.Value!,
            Key: 'odmd.vis.data.json'
        }))

        const bodyStream = visDataOut.Body as Readable;
        const bufferLikeBuffer = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            bodyStream.on('data', (chunk) => chunks.push(chunk));
            bodyStream.on('end', () => resolve(Buffer.concat(chunks)));
            bodyStream.on('error', reject);
        });

        const obj = {} as { [k: string]: any };
        ps.forEach(p => {
            obj[p.Name?.split('/').at(-1) as string] = p.Value!
        })

        obj.region = this.region
        obj.userPoolId = this.userPool.userPoolId
        obj.userPoolDomain = UserPoolStack.zoneName
        obj.webDomain = this.webDomain
        obj.visData = JSON.parse(bufferLikeBuffer.toString())

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
