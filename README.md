# AWS CDK Application-Centric Infrastructure Project

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![AWS CDK](https://img.shields.io/badge/AWS_CDK-2.x-FF9900.svg?logo=amazon-aws)

An end-to-end vertical implementation demonstrating application-centric AWS infrastructure with cross-stack dependencies management and contract-based configuration sharing.






## 📋 Overview

This project demonstrates best practices for:
- Building secure web application infrastructure with AWS CDK
- Managing cross-stack dependencies using contract interfaces
- Automated deployment of static web assets with S3/CloudFront
- Secure authentication integration with Cognito User Pools
- Configuration sharing between backend and frontend components

## ✨ Key Features

- **Infrastructure-as-Code** with AWS CDK TypeScript
- **Cognito User Pool** management with OAuth2 integration
- **Automated Web Hosting** with S3 + CloudFront
- **Contract-based Configuration Sharing** between stacks
- **Production-ready Security** configurations
- **Cross-Stack Dependency Management** using `OdmdShareOut`
- **CI/CD Ready** structure

## 🏗️ Architecture Components

### Core Stacks

1. **UserPoolStack**
    - Cognito User Pool configuration
    - App client creation with OAuth2 settings
    - Configuration publishing via `OdmdShareOut`

2. **WebHostingStack**
    - S3 Bucket for static assets
    - CloudFront distribution with HTTPS
    - Domain configuration (optional)

3. **WebUIStack**
    - Frontend deployment automation
    - Configuration injection from other stacks
    - CI/CD pipeline integration (example)

### Cross-Stack Integration

```typescript
// Example contract-based configuration sharing
const myEnver = OndemandContractsSandbox.inst.getTargetEnver() as OdmdEnverUserAuthSbx;

new OdmdShareOut(this, new Map<OdmdCrossRefProducer<OdmdEnverUserAuth>, any>([
    [myEnver.idProviderName, `cognito-idp.${Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`],
    [myEnver.idProviderClientId, oauthUserpoolClient.userPoolClientId]
]));
```

https://web.auth.ondemandenv.link/
This is web console of https://github.com/ondemandenv which is an example usage of https://ondemandenv.dev

Read my articles to understand the design:
https://www.linkedin.com/in/garyy2011/recent-activity/all/