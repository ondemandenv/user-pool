import {DocumentNode} from 'graphql';
import {print} from 'graphql';
import {AwsCredentialIdentity} from "@aws-sdk/types";
import {SignatureV4} from "@aws-sdk/signature-v4";
import {Sha256} from "@aws-crypto/sha256-js";

interface GraphQLResponse<T = any> {
    data?: T;
    errors?: Array<{
        message: string;
        locations?: Array<{ line: number; column: number }>;
        path?: Array<string | number>;
    }>;
}

interface GraphQLRequest {
    query: string;
    variables?: Record<string, any>;
    operationName?: string;
}


export class HttpGraphQLClient {
    private static instance: HttpGraphQLClient | null = null;
    private credentials: AwsCredentialIdentity;
    private signer: SignatureV4;
    private httpEndpoint: string;

    private static _inst: HttpGraphQLClient;

    static get inst(): HttpGraphQLClient {
        return this._inst
    }

    readonly region:string
    constructor(credentials: AwsCredentialIdentity,
                        httpEndpoint: string,
                        region: string
    ) {
        this.region = region;
        this.httpEndpoint = httpEndpoint;
        this.credentials = credentials;
        this.signer = new SignatureV4({
            credentials: this.credentials,
            region,
            service: 'appsync',
            sha256: Sha256
        });
        if (HttpGraphQLClient._inst) {
            throw new Error('singleton')
        }
        HttpGraphQLClient._inst = this
    }

    private async signHttpRequest(body: string) {
        const endpoint = new URL(this.httpEndpoint);
        const request = {
            method: 'POST',
            protocol: 'https:',
            hostname: endpoint.hostname,
            path: '/graphql',
            headers: {
                'Content-Type': 'application/json',
                'host': endpoint.hostname
            },
            body
        };

        return await this.signer.sign(request);
    }

    async query<T = any>(options: {
        query: DocumentNode;
        variables?: Record<string, any>
    }): Promise<GraphQLResponse<T>> {
        const queryString = print(options.query);

        try {
            const request: GraphQLRequest = {
                query: queryString,
                variables: options.variables
            };

            const signedRequest = await this.signHttpRequest(JSON.stringify(request));
            const signedHeaders = signedRequest.headers as Record<string, string>;

            const response = await fetch(this.httpEndpoint, {
                method: 'POST',
                headers: signedHeaders,
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`GraphQL request failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('GraphQL query error:', error);
            throw error;
        }
    }
} 