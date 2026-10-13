import { describe, expect, it } from 'vitest';
import { faviconUrl, splitTextByUrls, stripTrailingPunctuation, truncateUrl } from './urls.ts';

describe('stripTrailingPunctuation', () => {
    it('drops sentence punctuation that follows a URL', () => {
        expect(stripTrailingPunctuation('https://example.com/.')).toBe('https://example.com/');
        expect(stripTrailingPunctuation('https://example.com/x).')).toBe('https://example.com/x');
    });

    it('keeps punctuation that belongs to the path', () => {
        expect(stripTrailingPunctuation('https://example.com/a-b_c')).toBe('https://example.com/a-b_c');
    });
});

describe('splitTextByUrls', () => {
    it('splits text around a URL', () => {
        expect(splitTextByUrls('see https://example.com please')).toEqual([
            { type: 'text', value: 'see ' },
            { type: 'link', value: 'https://example.com' },
            { type: 'text', value: ' please' },
        ]);
    });

    it('handles a URL that ends the sentence', () => {
        expect(splitTextByUrls('Open https://www.apotea.se/evertaste-food-xylitol-500-g.')).toEqual([
            { type: 'text', value: 'Open ' },
            { type: 'link', value: 'https://www.apotea.se/evertaste-food-xylitol-500-g' },
            { type: 'text', value: '.' },
        ]);
    });

    it('splits multiple URLs', () => {
        expect(splitTextByUrls('https://a.example x https://b.example')).toEqual([
            { type: 'link', value: 'https://a.example' },
            { type: 'text', value: ' x ' },
            { type: 'link', value: 'https://b.example' },
        ]);
    });

    it('returns a single text segment when there are no URLs', () => {
        expect(splitTextByUrls('plain')).toEqual([{ type: 'text', value: 'plain' }]);
    });
});

describe('truncateUrl', () => {
    it('leaves a short URL untouched, query string and all', () => {
        expect(truncateUrl('https://example.com/x')).toBe('https://example.com/x');
        expect(truncateUrl('https://www.example.com?project=foo')).toBe('https://www.example.com?project=foo');
    });

    it('drops the query string first, keeping the path intact', () => {
        const url =
            'https://www.apotea.se/evertaste-food-xylitol-500-g?utm_source=newsletter&utm_campaign=spring&fbclid=abc123';
        const out = truncateUrl(url, 64);
        expect(out).toBe('https://www.apotea.se/evertaste-food-xylitol-500-g…');
    });

    it('middle-truncates the path only when it alone is too long', () => {
        const url = `https://example.com/${'a'.repeat(100)}/end?id=1`;
        const out = truncateUrl(url, 40);
        expect(out.length).toBe(40);
        expect(out).not.toContain('?');
        expect(out).toContain('…');
    });

    it('keeps two short URLs that differ only by query distinguishable', () => {
        expect(truncateUrl('https://www.example.com?project=foo')).not.toBe(
            truncateUrl('https://www.example.com?project=bar')
        );
    });
});

describe('faviconUrl', () => {
    it('points at the favicon service for the URL host', () => {
        expect(faviconUrl('https://www.apotea.se/evertaste-food-xylitol-500-g')).toBe(
            'https://www.google.com/s2/favicons?sz=64&domain=www.apotea.se'
        );
    });

    it('returns an empty string when the value is not a URL', () => {
        expect(faviconUrl('nope')).toBe('');
    });
});
