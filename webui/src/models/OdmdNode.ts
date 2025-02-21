import {NodeOptions, Node} from 'vis-network';
import {OdmdEdge} from './OdmdEdge';
import {WbskGraphQLClient} from "../gql/WbskGraphQLClient";
import {Entity} from "../gql/types";
import {OnEntityChangedById} from "../gql/ops";
import {NetworkGraph} from "../NetworkGraph";
import {FloatingWindow} from "./FloatingWindow";
import {Tooltip, TooltipOptions} from "./Tooltip";
import {OdmdMenu} from "./OdmdMenu.ts";
import {AuthService} from "../auth/AuthService.ts";
import {Parameter} from "@aws-sdk/client-ssm";

export interface MenuItem {
    icon?: string;
    label: string;
    action: () => void;
}

export interface MenuOptions {
    items: MenuItem[];
    style?: Partial<CSSStyleDeclaration>;
}

export abstract class OdmdNode<T extends FloatingWindow<OdmdNode<T>>> {
    entity: Entity;
    private tooltip: Tooltip | null = null;
    protected floatingWindow: T | null = null;
    readonly graph: NetworkGraph;
    private menu: OdmdMenu | null = null;
    private static topZIndex: number = 1000;
    private _physicsEnabled = false;

    constructor(entity: Entity, networkManager: NetworkGraph) {
        this.entity = entity;
        this.graph = networkManager;
    }
    readonly parameters = new Map<string, Parameter>();

    abstract getVisualOptions(): NodeOptions;

    abstract getTooltipOptions(): TooltipOptions;

    abstract getMenuOptions(): MenuOptions;

    getNodeData(): Node {
        return {
            id: this.entity.id,
            label: this.entity.id,
            title: this.getTooltipOptions().content,
            ...this.getVisualOptions(),
        };
    }

    focusNode(x: number, y: number) {
        if (this.graph.network) {

            //@ts-ignore
            const container = this.graph.network.body.container;

            const offsetX = x - container.offsetWidth / 2;
            const offsetY = y - container.offsetHeight / 2;

            this.graph.network.focus(this.entity.id, {
                scale: 1.5,
                animation: true,
                offset: {
                    x: offsetX - 25,
                    y: offsetY - 25
                }
            });
        }
    }

    showTooltip(x: number, y: number) {
        if (!this.tooltip) {
            this.tooltip = new Tooltip(
                (e) => this.handleTooltipClick(e),
                (e) => this.handleTooltipMouseEnter(e),
                (e) => this.handleTooltipMouseLeave(e)
            );
        }
        this.tooltip.show(x, y, this.getTooltipOptions());
    }

    private handleTooltipClick(e: MouseEvent) {
        e.stopPropagation();
        const rect = this.tooltip!.getElement()?.getBoundingClientRect();
        if (!rect) return;
        this.hideTooltip();
        this.showFloatingWindow(rect.left, rect.top);
    }

    private handleTooltipMouseEnter(e: MouseEvent) {
        this.tooltip?.getElement()?.classList.add('active');
    }

    private handleTooltipMouseLeave(e: MouseEvent) {
        const element = this.tooltip?.getElement();
        if (element && !element.classList.contains('transforming')) {
            element.classList.remove('active');
            this.hideTooltip();
        }
    }

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.hide();
        }
    }

    showFloatingWindow(x: number, y: number) {
        if (!this.floatingWindow) {
            this.floatingWindow = this.createFloatingWindow()
        }
        this.floatingWindow.show(x, y);
    }

    abstract createFloatingWindow(): T

    hideFloatingWindow() {
        if (this.floatingWindow) {
            this.floatingWindow.hide();
            this.floatingWindow = null;
        }
    }

    toggleMenu(x: number, y: number) {
        if (this.menu) {
            this.hideMenu();
            return;
        }

        const options = this.getMenuOptions();
        this.menu = new OdmdMenu(options);
        this.menu.show(x, y);
    }

    private hideMenu() {
        if (this.menu) {
            this.menu.hide();
            this.menu = null;
        }
    }

    protected addChildNode(node: OdmdNode<FloatingWindow<any>>) {
        this.graph?.addNode(node);
    }

    protected addEdge(edge: OdmdEdge) {
        return this.graph?.addEdge(edge);
    }

    public async cleanup() {
        if (this.unsubscribe) {
            this.unsubscribe!();
            console.log(`unsubscribe-> ${this.entity.id}`);
            this.unsubscribe = undefined
        }
    }


    abstract onReady(): void

    abstract onData(change: {
        operation: 'Delete' | 'Update' | 'Create'
        name: string
        type: string
    }): void

    onError(error: any): void {
        console.error(error);
    }

    onComplete(): void {
        console.log('complete');
    }

    unsubscribe?: () => void

    async subscribe() {
        if (this.unsubscribe) {
            return
        }
        console.log(this + `: subscribing-> ${this.entity.id}`);
        let inst = WbskGraphQLClient.inst;
        this.unsubscribe = await inst.subscribe({
            query: OnEntityChangedById,
            variables: {id: this.entity.id},
        }, {
            onSubscribed: this.onReady.bind(this),
            onData: (
                p: {
                    "onEntityChanged": {
                        "id": string,
                        "content": string
                    }
                }
            ) => this.onData(JSON.parse(p.onEntityChanged.content)),
            onComplete: this.onComplete.bind(this),
            onError: this.onError.bind(this)
        });
    }

    private static _entities = new Array<Entity>();
    static get entities() {
        return this._entities;
    }

    public togglePhysicsLock(physicsEnabled: boolean | undefined = undefined) {
        if (physicsEnabled == undefined) {
            physicsEnabled = !this._physicsEnabled;
        }
        this._physicsEnabled = physicsEnabled;

        this.graph.network.updateClusteredNode(this.entity.id, {
            physics: this._physicsEnabled
        });
    }

    static getNextZIndex(): number {
        return ++OdmdNode.topZIndex;
    }
}