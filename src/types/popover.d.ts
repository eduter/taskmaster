interface HTMLElement {
    popover?: '' | 'auto' | 'manual' | 'hint' | null;
    hidePopover(options?: { source?: Element }): void;
    showPopover(options?: { source?: Element }): void;
    togglePopover(options?: { source?: Element }): void;
}

interface HTMLButtonElement {
    popoverTargetElement: Element | null;
    popoverTargetAction: 'hide' | 'show' | 'toggle';
}

interface ButtonHTMLAttributes<T> {
    popovertarget?: string;
    popovertargetaction?: 'hide' | 'show' | 'toggle';
}

interface HTMLAttributes<T> {
    popover?: '' | 'auto' | 'manual' | 'hint' | null;
}
