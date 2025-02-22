import {AwsCredentialIdentity} from "@aws-sdk/types";
import {HttpGraphQLClient} from "./HttpGraphQLClient.ts";
import {WbskGraphQLClient} from "./WbskGraphQLClient.ts";
import {OdmdConfig} from "../OdmdConfig.ts";

export class GraphQlService {

    readonly gqlConfig:{
        httpEndpoint: string,
        wssEndpoint: string,
        region: string,
    };

    constructor(creds: AwsCredentialIdentity, config: OdmdConfig) {
        this.gqlConfig = {
            httpEndpoint: config.appsyncHttpEndpoint,
            wssEndpoint: config.appsyncWssEndpoint,
            region: config.region,
        }

        new HttpGraphQLClient(creds, this.gqlConfig.httpEndpoint, this.gqlConfig.region)
        new WbskGraphQLClient(creds, this.gqlConfig.httpEndpoint, this.gqlConfig.wssEndpoint, this.gqlConfig.region)
    }
}