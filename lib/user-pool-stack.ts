import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {
    OAuthScope, ProviderAttribute,
    UserPool,
    UserPoolClient,
    UserPoolClientIdentityProvider,
    UserPoolIdentityProviderGoogle
} from "aws-cdk-lib/aws-cognito";
import {SecretValue} from "aws-cdk-lib";
import {HostedZone} from "aws-cdk-lib/aws-route53";
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";
import {OndemandContractsSandbox} from "@ondemandenv/odmd-contracts-sandbox";
import {
    CognitoUserPoolEnver
} from "@ondemandenv/odmd-contracts-sandbox/lib/repos/user-pool/CognitoUserPoolCdkOdmdBuild";
import {OdmdCrossRefProducer, OdmdEnverCdk, OdmdShareOut} from "@ondemandenv/contracts-lib-base";

export class UserPoolStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const myEnver = OndemandContractsSandbox.inst.getTargetEnver() as CognitoUserPoolEnver

        const userPool = new UserPool(this, 'Pool', {
            userPoolName: 'auth.ondemandenv.link',
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

        const oauthUserpoolClient = new UserPoolClient(this, 'UserPoolClient', {
            userPool,
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.PROFILE],
                callbackUrls: [
                    // 'http://localhost:5173/callback',
                    ...myEnver.llmChatCallbackUrl.map(c => c.getSharedValue(this))
                ],
                logoutUrls: [
                    ...myEnver.llmChatLogoutUrl.map(c => c.getSharedValue(this))
                ],

            },
            supportedIdentityProviders: [
                UserPoolClientIdentityProvider.GOOGLE,
            ],
        });

        oauthUserpoolClient.node.addDependency(new UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
            userPool,
            clientId: '425156547044-a8gnro92fhtf6shstfrune7oc8i6i0hf.apps.googleusercontent.com',
            clientSecretValue: SecretValue.ssmSecure('/google_oauth_client_secret'),
            scopes: ['email', 'profile', 'openid'],

            attributeMapping: {
                email: ProviderAttribute.GOOGLE_EMAIL,
                emailVerified: ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
                givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
                familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
            }
        }));

        const hostedZoneId = 'Z07732022HSGPH3GRGCVY'
        const zoneName = 'auth.ondemandenv.link'

        const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
            hostedZoneId,
            zoneName,
        });

        const domainPrefix = 'odmd-sandbox';
        const domainName: string = domainPrefix + '.' + zoneName

        const domain = userPool.addDomain('AuthDomain', {
            cognitoDomain: {
                domainPrefix,
            },
            customDomain: {
                domainName,
                certificate: new Certificate(this, 'Certificate', {
                    domainName,
                    validation: CertificateValidation.fromDns(hostedZone)
                }),
            }
        });

        const resourceClient = new UserPoolClient(this, 'ResourceClient', {
            userPool: userPool,
            generateSecret: false,
            authFlows: {
                userSrp: true,
                userPassword: true,
            },
            preventUserExistenceErrors: true,
        });

        new OdmdShareOut(this, new Map<OdmdCrossRefProducer<CognitoUserPoolEnver>, any>([
            [myEnver.userPoolId, userPool.userPoolId],
            [myEnver.userPoolArn, userPool.userPoolArn],
            [myEnver.oauthUserPoolClientId, oauthUserpoolClient.userPoolClientId],
            [myEnver.oauth2RedirectUri, domain.baseUrl() + '/oauth2/idpresponse'],
            [myEnver.resourceUserPoolClientId, resourceClient.userPoolClientId],
        ]))

        new cdk.CfnOutput(this, 'UserPoolId', {value: userPool.userPoolId});
        new cdk.CfnOutput(this, 'UserPoolClientId', {value: oauthUserpoolClient.userPoolClientId});
        new cdk.CfnOutput(this, 'UserPoolDomainName', {value: domain.domainName});

    }
}
