import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";
import {CloudFrontTarget} from "aws-cdk-lib/aws-route53-targets";
import {BlockPublicAccess, Bucket} from "aws-cdk-lib/aws-s3";
import {ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {
    BehaviorOptions,
    CachePolicy,
    Distribution, OriginRequestCookieBehavior, OriginRequestHeaderBehavior,
    OriginRequestPolicy, OriginRequestQueryStringBehavior,
    ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import {S3BucketOrigin} from "aws-cdk-lib/aws-cloudfront-origins";


export class WebHostingStack extends cdk.Stack {

    readonly bucket: Bucket
    readonly webSubFQDN: string

    constructor(scope: Construct, id: string, props: cdk.StackProps & { zoneName: string, hostedZoneId: string }) {
        super(scope, id, props);

        this.bucket = new Bucket(this, 'bucket', {
            publicReadAccess: false,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'index.html'
        });

        const zoneName = props.zoneName
        const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
            hostedZoneId: props.hostedZoneId,
            zoneName,
        });

        if (this.region == 'us-east-1') {

            this.bucket.grantRead(new ServicePrincipal('cloudfront.amazonaws.com'));

            const webSubdomain = 'web'
            this.webSubFQDN = webSubdomain + '.' + zoneName

            const origin = S3BucketOrigin.withOriginAccessControl(this.bucket);


            const additionalBehaviors: { [key: string]: BehaviorOptions } = {};
            ['js', 'css', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'woff', 'woff2', 'ttf', 'eot',].map((ext) => {
                additionalBehaviors[`/*.${ext}`] = {
                    origin: origin,
                    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    compress: true,
                    cachePolicy: new CachePolicy(this, 'AssetsCachePolicy-' + ext, {
                        minTtl: cdk.Duration.days(1),
                        maxTtl: cdk.Duration.days(7),
                        defaultTtl: cdk.Duration.days(7),
                    })
                };
            });

            const idxPagePolicy = new CachePolicy(this, 'HtmlCachePolicy', {
                minTtl: cdk.Duration.seconds(0),
                maxTtl: cdk.Duration.minutes(2),
                defaultTtl: cdk.Duration.minutes(1),
            });
            const distribution = new Distribution(this, 'Distribution', {
                defaultBehavior: {
                    origin: origin,
                    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    compress: true
                },
                additionalBehaviors: {
                    ...additionalBehaviors,
                    '/index.html*': {
                        origin: origin,
                        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                        compress: true,
                        cachePolicy: idxPagePolicy
                    },
                    '/callback*': {
                        origin: origin,
                        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                        compress: true,
                        cachePolicy: idxPagePolicy,
                        originRequestPolicy: new OriginRequestPolicy(this, 'CallbackOriginRequestPolicy', {
                            queryStringBehavior: OriginRequestQueryStringBehavior.all(),
                            cookieBehavior: OriginRequestCookieBehavior.all(),
                            headerBehavior: OriginRequestHeaderBehavior.all()
                        })
                    },
                    '/logout*': {
                        origin: origin,
                        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                        compress: true,
                        cachePolicy: idxPagePolicy,
                        originRequestPolicy: new OriginRequestPolicy(this, 'LogoutOriginRequestPolicy', {
                            queryStringBehavior: OriginRequestQueryStringBehavior.all(),
                            cookieBehavior: OriginRequestCookieBehavior.all(),
                            headerBehavior: OriginRequestHeaderBehavior.all()
                        })
                    }
                },
                domainNames: [this.webSubFQDN],
                certificate: new Certificate(this, 'web-Certificate', {
                    domainName: this.webSubFQDN,
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
