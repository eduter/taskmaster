import { createSignal, For, Show, type JSX } from 'solid-js';
import linkIcon from '../icons/link.svg?raw';
import { faviconUrl, splitTextByUrls, truncateUrl } from '../utils/urls.ts';
import { Icon } from './Icon.tsx';
import './LinkText.css';

interface LinkTextProps {
    text: string;
}

/** Renders text with each URL replaced by a favicon+URL chip that links out. */
function LinkText(props: LinkTextProps): JSX.Element {
    const segments = () => splitTextByUrls(props.text);

    return (
        <span class="link-text">
            <For each={segments()}>
                {(segment) => (
                    <Show when={segment.type === 'link'} fallback={<span>{segment.value}</span>}>
                        <LinkChip url={segment.value} />
                    </Show>
                )}
            </For>
        </span>
    );
}

interface LinkChipProps {
    url: string;
}

/** A styled link: the page favicon plus the URL, shortened to stay on one line. */
function LinkChip(props: LinkChipProps): JSX.Element {
    const [faviconFailed, setFaviconFailed] = createSignal(false);
    const favicon = () => (faviconFailed() ? '' : faviconUrl(props.url));

    // Keep the row's tap/swipe/long-press gestures away from the link, so that
    // tapping the chip opens the URL while tapping the item still opens the editor.
    function isolate(event: Event): void {
        event.stopPropagation();
    }

    return (
        <a
            class="link-chip"
            href={props.url}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={isolate}
            onClick={isolate}
        >
            <Show when={favicon()} fallback={<Icon class="link-chip__icon" src={linkIcon} width={13} height={13} />}>
                <img
                    class="link-chip__favicon"
                    src={favicon()}
                    alt=""
                    loading="lazy"
                    onError={() => setFaviconFailed(true)}
                />
            </Show>
            <span class="link-chip__url">{truncateUrl(props.url)}</span>
        </a>
    );
}

export { LinkText };
