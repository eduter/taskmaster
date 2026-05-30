import './Icon.css';

interface IconProps {
    /** Raw SVG markup inlined at build time via `?raw` import. */
    src: string;
    class?: string;
    width?: number;
    height?: number;
}

/** Renders an SVG icon imported with `?raw` so it ships inline in the bundle. */
function Icon(props: IconProps) {
    const width = props.width ?? 20;
    const height = props.height ?? 20;

    return (
        <span
            class={`icon${props.class ? ` ${props.class}` : ''}`}
            style={{ width: `${width}px`, height: `${height}px` }}
            innerHTML={props.src}
            aria-hidden="true"
        />
    );
}

export { Icon };
