const GLOBAL_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"»”]+$/;

// Chosen so a chip stays on one line on a phone without hiding the tail.
const URL_MAX_CHARS = 64;

/** Splits text into alternating plain-text and URL segments for inline rendering. */
type TextSegment = { type: 'text'; value: string } | { type: 'link'; value: string };

function splitTextByUrls(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    let lastIndex = 0;
    for (const match of text.matchAll(GLOBAL_URL_PATTERN)) {
        const url = stripTrailingPunctuation(match[0]);
        const start = match.index ?? 0;
        if (start > lastIndex) {
            segments.push({ type: 'text', value: text.slice(lastIndex, start) });
        }
        segments.push({ type: 'link', value: url });
        lastIndex = start + url.length;
    }
    if (lastIndex < text.length) {
        segments.push({ type: 'text', value: text.slice(lastIndex) });
    }
    return segments;
}

/** Drops sentence punctuation the regex swept into a URL that ends a clause. */
function stripTrailingPunctuation(url: string): string {
    return url.replace(TRAILING_PUNCTUATION, '');
}

/**
 * Middle-truncates a string, keeping the head and the tail. Used for URLs whose
 * path alone is still too long to show.
 */
function truncateMiddle(value: string, max: number): string {
    const head = Math.ceil((max - 1) * 0.6);
    const tail = max - 1 - head;
    return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}

/**
 * Shortens a URL for display. Query strings are usually tracking noise
 * (utm_*, fbclid, session ids), so they are dropped first; the path is only
 * middle-truncated when it alone is still too long. The tail is kept because
 * the meaningful slug lives there. A URL that fits is left untouched, so two
 * short URLs differing only in their query stay distinguishable.
 */
function truncateUrl(url: string, max: number = URL_MAX_CHARS): string {
    if (url.length <= max) {
        return url;
    }

    const queryIndex = url.indexOf('?');
    if (queryIndex !== -1) {
        const base = url.slice(0, queryIndex);
        return base.length <= max ? `${base}…` : truncateMiddle(base, max);
    }

    return truncateMiddle(url, max);
}

/**
 * Favicon for a page via Google's public service. Keyless and CORS-friendly,
 * so it renders in an <img> without the app fetching the page itself.
 */
function faviconUrl(pageUrl: string): string {
    try {
        const host = new URL(pageUrl).hostname;
        return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`;
    } catch {
        return '';
    }
}

export type { TextSegment };
export { faviconUrl, splitTextByUrls, stripTrailingPunctuation, truncateUrl };
