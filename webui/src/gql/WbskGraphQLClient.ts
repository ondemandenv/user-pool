import {DocumentNode} from 'graphql';
import {print} from 'graphql';
import {AwsCredentialIdentity} from "@aws-sdk/types";
import {SignatureV4} from "@aws-sdk/signature-v4";
import {Sha256} from "@aws-crypto/sha256-js";
import {HttpRequest} from '@aws-sdk/protocol-http';

interface SubscriptionHandlers<T> {
    onSubscribed: () => void;
    onData: (data: T) => void;
    onError?: (error: any) => void;
    onComplete?: () => void;
}

interface GraphQLError {
    errorType: string;
    message: string;
}

interface SignedRequestConfig {
    path: string;
    payload: string;
    additionalHeaders?: Record<string, string>;
}

export class WbskGraphQLClient {
    private ws: WebSocket | null = null;
    private credentials: AwsCredentialIdentity;
    private subscriptions: Map<string, SubscriptionHandlers<any>> = new Map();
    private connectionPromise: Promise<void> | null = null;
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 3;
    private readonly RECONNECT_DELAY_BASE = 1000;
    private readonly wssEndpoint: string;
    private readonly httpEndpoint: string;
    private readonly region: string;
    private readonly signer: SignatureV4;

    private static _inst: WbskGraphQLClient;
    static get inst(): WbskGraphQLClient {
        return this._inst
    }

    constructor(credentials: AwsCredentialIdentity,
                httpEndpoint: string,
                wssEndpoint: string,
                region: string) {
        this.credentials = credentials;
        this.wssEndpoint = wssEndpoint
        this.httpEndpoint = httpEndpoint
        this.region = region;
        this.signer = new SignatureV4({
            credentials: this.credentials,
            region: this.region,
            service: 'appsync',
            sha256: Sha256
        });
        console.log('[WebSocketGraphQLClient] Initialized with config:', {
            region: this.region,
            wssEndpoint: this.wssEndpoint,
            httpEndpoint: this.httpEndpoint
        });
        if (WbskGraphQLClient._inst) {
            throw new Error('WbskGraphQLClient Singleton')
        }
        WbskGraphQLClient._inst = this;
    }

    private async getSignedHeaders({
                                       path,
                                       payload,
                                       additionalHeaders = {}
                                   }: SignedRequestConfig): Promise<Record<string, string>> {
        const host = new URL(this.httpEndpoint).host;
        const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');

        // Calculate content hash
        const msgBuffer = new TextEncoder().encode(payload);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashHex = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const headers: Record<string, string> = {
            host,
            'content-type': 'application/json',
            'x-amz-date': datetime,
            'x-amz-content-sha256': hashHex,
            ...additionalHeaders
        };

        if (this.credentials.sessionToken) {
            headers['x-amz-security-token'] = this.credentials.sessionToken;
        }

        const signedRequest = await this.signer.sign(new HttpRequest({
            method: 'POST',
            headers,
            hostname: host,
            path,
            body: payload
        }));

        return Object.entries(signedRequest.headers).reduce((acc, [key, value]) => {
            acc[key.toLowerCase()] = value;
            return acc;
        }, {} as Record<string, string>);
    }

    async connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN) return;
        if (this.connectionPromise) return this.connectionPromise;

        console.log('[WebSocketGraphQLClient] Initiating connection');
        this.connectionPromise = new Promise(async (resolve, reject) => {
            try {
                const signedHeaders = await this.getSignedHeaders({
                    path: '/graphql/connect',
                    payload: '{}'
                });

                const headerObj = {
                    host: signedHeaders.host,
                    'content-type': signedHeaders['content-type'],
                    'x-amz-content-sha256': signedHeaders['x-amz-content-sha256'],
                    'x-amz-date': signedHeaders['x-amz-date'],
                    'x-amz-security-token': signedHeaders['x-amz-security-token'],
                    authorization: signedHeaders.authorization
                };

                const wsUrl = `${this.wssEndpoint}?header=${btoa(JSON.stringify(headerObj))}&payload=e30=`;
                this.ws = new WebSocket(wsUrl, ['graphql-ws']);

                this.ws.onopen = () => {
                    console.log('[WebSocketGraphQLClient] Connection opened');
                    this.ws?.send(JSON.stringify({type: 'connection_init', payload: {}}));
                };

                this.ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    console.log('[WebSocketGraphQLClient] Message received:', {type: message.type});

                    switch (message.type) {
                        case 'connection_ack':
                            this.reconnectAttempts = 0;
                            resolve();
                            break;
                        case 'start_ack':
                            this.handleOnSubscribed(message);
                            break;
                        case 'data':
                            this.handleSubscriptionData(message);
                            break;
                        case 'error':
                            this.handleError(message);
                            break;
                        case 'complete':
                            this.handleComplete(message);
                            break;
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('[WebSocketGraphQLClient] WebSocket error:', error);
                    reject(error);
                };

                this.ws.onclose = (event) => {
                    console.log('[WebSocketGraphQLClient] Connection closed:', {
                        code: event.code,
                        reason: event.reason
                    });
                    this.handleConnectionClose();
                };


            } catch (error) {
                console.error('[WebSocketGraphQLClient] Connection failed:', error);
                this.connectionPromise = null;
                reject(error);
            }
        });

        return this.connectionPromise;
    }


    private handleOnSubscribed(message: { id: string }): void {
        if (!message.id) return;

        const subscription = this.subscriptions.get(message.id);
        if (subscription) {
            console.log('[WebSocketGraphQLClient] handleOnSubscribed ');
            subscription.onSubscribed();
        }

    }

    private handleSubscriptionData(message: any): void {
        if (!message.id) return;

        const subscription = this.subscriptions.get(message.id);
        if (subscription) {
            console.log('[WebSocketGraphQLClient] Subscription data:', {
                id: message.id,
                dataPreview: JSON.stringify(message.payload.data).slice(0, 100)
            });
            subscription.onData(message.payload.data);
        }
    }

    private handleError(message: any): void {
        if (message.id) {
            const subscription = this.subscriptions.get(message.id);
            if (subscription?.onError) {
                subscription.onError(new Error(JSON.stringify(message.payload)));
            }
        }
        console.error('[WebSocketGraphQLClient] Error:', message.payload);
    }

    private handleComplete(message: any): void {
        if (!message.id) return;

        const subscription = this.subscriptions.get(message.id);
        if (subscription?.onComplete) {
            subscription.onComplete();
        }
        this.subscriptions.delete(message.id);
    }

    private handleConnectionClose(): void {
        this.connectionPromise = null;

        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            const delay = Math.min(
                this.RECONNECT_DELAY_BASE * Math.pow(2, this.reconnectAttempts),
                5000
            );
            setTimeout(() => this.connect(), delay);
        }
    }

    async subscribe<T = any>(
        options: {
            query: DocumentNode;
            variables?: Record<string, any>;
            operationName?: string;
        },
        handlers: SubscriptionHandlers<T>
    ): Promise<() => void> {
        // await this.connect();
        if (!this.ws) throw new Error('WebSocket connection not established');

        const subscriptionId = crypto.randomUUID()
        this.subscriptions.set(subscriptionId, handlers)

        const queryString = print(options.query);
        const payload = JSON.stringify({
            query: queryString,
            variables: options.variables || {}
        });

        const signedHeaders = await this.getSignedHeaders({
            path: '/graphql',
            payload,
            additionalHeaders: {
                'accept': 'application/json, text/javascript',
                'content-encoding': 'amz-1.0',
                'content-type': 'application/json; charset=UTF-8'
            }
        });

        const subscriptionMessage = {
            id: subscriptionId,
            type: 'start',
            payload: {
                data: payload,
                extensions: {
                    authorization: {
                        ...signedHeaders,
                        Authorization: signedHeaders.authorization
                    }
                }
            }
        };

        console.log('[WebSocketGraphQLClient] Starting subscription:', {
            id: subscriptionId,
            operationName: options.operationName
        });

        this.ws.send(JSON.stringify(subscriptionMessage));

        return async () => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({id: subscriptionId, type: 'stop'}));
            }
            this.subscriptions.delete(subscriptionId);
        };
    }

    async dispose(): Promise<void> {
        this.subscriptions.clear();
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.close(1000, 'Client disposed');
        }
        this.ws = null;
        console.log('[WebSocketGraphQLClient] Disposed');
    }
} 