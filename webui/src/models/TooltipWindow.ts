import { Tooltip, TooltipOptions } from "./Tooltip";

/**
 * Abstract base class for any entity that can display tooltips
 */
export abstract class TooltipWindow {
    protected tooltip: Tooltip | null = null;
    private static topZIndex: number = 1000;
    
    // Keep track of all active tooltip windows
    private static activeTooltips: Set<TooltipWindow> = new Set();
    
    // Document click handler reference
    private static documentClickHandler: ((e: MouseEvent) => void) | null = null;

    // Initialize static handlers
    public static initialize() {
        // Set up document click handler to hide all tooltips when clicking outside
        TooltipWindow.documentClickHandler = (e: MouseEvent) => {
            // Check if click is outside all tooltip elements
            let clickedInsideTooltip = false;
            
            for (const tooltipWindow of TooltipWindow.activeTooltips) {
                const element = tooltipWindow.tooltip?.getElement();
                if (element && element.contains(e.target as Node)) {
                    clickedInsideTooltip = true;
                    break;
                }
            }
            
            if (!clickedInsideTooltip) {
                TooltipWindow.hideAllTooltips();
            }
        };
        
        document.addEventListener('click', TooltipWindow.documentClickHandler);
    }

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
        TooltipWindow.activeTooltips.add(this);
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
            TooltipWindow.hideAllTooltips();
        }
    }

    /**
     * Hide the tooltip
     */
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.hide();
            TooltipWindow.activeTooltips.delete(this);
        }
    }

    /**
     * Static method to hide all active tooltips
     */
    public static hideAllTooltips() {
        TooltipWindow.activeTooltips.forEach(tooltipWindow => {
            tooltipWindow.hideTooltip();
        });
        TooltipWindow.activeTooltips.clear();
    }

    /**
     * Get next z-index for proper layering of UI elements
     */
    static getNextZIndex(): number {
        return ++TooltipWindow.topZIndex;
    }
}

// Initialize document click handler
TooltipWindow.initialize(); 