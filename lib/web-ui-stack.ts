import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Bucket} from "aws-cdk-lib/aws-s3";
import {AssumeRoleCommand, STSClient} from "@aws-sdk/client-sts";
import {GetParametersCommand, SSMClient} from "@aws-sdk/client-ssm";
import {UserPool} from "aws-cdk-lib/aws-cognito";
import {AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId} from "aws-cdk-lib/custom-resources";
import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {Readable} from "node:stream";
import {Credentials} from "@aws-sdk/client-sts/dist-types/models/models_0";
import {OdmdEnverUserAuth} from "@ondemandenv/contracts-lib-base";

export class WebUiStack extends cdk.Stack {

    readonly targetBucket: Bucket;
    readonly userPool: UserPool;
    readonly webDomain: string;
    readonly userPoolDomain: string;
    readonly authEnver: OdmdEnverUserAuth;

    constructor(scope: Construct, id: string, props: cdk.StackProps & {
        bucket: Bucket, userPool: UserPool, userPoolDomain: string, webDomain: string, authEnver: OdmdEnverUserAuth
    }) {
        super(scope, id, props);
        this.targetBucket = props.bucket;
        this.userPool = props.userPool;
        this.userPoolDomain = props.userPoolDomain;
        this.webDomain = props.webDomain;
        this.authEnver = props.authEnver;
    }

    async buildWebUiAndDeploy() {

        const webDeployment = new s3deploy.BucketDeployment(this, 'DeployWebsite', {
            sources: [s3deploy.Source.asset('webui/dist')],
            destinationBucket: this.targetBucket,
        });

        const assumeRoleResponse = await new STSClient({region: this.region}).send(new AssumeRoleCommand({
            RoleArn: this.authEnver.centralRoleArn,
            RoleSessionName: 'getValsFromCentral'
        }));
        const credentials = assumeRoleResponse.Credentials!;
        const now = new Date().toISOString();

        const csDeployRslt = await Promise.allSettled([this.authEnver.targetAWSRegion, 'us-west-1']
            .map(async region => {

                try {
                const visDataGqlUrl = await this.getVisDataAndGqUrl(credentials, region,
                        this.authEnver.appsyncGraphqlUrl.toSharePath(),
                        `/odmd-share/${this.authEnver.owner.buildId}/${this.authEnver.targetRevision.toPathPartStr()}/centralBucketName`);
                visDataGqlUrl.push(now)

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
                } catch (e) {
                    console.error(`>>>!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!region: ${region} NOT READY !!!!!!!!!!!!!!!!!!!!!` + e)
                    console.error(e)
                    console.error(`<<<!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!region: ${region} NOT READY !!!!!!!!!!!!!!!!!!!!!` + e)
        }
            }))
        const rejected = csDeployRslt.find(d => d.status == 'rejected');
        if (rejected) {
            console.log(rejected.reason)
            console.warn(`could because the region's appsync never got deployed ... ?`)
        }

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
                this.authEnver.idProviderClientId.toSharePath(),
                this.authEnver.idProviderName.toSharePath(),
                this.authEnver.identityPoolId.toSharePath(),
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
        obj.pub_time = now

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
            })
        )
        console.log(JSON.stringify(regionParamOut, null, 2))

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
