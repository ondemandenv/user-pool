import * as cdk from 'aws-cdk-lib';
import {AssetHashType, SecretValue, Stack} from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {Construct} from 'constructs';
import {
    OAuthScope,
    ProviderAttribute,
    UserPool,
    UserPoolClient,
    UserPoolClientIdentityProvider,
    UserPoolGroup,
    UserPoolIdentityProviderGoogle
} from "aws-cdk-lib/aws-cognito";
import {ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";
import {OdmdCrossRefProducer, OdmdEnverUserAuth, OdmdShareOut} from "@ondemandenv/contracts-lib-base";
import {UserPoolDomainTarget} from "aws-cdk-lib/aws-route53-targets";
import * as path from "node:path";
import {PolicyStatement} from "aws-cdk-lib/aws-iam";
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import {AwsSdkCall} from "aws-cdk-lib/custom-resources/lib/aws-custom-resource/aws-custom-resource";
import {GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET} from "../bin/user-pool";

export class UserPoolStack extends cdk.Stack {

    readonly hostedZoneId: string
    readonly zoneName: string

    readonly userPool: UserPool

    constructor(scope: Construct, id: string, props: cdk.StackProps & {
        hostedZoneId: string, zoneName: string, webSubFQDN: string, authEnver: OdmdEnverUserAuth
    }) {
        super(scope, id, props);
        this.hostedZoneId = props.hostedZoneId;
        this.zoneName = props.zoneName;

        this.userPool = new UserPool(this, 'Pool', {
            userPoolName: this.zoneName,
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
            }
        });
        const userPool = this.userPool

        // Create user pool group
        const userGroup = new UserPoolGroup(this, 'AppSyncUserGroup', {
            userPool: userPool,
            groupName: 'odmd-central-user',
            description: 'Group for ODMD users'
        });

        const callbackUrls = props.authEnver.callbackUrls.map(c => c.getSharedValue(this))
        callbackUrls.push('http://localhost:5173/index.html?callback')
        callbackUrls.push(`https://${props.webSubFQDN}/index.html?callback`)
        const logoutUrls = props.authEnver.logoutUrls.map(c => c.getSharedValue(this))
        logoutUrls.push('http://localhost:5173/index.html?logout')
        logoutUrls.push(`https://${props.webSubFQDN}/index.html?logout`)

        const oauthUserpoolClient = new UserPoolClient(this, 'UserPoolClient', {
            userPool,
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.PROFILE],
                callbackUrls,
                logoutUrls,
            },
            supportedIdentityProviders: [
                UserPoolClientIdentityProvider.GOOGLE,
            ],
        });

        oauthUserpoolClient.node.addDependency(new UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
            userPool,
            clientId: GOOGLE_OAUTH_CLIENT_ID,
            clientSecretValue: SecretValue.secretsManager(GOOGLE_OAUTH_CLIENT_SECRET ),
            scopes: ['email', 'profile', 'openid'],

            attributeMapping: {
                email: ProviderAttribute.GOOGLE_EMAIL,
                emailVerified: ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
                givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
                familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
            }
        }));

        const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
            hostedZoneId: this.hostedZoneId,
            zoneName: this.zoneName,
        });

        const domainName: string = /*'use1.' +*/ this.zoneName


        const domain = userPool.addDomain('AuthDomain', {
            customDomain: {
                domainName,
                certificate: new Certificate(this, 'Certificate', {
                    domainName,
                    validation: CertificateValidation.fromDns(hostedZone)
                }),
                // Custom domain is not a valid subdomain: Was not able to resolve a DNS A record for the parent domain or domain parent is a top-level domain. (Service: AWSCognitoIdentityProviderService; Status Code: 400; Error Code: InvalidParameterException; Request ID: 29547892-206c-43a9-bbcb-c3fcae498963; Proxy: null)
            },
            /*
            cognitoDomain: {
                domainPrefix: 'odmd-auth',
            }*/
        });

        new ARecord(this, 'CognitoDomainARecord', {
            zone: hostedZone,
            recordName: domainName,
            target: RecordTarget.fromAlias(
                new UserPoolDomainTarget(domain)
            )
        });

        const postConfirmFun = new lambda.Function(this, 'post-confirmation', {
            runtime: lambda.Runtime.PROVIDED_AL2023,
            handler: 'bootstrap',
            code: lambda.Code.fromAsset(path.join(__dirname, 'post-confirmation'), {
                assetHashType: AssetHashType.OUTPUT,
                bundling: {
                    image: lambda.Runtime.PROVIDED_AL2023.bundlingImage,
                    command: [
                        'bash',
                        '-c',
                        [
                            'cd /asset-input',
                            'go env -w GOPROXY=https://proxy.golang.org,direct',
                            'go mod download',
                            'go mod tidy',
                            'GOOS=linux GOARCH=amd64 go build -o /asset-output/bootstrap .'
                        ].join(' && ')
                    ],
                    user: 'root'
                }
            }),
            environment: {
                USER_POOL_ID: userPool.userPoolId,
                GROUP_NAME: userGroup.groupName,
            },
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            architecture: lambda.Architecture.X86_64

        })

        // Make sure the Lambda function depends on the user group to ensure proper creation order
        postConfirmFun.node.addDependency(userGroup);

        postConfirmFun.addToRolePolicy(new PolicyStatement({
            actions: ['cognito-idp:AdminAddUserToGroup'],
            resources: [userPool.userPoolArn]
        }));

        // Instead of direct trigger association:
        // userPool.addTrigger(UserPoolOperation.POST_CONFIRMATION, postConfirmFun);

        // Use a Custom Resource to associate the trigger after both resources are created
        const triggerAssociationRole = new iam.Role(this, 'TriggerAssociationRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        });

        triggerAssociationRole.addToPolicy(new iam.PolicyStatement({
            actions: ['cognito-idp:UpdateUserPool'],
            resources: [userPool.userPoolArn],
        }));

        // Create the custom resource to update the user pool with the trigger
        const callApi = {
            service: 'CognitoIdentityServiceProvider',
            action: 'updateUserPool',
            parameters: {
                UserPoolId: userPool.userPoolId,
                LambdaConfig: {
                    PostConfirmation: postConfirmFun.functionArn
                }
            },
            physicalResourceId: cr.PhysicalResourceId.of('UserPoolTriggerAssociation'),
        } as AwsSdkCall;
        const triggerAssociation = new cr.AwsCustomResource(this, 'AssociatePostConfirmationTrigger', {
            onCreate: callApi,
            onUpdate: callApi,
            policy: cr.AwsCustomResourcePolicy.fromStatements([
                new iam.PolicyStatement({
                    actions: ['cognito-idp:UpdateUserPool'],
                    resources: [userPool.userPoolArn],
                }),
            ]),
            role: triggerAssociationRole,
        });

        new lambda.CfnPermission(this, 'CognitoInvokePermission', {
            action: 'lambda:InvokeFunction',
            functionName: postConfirmFun.functionName,
            principal: 'cognito-idp.amazonaws.com',
            sourceArn: userPool.userPoolArn,
        });

        triggerAssociation.node.addDependency(userPool);
        triggerAssociation.node.addDependency(postConfirmFun);

        new OdmdShareOut(this, new Map<OdmdCrossRefProducer<OdmdEnverUserAuth>, any>([
            [props.authEnver.idProviderName, `cognito-idp.${Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`],
            [props.authEnver.idProviderClientId, oauthUserpoolClient.userPoolClientId]
        ]))

        new cdk.CfnOutput(this, 'UserPoolId', {value: userPool.userPoolId});
        new cdk.CfnOutput(this, 'UserPoolClientId', {value: oauthUserpoolClient.userPoolClientId});
        new cdk.CfnOutput(this, 'UserPoolDomainName', {value: domain.domainName});

    }
}
