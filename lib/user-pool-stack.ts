import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {
    OAuthScope, ProviderAttribute,
    UserPool,
    UserPoolClient,
    UserPoolClientIdentityProvider,
    UserPoolIdentityProviderGoogle
} from "aws-cdk-lib/aws-cognito";
import {SecretValue, Stack} from "aws-cdk-lib";
import {ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";
import {OdmdEnverUserAuthSbx, OndemandContractsSandbox} from "@ondemandenv/odmd-contracts-sandbox";
import {OdmdCrossRefProducer, OdmdShareOut} from "@ondemandenv/contracts-lib-base";
import {UserPoolDomainTarget} from "aws-cdk-lib/aws-route53-targets";

export class UserPoolStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const myEnver = OndemandContractsSandbox.inst.getTargetEnver() as OdmdEnverUserAuthSbx

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
                    'http://localhost:5173/callback',
                    // ...myEnver.llmChatCallbackUrl.map(c => c.getSharedValue(this))
                ],
                logoutUrls: [
                    'http://localhost:5173/callback',
                    // ...myEnver.llmChatLogoutUrl.map(c => c.getSharedValue(this))
                ],

            },
            supportedIdentityProviders: [
                UserPoolClientIdentityProvider.GOOGLE,
            ],
        });

        oauthUserpoolClient.node.addDependency(new UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
            userPool,
            clientId: '425156547044-a8gnro92fhtf6shstfrune7oc8i6i0hf.apps.googleusercontent.com',
            clientSecretValue: SecretValue.secretsManager('google_oauth_client_secret'),
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

        const domainName: string = /*'use1.' +*/ zoneName


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

        new OdmdShareOut(this, new Map<OdmdCrossRefProducer<OdmdEnverUserAuthSbx>, any>([
            [myEnver.idProviderName, `cognito-idp.${Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`],
            [myEnver.idProviderClientId, oauthUserpoolClient.userPoolClientId],
        ]))

        new cdk.CfnOutput(this, 'UserPoolId', {value: userPool.userPoolId});
        new cdk.CfnOutput(this, 'UserPoolClientId', {value: oauthUserpoolClient.userPoolClientId});
        new cdk.CfnOutput(this, 'UserPoolDomainName', {value: domain.domainName});

    }
}
