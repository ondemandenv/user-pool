import {Entity} from "./gql/types.ts";

export interface AuthConfig {
    IdentityPoolId: string;
    "id-provider-clientId": string;
    "id-provider-name": string;
    userPoolId: string;
    userPoolDomain: string;
    webDomain: string;
    region: string;
}

export interface GqlConfig {
    appsyncGraphqlUrl: string;
    visData: Entity[];
    region: string;
}

export class ConfigService {
    private static instance: ConfigService;
    authConfig!: AuthConfig;
    gqlConfig!: GqlConfig;


    public static async getInstance(): Promise<ConfigService> {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
            await ConfigService.instance.loadConfig('us-west-1');
        }
        return ConfigService.instance;
    }

    private async loadConfig(region: 'us-west-1' | 'us-east-1'): Promise<void> {

        const arr = await Promise.all(
            ['/config.json', `/config_region/${region}.json`,].map(async p => {
                const response = await fetch(p);
                if (!response.ok) {
                    throw new Error('Failed to load config');
                }
                return await response.json();
            })
        )

        this.authConfig = arr[0] as AuthConfig;
        this.gqlConfig = {appsyncGraphqlUrl: arr[1][1], region, visData: arr[1][0]} as GqlConfig
    }

}