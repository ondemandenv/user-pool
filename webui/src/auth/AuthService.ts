import {CognitoIdentityClient} from "@aws-sdk/client-cognito-identity";
import {fromCognitoIdentityPool} from "@aws-sdk/credential-provider-cognito-identity";
import {AwsCredentialIdentity} from "@aws-sdk/types";
import {OdmdConfig} from "../OdmdConfig.ts";

interface UserInfo {
    name: string;
    email: string;
    picture?: string;
}

export class AuthService {

    private static _inst: AuthService;

    public static get instance(): AuthService {
        return this._inst
    }

    constructor(config: OdmdConfig) {
        if (AuthService._inst) {
            throw new Error("AuthService._inst must be singleton");
        }
        AuthService._inst = this;
        this.authConfig.userPoolId = config.userPoolId;
        this.authConfig.clientId = config["id-provider-clientId"];
        this.authConfig.region = config.region;
        this.authConfig.identityPoolId = config.IdentityPoolId
        this.authConfig.domain = config.userPoolDomain
        this.authConfig.redirectUri = config.webDomain == 'localhost'
            ? 'http://localhost:5173/callback' : `https://${config.webDomain}/index.html/callback`
        this.authConfig.tokenRefreshInterval = 20 * 60 * 1000
        this.authConfig.scope = 'email profile openid'
    }

    private _credentials: AwsCredentialIdentity | null = null;
    get credentials(): AwsCredentialIdentity | null {
        return this._credentials;
    }

    private userInfo: UserInfo | null = null;
    private tokenRefreshTimeout?: number;
    readonly authConfig = {} as {
        userPoolId: string,
        clientId: string,
        region: string,
        identityPoolId: string,
        domain: string,

        redirectUri: string,
        scope: string,

        tokenRefreshInterval: number
    }


    initiateGoogleLogin() {
        const state = this.generateRandomState();
        localStorage.setItem('oauth_state', state);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.authConfig.clientId,
            redirect_uri: this.authConfig.redirectUri,
            scope: this.authConfig.scope,
            state,
            identity_provider: 'Google'
        });

        window.location.href = `https://${this.authConfig.domain}/oauth2/authorize?${params.toString()}`;
    }

    private generateRandomState(): string {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async handleCallback(params: URLSearchParams) {
        const storedState = localStorage.getItem('oauth_state');
        const returnedState = params.get('state');

        if (!storedState || storedState !== returnedState) {
            throw new Error('Invalid state parameter');
        }

        const code = params.get('code');
        if (!code) {
            throw new Error('No authorization code received');
        }

        // Exchange code for tokens
        const tokenResponse = await fetch(`https://${this.authConfig.domain}/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: this.authConfig.clientId,
                redirect_uri: this.authConfig.redirectUri,
                code
            })
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            throw new Error(`Failed to exchange code for tokens: ${error}`);
        }

        const tokens = await tokenResponse.json();
        const idToken = tokens.id_token;

        // Parse and store user info from ID token
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        this.userInfo = {
            name: payload.name,
            email: payload.email,
            picture: payload.picture
        };

        localStorage.setItem('id_token', idToken);
        localStorage.setItem('user_info', JSON.stringify(this.userInfo));

        await this.refreshCredentials();
        return this.userInfo;
    }

    async refreshCredentials() {
        const idToken = localStorage.getItem('id_token');
        if (!idToken) {
            this.logout();
            return null
        }

        const client = new CognitoIdentityClient({
            region: this.authConfig.region
        });


        try {
            /*same as GetIdCommand and then getCredentialsForIdentityCommand */
            this._credentials = await fromCognitoIdentityPool({
                client,
                identityPoolId: this.authConfig.identityPoolId,
                logins: {
                    [`cognito-idp.${this.authConfig.region}.amazonaws.com/${this.authConfig.userPoolId}`]: idToken
                }
            })();

            // Schedule next refresh
            if (this.tokenRefreshTimeout) {
                window.clearTimeout(this.tokenRefreshTimeout);
            }
            this.tokenRefreshTimeout = window.setTimeout(
                () => this.refreshCredentials(),
                this.authConfig.tokenRefreshInterval
            );

            return this._credentials;
        } catch (error) {
            console.error('Failed to refresh credentials:', error);
            this.logout();
            return null;
        }
    }

    logout() {
        localStorage.removeItem('id_token');
        localStorage.removeItem('user_info');
        localStorage.removeItem('oauth_state');
        if (this.tokenRefreshTimeout) {
            window.clearTimeout(this.tokenRefreshTimeout);
        }

        this._credentials = null;
        this.userInfo = null;
        window.location.href = '/';
    }

} 