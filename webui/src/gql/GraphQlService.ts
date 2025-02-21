import {AwsCredentialIdentity} from "@aws-sdk/types";
import {HttpGraphQLClient} from "./HttpGraphQLClient.ts";
import {WbskGraphQLClient} from "./WbskGraphQLClient.ts";

export class GraphQlService {

    readonly gqlConfig = {
        httpEndpoint: 'https://yoxv25yb75hgzgrrqs4xksqzei.appsync-api.us-east-1.amazonaws.com/graphql',
        wssEndpoint: 'wss://yoxv25yb75hgzgrrqs4xksqzei.appsync-realtime-api.us-east-1.amazonaws.com/graphql',
        region: 'us-east-1',
    };


    constructor(creds: AwsCredentialIdentity) {
        new HttpGraphQLClient(creds, this.gqlConfig.httpEndpoint, this.gqlConfig.region)
        new WbskGraphQLClient(creds, this.gqlConfig.httpEndpoint, this.gqlConfig.wssEndpoint, this.gqlConfig.region)
    }
}