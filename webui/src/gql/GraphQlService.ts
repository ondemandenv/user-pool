import {AwsCredentialIdentity} from "@aws-sdk/types";
import {HttpGraphQLClient} from "./HttpGraphQLClient.ts";
import {WbskGraphQLClient} from "./WbskGraphQLClient.ts";
import {GqlConfig} from "../OdmdConfig.ts";

export class GraphQlService {

    readonly gqlConfig: {
        httpEndpoint: string,
        wssEndpoint: string,
        region: string,
    };
    static region: string;

    constructor(creds: AwsCredentialIdentity, config: GqlConfig) {
        const tmp = config.appsyncGraphqlUrl.replace('.appsync-api.', '.appsync-realtime-api.').split(':')
        tmp[0] = 'wss'
        this.gqlConfig = {
            httpEndpoint: config.appsyncGraphqlUrl,
            wssEndpoint: tmp.join(':'),
            region: config.region,
        }

        new HttpGraphQLClient(creds, this.gqlConfig.httpEndpoint, this.gqlConfig.region)
        new WbskGraphQLClient(creds, this.gqlConfig.httpEndpoint, this.gqlConfig.wssEndpoint, this.gqlConfig.region)
    }
}