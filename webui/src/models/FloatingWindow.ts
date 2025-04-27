import {OdmdNode} from "./OdmdNode";
import {Parameter} from "@aws-sdk/client-ssm";
import {TooltipWindow} from "./TooltipWindow";

export interface FloatingWindowOptions {
    title: string;
    content: string;
    windowStyle?: Partial<CSSStyleDeclaration>;
    headerStyle?: Partial<CSSStyleDeclaration>;
    contentStyle?: Partial<CSSStyleDeclaration>;
    buttons?: {
        close?: Partial<{
            style: Partial<CSSStyleDeclaration>;
            icon: string;
            visible: boolean;
        }>;
        focus?: Partial<{
            style: Partial<CSSStyleDeclaration>;
            icon: string;
            visible: boolean;
        }>;
        menu?: Partial<{
            style: Partial<CSSStyleDeclaration>;
            icon: string;
            visible: boolean;
        }>;
    };
    headerHTML?: string;
    contentHTML?: string;
}

export abstract class FloatingWindow<T extends OdmdNode<FloatingWindow<T>>> {
    protected element: HTMLElement;
    protected headerElement: HTMLElement;
    protected contentElement: HTMLElement;
    protected closeButton?: HTMLButtonElement;
    protected focusButton?: HTMLButtonElement;
    protected menuButton?: HTMLButtonElement;

    private isDragging = false;
    private startX = 0;
    private startY = 0;

    constructor(protected readonly node: T) {
        const options = this.refreshWindowOptions();

        // Create main window element
        this.element = this.createWindowElement(options);

        // Create header with buttons
        const {header, closeButton, focusButton, menuButton} = this.createHeader(options);
        this.headerElement = header;
        this.closeButton = closeButton;
        this.focusButton = focusButton;
        this.menuButton = menuButton;

        this.contentElement = document.createElement('div');
        this.contentElement.className = 'window-content';
        Object.assign(this.contentElement.style, {
            userSelect: 'none',
            MozUserSelect: 'none',
            WebkitUserSelect: 'none',
            msUserSelect: 'none',
            ...options.contentStyle || {}
        });

        if (options.contentHTML) {
            this.contentElement.innerHTML = options.contentHTML;
        } else {
            this.contentElement.innerHTML = options.content;
        }

        // Assemble the window
        this.element.append(this.headerElement, this.contentElement);

        // Set up interactions
        this.setupWindowBehavior();
        this.setupDynamicStyles();
        this.setupButtonEvents();
    }

    abstract refreshWindowOptions(): FloatingWindowOptions;

    protected createWindowElement(options: FloatingWindowOptions): HTMLElement {
        const element = document.createElement('div');
        element.className = 'node-floating-window';
        Object.assign(element.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            padding: '16px',
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            zIndex: TooltipWindow.getNextZIndex(),
            minWidth: '200px',
            transition: 'all 0.3s ease',
            userSelect: 'none',
            MozUserSelect: 'none',
            WebkitUserSelect: 'none',
            msUserSelect: 'none',
            ...options.windowStyle,
        });
        return element;
    }

    protected createHeader(options: FloatingWindowOptions): {
        header: HTMLElement;
        closeButton?: HTMLButtonElement;
        focusButton?: HTMLButtonElement;
        menuButton?: HTMLButtonElement;
    } {
        const header = document.createElement('div');
        header.className = 'window-header';
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            paddingBottom: '8px',
            borderBottom: '1px solid #eee',
            cursor: 'move',
            userSelect: 'none',
            MozUserSelect: 'none',
            WebkitUserSelect: 'none',
            msUserSelect: 'none',
            ...options.headerStyle,
        });

        if (options.headerHTML) {
            header.innerHTML = options.headerHTML;
            return {header}; // Custom HTML may not have standard buttons
        }

        // Create controls section
        const controlsResult = this.createHeaderControls(options);
        header.appendChild(controlsResult.controls);

        // Create close button
        let closeButton: HTMLButtonElement | undefined;
        if (options.buttons?.close?.visible !== false) {
            closeButton = this.createCloseButton(options);
            header.appendChild(closeButton);
        }

        return {
            header,
            closeButton,
            focusButton: controlsResult.focusButton,
            menuButton: controlsResult.menuButton
        };
    }

    protected createHeaderControls(options: FloatingWindowOptions): {
        controls: HTMLElement;
        focusButton?: HTMLButtonElement;
        menuButton?: HTMLButtonElement;
    } {
        const controls = document.createElement('div');
        Object.assign(controls.style, {
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flex: '1',
            minWidth: '0',
            userSelect: 'none',
            MozUserSelect: 'none',
            WebkitUserSelect: 'none',
            msUserSelect: 'none',
        });

        let focusButton: HTMLButtonElement | undefined;
        let menuButton: HTMLButtonElement | undefined;

        // Create focus button
        if (options.buttons?.focus?.visible !== false) {
            focusButton = this.createFocusButton(options);
            controls.appendChild(focusButton);
        }

        // Create menu button
        if (options.buttons?.menu?.visible !== false) {
            menuButton = this.createMenuButton(options);
            controls.appendChild(menuButton);
        }

        // Add title
        controls.appendChild(this.createTitle(options));

        return {controls, focusButton, menuButton};
    }

    protected createTitle(options: FloatingWindowOptions): HTMLElement {
        const title = document.createElement('h3');
        title.className = 'window-title';
        Object.assign(title.style, {
            margin: '0',
            flex: '1',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: '0',
            fontSize: '14px',
            fontWeight: '500',
            userSelect: 'none',
            MozUserSelect: 'none',
            WebkitUserSelect: 'none',
            msUserSelect: 'none',
        });
        title.textContent = options.title;
        return title;
    }

    protected createButton(
        baseStyle: Partial<CSSStyleDeclaration>,
        icon: string,
        customStyle?: Partial<CSSStyleDeclaration>
    ): HTMLButtonElement {
        const button = document.createElement('button');
        Object.assign(button.style, {
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: '#666',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            transition: 'background-color 0.2s',
            ...baseStyle,
            ...customStyle,
        });

        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-icons';
        iconSpan.style.fontSize = '20px';
        iconSpan.textContent = icon;
        button.appendChild(iconSpan);

        return button;
    }

    protected createFocusButton(options: FloatingWindowOptions): HTMLButtonElement {
        return this.createButton(
            {},
            options.buttons?.focus?.icon || 'center_focus_strong',
            options.buttons?.focus?.style
        );
    }

    protected createMenuButton(options: FloatingWindowOptions): HTMLButtonElement {
        return this.createButton(
            {},
            options.buttons?.menu?.icon || 'more_vert',
            options.buttons?.menu?.style
        );
    }

    protected createCloseButton(options: FloatingWindowOptions): HTMLButtonElement {
        return this.createButton(
            {},
            options.buttons?.close?.icon || 'close',
            options.buttons?.close?.style
        );
    }

    show(x: number, y: number): void {
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.style.zIndex = String(TooltipWindow.getNextZIndex());
        if (!document.body.contains(this.element)) {
            document.body.appendChild(this.element);
        }
    }

    hide(): void {
        this.element.remove();
        window.removeEventListener('resize', this.handleSizeListener);
    }

    private handleSizeListener: () => void = () => {
    };

    private setupWindowBehavior(): void {
        this.handleSizeListener = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleSizeListener);
        this.element.addEventListener('mousedown', () => {
            this.element.style.zIndex = String(TooltipWindow.getNextZIndex());
        });
        
        // Add mouseleave handler to hide all tooltips when mouse leaves the window
        this.element.addEventListener('mouseleave', () => {
            setTimeout(() => {
                TooltipWindow.hideAllTooltips();
            }, 100);
        });
        
        this.setupDragging();
    }

    private setupDragging(): void {
        this.headerElement.addEventListener('mousedown', (e) => {
            if ((e.target as HTMLElement).closest('button')) return;

            this.isDragging = true;
            this.startX = e.clientX - this.element.offsetLeft;
            this.startY = e.clientY - this.element.offsetTop;
            this.element.style.transition = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            e.preventDefault();
            const newX = e.clientX - this.startX;
            const newY = e.clientY - this.startY;

            this.element.style.left = `${newX}px`;
            this.element.style.top = `${newY}px`;
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.element.style.transition = 'all 0.3s ease';
        });
    }

    private setupButtonEvents(): void {
        this.closeButton?.addEventListener('click', () =>
            this.node.hideFloatingWindow()
        );

        this.focusButton?.addEventListener('click', (e: Event) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            this.node.focusNode(rect.left, rect.bottom);
        });

        this.menuButton?.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            this.node.toggleMenu(rect.left, rect.bottom);
        });
    }

    private setupDynamicStyles(): void {
        const buttons = [
            this.closeButton,
            this.focusButton,
            this.menuButton
        ].filter(Boolean) as HTMLButtonElement[];

        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = '#f0f0f0';
            });
            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = 'transparent';
            });
        });
    }

    private handleResize(): void {
        // @ts-ignore - vis-network types are incomplete
        const containerRect = this.node.graph.network.body.container.getBoundingClientRect();
        const windowRect = this.element.getBoundingClientRect();

        const minTitleWidth = windowRect.width / 2;

        if (windowRect.left + minTitleWidth > containerRect.right) {
            this.element.style.left = `${containerRect.right - minTitleWidth}px`;
        }
        if (windowRect.right - minTitleWidth < containerRect.left) {
            this.element.style.left = `${containerRect.left - windowRect.width + minTitleWidth}px`;
        }

        if (windowRect.top < containerRect.top) {
            this.element.style.top = `${containerRect.top}px`;
        }
        if (windowRect.bottom > containerRect.bottom) {
            this.element.style.top = `${containerRect.bottom - windowRect.height}px`;
        }
    }

    onParam(param: Parameter):void{
        const options = this.refreshWindowOptions();

        Object.assign(this.contentElement.style, options.contentStyle || {});

        if (options.contentHTML) {
            this.contentElement.innerHTML = options.contentHTML;
        } else {
            this.contentElement.innerHTML = options.content;
        }
    }
}