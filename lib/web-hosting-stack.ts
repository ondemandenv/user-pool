import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {ARecord, HostedZone, IHostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";
import {CloudFrontTarget} from "aws-cdk-lib/aws-route53-targets";
import {BlockPublicAccess, Bucket} from "aws-cdk-lib/aws-s3";
import {ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {Distribution, ViewerProtocolPolicy} from "aws-cdk-lib/aws-cloudfront";
import {S3BucketOrigin} from "aws-cdk-lib/aws-cloudfront-origins";
import {UserPoolStack} from "./user-pool-stack";


export class WebHostingStack extends cdk.Stack {

    readonly bucket: Bucket
    readonly webDomain: string

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.bucket = new Bucket(this, 'bucket', {
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        const zoneName = UserPoolStack.zoneName
        const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
            hostedZoneId: UserPoolStack.hostedZoneId,
            zoneName,
        });

        if (this.region == 'us-east-1') {

            this.bucket.grantRead(new ServicePrincipal('cloudfront.amazonaws.com'));

            const webSubdomain = 'web'
            const webSubFqdn = webSubdomain + '.' + zoneName
            this.webDomain = webSubFqdn

            const distribution = new Distribution(this, 'Distribution', {
                defaultBehavior: {
                    origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
                    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    compress: true
                },
                domainNames: [webSubFqdn],
                certificate: new Certificate(this, 'web-Certificate', {
                    domainName: webSubFqdn,
                    validation: CertificateValidation.fromDns(hostedZone)
                }),
                defaultRootObject: 'index.html'
            });


            new ARecord(this, 'WebsiteAliasRecord', {
                zone: hostedZone,
                target: RecordTarget.fromAlias(
                    new CloudFrontTarget(distribution)
                ),
                recordName: webSubdomain
            });
        } else {
            console.warn(`IGNOREING cloudfront because this region ${this.region} does not support`);
        }
    }


}
