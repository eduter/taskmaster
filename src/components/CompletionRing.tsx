import { Show, type JSX } from 'solid-js';
import './CompletionRing.css';

interface CompletionRingProps {
    /** Completion fraction from 0 to 1; a zero rate draws only the track. */
    rate: number;
    /** Stroke color for the progress arc. */
    color: string;
    /** Rendered width and height in pixels. */
    size: number;
    /** Radius of the ring's centerline in viewBox units. */
    radius: number;
    strokeWidth?: number;
    /** Extra hook class appended to the svg's base class. */
    class?: string;
    /** Extra hook class appended to the track circle's base class. */
    trackClass?: string;
    /** Extra hook class appended to the progress circle's base class. */
    progressClass?: string;
}

/** Circular progress ring drawn clockwise from the top of the circle. */
function CompletionRing(props: CompletionRingProps): JSX.Element {
    const center = () => props.size / 2;
    const circumference = () => 2 * Math.PI * props.radius;
    const strokeWidth = () => props.strokeWidth ?? 2;
    const withHook = (base: string, hook: string | undefined) => (hook ? `${base} ${hook}` : base);

    return (
        <svg
            class={props.class}
            viewBox={`0 0 ${props.size} ${props.size}`}
            width={props.size}
            height={props.size}
            aria-hidden="true"
        >
            <circle
                class={withHook('completion-ring__track', props.trackClass)}
                cx={center()}
                cy={center()}
                r={props.radius}
                stroke-width={strokeWidth()}
            />
            {/* Round caps still paint a blob when the dash length is 0 */}
            <Show when={props.rate > 0}>
                <circle
                    class={withHook('completion-ring__progress', props.progressClass)}
                    cx={center()}
                    cy={center()}
                    r={props.radius}
                    stroke={props.color}
                    stroke-width={strokeWidth()}
                    stroke-dasharray={`${props.rate * circumference()} ${circumference()}`}
                    transform={`rotate(-90 ${center()} ${center()})`}
                />
            </Show>
        </svg>
    );
}

export type { CompletionRingProps };
export { CompletionRing };
