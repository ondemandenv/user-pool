import {Entity} from "./gql/types.ts";

export interface OdmdConfig {
    IdentityPoolId: string;
    appsyncHttpEndpoint: string;
    appsyncWssEndpoint: string;
    "id-provider-clientId": string;
    "id-provider-name": string;
    userPoolId: string;
    userPoolDomain: string;
    webDomain: string;
    region: string;
    visData: Entity[];
}

export class ConfigService {
    private static instance: ConfigService;
    private config!: OdmdConfig;

    private constructor() {}

    public static async getInstance(): Promise<OdmdConfig> {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
            await ConfigService.instance.loadConfig();
        }
        return ConfigService.instance.config;
    }

    private async loadConfig(): Promise<void> {
        try {
            const response = await fetch('/config.json');
            if (!response.ok) throw new Error('Failed to load config');
            this.config = await response.json();
            console.log( this.config );
        } catch (error) {
            console.error('Error loading config:', error);
            throw error;
        }
    }

}