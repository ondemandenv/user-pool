import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Bucket} from "aws-cdk-lib/aws-s3";
import {OdmdEnverUserAuthSbx, OndemandContractsSandbox} from "@ondemandenv/odmd-contracts-sandbox";
import {AssumeRoleCommand, STSClient} from "@aws-sdk/client-sts";
import {GetParameterCommand, GetParametersCommand, SSMClient} from "@aws-sdk/client-ssm";
import {UserPool} from "aws-cdk-lib/aws-cognito";
import {AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId} from "aws-cdk-lib/custom-resources";
import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {Readable} from "node:stream";
import {Credentials} from "@aws-sdk/client-sts/dist-types/models/models_0";

export class WebUiStack extends cdk.Stack {

    readonly targetBucket: Bucket;
    readonly userPool: UserPool;
    readonly webDomain: string;
    readonly userPoolDomain: string;

    constructor(scope: Construct, id: string, props: cdk.StackProps & {
        bucket: Bucket, userPool: UserPool, userPoolDomain: string, webDomain: string
    }) {
        super(scope, id, props);
        this.targetBucket = props.bucket;
        this.userPool = props.userPool;
        this.userPoolDomain = props.userPoolDomain;
        this.webDomain = props.webDomain;
    }

    async buildWebUiAndDeploy() {

        const myEnver = OndemandContractsSandbox.inst.getTargetEnver() as OdmdEnverUserAuthSbx

        const webDeployment = new s3deploy.BucketDeployment(this, 'DeployWebsite', {
            sources: [s3deploy.Source.asset('webui/dist')],
            destinationBucket: this.targetBucket,
        });

        const assumeRoleResponse = await new STSClient({region: this.region}).send(new AssumeRoleCommand({
            RoleArn: myEnver.centralRoleArn,
            RoleSessionName: 'getValsFromCentral'
        }));
        const credentials = assumeRoleResponse.Credentials!;

        let values = [myEnver.targetAWSRegion, 'us-west-1'].map(async region => {

            const visDataGqlUrl = await this.getVisDataAndGqUrl(credentials, region,
                myEnver.appsyncGraphqlUrl.toSharePath(),
                `/odmd-share/${myEnver.owner.buildId}/${myEnver.targetRevision.toPathPartStr()}/centralBucketName`);

            const regionConfig = {
                Bucket: this.targetBucket.bucketName,
                Key: `config_region/${region}.json`,
                Body: JSON.stringify(visDataGqlUrl),
                ContentType: 'application/json'
            };

            new AwsCustomResource(this, 'visDataGqlUrl_' + region, {
                onCreate: {
                    service: 'S3',
                    action: 'putObject',
                    parameters: regionConfig,
                    physicalResourceId: PhysicalResourceId.of('s3PutObject')
                },
                onUpdate: {
                    service: 'S3',
                    action: 'putObject',
                    parameters: regionConfig,
                    physicalResourceId: PhysicalResourceId.of('s3PutObject')
                },
                policy: AwsCustomResourcePolicy.fromSdkCalls({
                    resources: [this.targetBucket.arnForObjects('*')]
                })
            }).node.addDependency(webDeployment)

        });
        await Promise.allSettled(values)

        const ssmClient = new SSMClient({
            region: this.region,
            credentials: {
                accessKeyId: credentials.AccessKeyId!,
                secretAccessKey: credentials.SecretAccessKey!,
                sessionToken: credentials.SessionToken
            },
        });

        const authParams = await ssmClient.send(new GetParametersCommand({
            Names: [
                myEnver.idProviderClientId.toSharePath(),
                myEnver.idProviderName.toSharePath(),
                myEnver.identityPoolId.toSharePath(),
                //D:\odmd\seed\ONDEMAND_CENTRAL_REPO\src\lib\appsync\AppsyncBackendStack.ts
                // bucketNameParamPath
            ],
            WithDecryption: true
        }));
        console.log(JSON.stringify(authParams, null, 2));

        const ps = authParams.Parameters!

        const obj = {} as { [k: string]: any };
        ps.forEach(p => {
            obj[p.Name?.split('/').at(-1) as string] = p.Value!
        })

        obj.region = this.region
        obj.userPoolId = this.userPool.userPoolId
        obj.userPoolDomain = this.userPoolDomain
        obj.webDomain = this.webDomain
        obj.pub_time = new Date().toISOString()

        const configParams = {
            Bucket: this.targetBucket.bucketName,
            Key: 'config.json',
            Body: JSON.stringify(obj),
            ContentType: 'application/json'
        };
        new AwsCustomResource(this, 'pubConfig', {
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
        }).node.addDependency(
            webDeployment
        )


    }

    private async getVisDataAndGqUrl(creds: Credentials, region: string,
                                     appsyncGraphqlUrlPath: string,
                                     visDataBucketPath: string) {
        const credentials = {
            accessKeyId: creds.AccessKeyId!,
            secretAccessKey: creds.SecretAccessKey!,
            sessionToken: creds.SessionToken
        };
        const ssmClient = new SSMClient({region, credentials});

        const regionParamOut = await ssmClient.send(
            new GetParametersCommand({
                Names: [visDataBucketPath, appsyncGraphqlUrlPath]
            }))

        const s3Client = new S3Client({region, credentials})
        const visDataOut = await s3Client.send(new GetObjectCommand({
            Bucket: regionParamOut.Parameters!.find(p => p.Name == visDataBucketPath)!.Value,
            Key: 'odmd.vis.data.json'
        }))

        const bodyStream = visDataOut.Body as Readable;
        const bufferLikeBuffer = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            bodyStream.on('data', (chunk) => chunks.push(chunk));
            bodyStream.on('end', () => resolve(Buffer.concat(chunks)));
            bodyStream.on('error', reject);
        });
        return [JSON.parse(bufferLikeBuffer.toString()),
            regionParamOut.Parameters!.find(p => p.Name == appsyncGraphqlUrlPath)!.Value!]
    }
}
