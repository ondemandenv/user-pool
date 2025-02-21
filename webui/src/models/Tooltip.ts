import {OdmdNode} from './OdmdNode';

export interface TooltipOptions {
    content: string;
    style?: Partial<CSSStyleDeclaration>;
    showDelay?: number;
    hideDelay?: number;
}

export class Tooltip {
    private element: HTMLElement | null = null;
    private showTimeout: ReturnType<typeof setTimeout> | null = null;
    private hideTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private onClick: (event: MouseEvent) => void,
        private onMouseEnter: (event: MouseEvent) => void,
        private onMouseLeave: (event: MouseEvent) => void
    ) {
    }

    show(x: number, y: number, options: TooltipOptions): void {
        if (this.element || this.showTimeout) return;

        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        const showDelay = options.showDelay ?? 400;
        this.showTimeout = setTimeout(() => {
            this.showTimeout = null;
            this.element = document.createElement('div');
            this.element.className = 'node-tooltip';

            // Add content wrapper with non-interactable styles
            this.element.innerHTML = `
                <div class="tooltip-content">
                    ${options.content}
                </div>
            `;

            Object.assign(this.element.style, {
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                padding: '8px',
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                zIndex: OdmdNode.getNextZIndex(),
                cursor: 'pointer',
                ...options.style,
            });

            // Add non-selectable and click-through styles to content
            const contentElement = this.element.querySelector('.tooltip-content') as HTMLElement;
            if (contentElement) {
                Object.assign(contentElement.style, {
                    pointerEvents: 'none',
                    userSelect: 'none',
                    MozUserSelect: 'none',
                    WebkitUserSelect: 'none',
                    msUserSelect: 'none',
                });
            }

            this.element.addEventListener('click', this.onClick);
            this.element.addEventListener('mouseenter', (e) => {
                if (this.hideTimeout) {
                    clearTimeout(this.hideTimeout);
                    this.hideTimeout = null;
                }
                this.onMouseEnter(e);
            });
            this.element.addEventListener('mouseleave', (e) => {
                this.hide();
                this.onMouseLeave(e);
            });

            document.body.appendChild(this.element);
        }, showDelay);
        this.options = options
    }

    options: TooltipOptions | undefined = undefined

    hide(): void {
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
            this.showTimeout = null;
        }

        if (!this.element) return;

        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        const hideDelay = this.options?.hideDelay ?? 600;
        this.hideTimeout = setTimeout(() => {
            if (this.element) {
                this.element.remove();
                this.element = null;
            }
            this.hideTimeout = null;
        }, hideDelay);
    }

    getElement(): HTMLElement | null {
        return this.element;
    }
}