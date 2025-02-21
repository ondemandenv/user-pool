import {GetParametersCommand, Parameter, SSMClient} from "@aws-sdk/client-ssm";
import {AuthService} from "../auth/AuthService.ts";


export class ParamService {
    private static instance: ParamService;
    private ssmClient: SSMClient;
    readonly queuedNames = new Array<string>()

    constructor() {
        if (ParamService.instance) {
            throw new Error('Use ParamService.getInstance() instead');
        }
        ParamService.instance = this;

        this.ssmClient = new SSMClient({
            region: AuthService.instance.authConfig.region,
            credentials: AuthService.instance.credentials!
        });
    }

    public static getInstance(): ParamService {
        if (!ParamService.instance) {
            ParamService.instance = new ParamService();
        }
        return ParamService.instance;
    }

    private _nameToHandler = new Map<string, (callback: Parameter | string) => void>()

    public fetchParams(names: string[], handler: (callback: Parameter | string) => void): void {
        [...new Set(names)].forEach(name => {
            if (this.queuedNames.indexOf(name) < 0){
                this._nameToHandler.set(name, handler)
                this.queuedNames.push(name);
            }
        });
        this.processQueue();
    }

    private batch: string[] = []

    private async processQueue(): Promise<void> {
        if (this.queuedNames.length === 0 || this.batch.length > 0) return;

        this.batch = this.queuedNames.slice(0, 10);
        const response = await this.ssmClient.send(new GetParametersCommand({
            Names: this.batch,
            WithDecryption: true
        }));

        this.batch.forEach(name => {
            const param = response.Parameters?.find(p => p.Name === name);
            // response.InvalidParameters?.includes(name)
            try {
                this._nameToHandler.get(name)!(param ?? name)
                this._nameToHandler.delete(name)
                this.queuedNames.splice(this.queuedNames.indexOf(name), 1);
                console.log(`this._nameToHandler.delete(name): ${name}`)
            } catch (e) {
                console.error(e)
            }

        });
        this.batch = []
        this.processQueue()
    }
}