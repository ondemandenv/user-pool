import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Bucket} from "aws-cdk-lib/aws-s3";
import {OdmdEnverUserAuthSbx, OndemandContractsSandbox} from "@ondemandenv/odmd-contracts-sandbox";
import {AssumeRoleCommand, STSClient} from "@aws-sdk/client-sts";
import {GetParametersCommand, SSMClient} from "@aws-sdk/client-ssm";
import {Parameter} from "@aws-sdk/client-ssm/dist-types/models/models_1";
import {UserPool} from "aws-cdk-lib/aws-cognito";
import {AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId} from "aws-cdk-lib/custom-resources";

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

        const ps = await this.getParameterWithAssumedRole(myEnver.centralRoleArn, 'getValsFromCentral',
            [
                myEnver.idProviderClientId.toSharePath(),
                myEnver.idProviderName.toSharePath(),
                myEnver.appsyncWssEndpoint.toSharePath(),
                myEnver.appsyncHttpEndpoint.toSharePath(),
                myEnver.identityPoolId.toSharePath(),
            ])

        const obj = {} as { [k: string]: string };
        ps.forEach(p => {
            obj[p.Name?.split('/').at(-1) as string] = p.Value!
        })

        obj.userPoolId = this.userPool.userPoolId

        const configParams = {
            Bucket: this.targetBucket.bucketName,
            Key: 'config.json',
            Body: JSON.stringify(obj),
            ContentType: 'application/json'
        };
        new AwsCustomResource(this, 'S3PutObject', {
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


        new s3deploy.BucketDeployment(this, 'DeployWebsite', {
            sources: [s3deploy.Source.asset('webui/dist')],
            destinationBucket: this.targetBucket,
        });

    }

    async getParameterWithAssumedRole(
        roleArn: string,
        roleSessionName: string,
        parameterPaths: string[]
    ): Promise<Parameter[]> {
        const stsClient = new STSClient({region: "us-east-1"});
        const assumeRoleCommand = new AssumeRoleCommand({
            RoleArn: roleArn,
            RoleSessionName: roleSessionName
        });

        try {
            const assumeRoleResponse = await stsClient.send(assumeRoleCommand);
            const credentials = assumeRoleResponse.Credentials!;

            const ssmClient = new SSMClient({
                region: this.region,
                credentials: {
                    accessKeyId: credentials.AccessKeyId!,
                    secretAccessKey: credentials.SecretAccessKey!,
                    sessionToken: credentials.SessionToken
                },
            });

            const getParameterCommand = new GetParametersCommand({
                Names: parameterPaths,
                WithDecryption: true
            });

            const parameter = await ssmClient.send(getParameterCommand);
            return parameter.Parameters!;
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }
}
