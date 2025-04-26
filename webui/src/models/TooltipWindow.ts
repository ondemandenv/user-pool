import { Tooltip, TooltipOptions } from "./Tooltip";

/**
 * Abstract base class for any entity that can display tooltips
 */
export abstract class TooltipWindow {
    protected tooltip: Tooltip | null = null;
    private static topZIndex: number = 1000;

    /**
     * Abstract method that defines the tooltip options to be displayed
     */
    abstract getTooltipOptions(): TooltipOptions;

    /**
     * Show tooltip at specified coordinates
     */
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

    /**
     * Handle tooltip click event
     */
    protected handleTooltipClick(e: MouseEvent) {
        e.stopPropagation();
        const rect = this.tooltip!.getElement()?.getBoundingClientRect();
        if (!rect) return;
        this.hideTooltip();
        this.onTooltipClick(rect.left, rect.top);
    }

    /**
     * Abstract method that defines what happens when tooltip is clicked
     * Subclasses can override to show floating window or perform other actions
     */
    protected abstract onTooltipClick(x: number, y: number): void;

    /**
     * Handle tooltip mouse enter event
     */
    protected handleTooltipMouseEnter(e: MouseEvent) {
        this.tooltip?.getElement()?.classList.add('active');
    }

    /**
     * Handle tooltip mouse leave event
     */
    protected handleTooltipMouseLeave(e: MouseEvent) {
        const element = this.tooltip?.getElement();
        if (element && !element.classList.contains('transforming')) {
            element.classList.remove('active');
            this.hideTooltip();
        }
    }

    /**
     * Hide the tooltip
     */
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.hide();
        }
    }

    /**
     * Get next z-index for proper layering of UI elements
     */
    static getNextZIndex(): number {
        return ++TooltipWindow.topZIndex;
    }
} 