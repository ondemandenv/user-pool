import { MenuOptions } from "./OdmdNode";
import { TooltipWindow } from "./TooltipWindow";

export class OdmdMenu {
    private menuElement: HTMLElement | null = null;

    constructor(private options: MenuOptions) {}

    show(x: number, y: number) {
        if (this.menuElement) {
            this.hide();
        }

        this.menuElement = document.createElement('div');
        this.menuElement.className = 'node-menu';

        Object.assign(this.menuElement.style, {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            padding: '4px 0',
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: TooltipWindow.getNextZIndex() + 100,
            minWidth: '150px',
            ...this.options.style,
        });

        this.menuElement.innerHTML = this.options.items.map(item => `
            <div class="menu-item" style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                cursor: pointer;
                transition: background-color 0.2s;">
                ${item.icon ? `<span class="material-icons" style="font-size: 18px;">${item.icon}</span>` : ''}
                <span>${item.label}</span>
            </div>
        `).join('');

        const menuItems = this.menuElement.querySelectorAll('.menu-item');
        menuItems.forEach((menuItem, index) => {
            const element = menuItem as HTMLElement;
            element.addEventListener('mouseenter', () => {
                element.style.backgroundColor = '#f0f0f0';
            });
            element.addEventListener('mouseleave', () => {
                element.style.backgroundColor = 'transparent';
            });
            element.addEventListener('click', () => {
                this.options.items[index].action();
                this.hide();
            });
        });

        document.addEventListener('click', this.handleDocumentClick);
        document.body.appendChild(this.menuElement);
    }

    hide() {
        if (this.menuElement) {
            document.removeEventListener('click', this.handleDocumentClick);
            this.menuElement.remove();
            this.menuElement = null;
        }
    }

    private handleDocumentClick = (e: MouseEvent) => {
        if (!this.menuElement?.contains(e.target as Node)) {
            this.hide();
        }
    }
}