/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LinkText } from './LinkText.tsx';

afterEach(cleanup);

describe('LinkText', () => {
    it('renders a chip whose text is the URL and whose href is the URL', () => {
        render(() => <LinkText text="Buy https://www.apotea.se/evertaste-food-xylitol-500-g" />);

        const link = screen.getByRole('link') as HTMLAnchorElement;
        expect(link.getAttribute('href')).toBe('https://www.apotea.se/evertaste-food-xylitol-500-g');
        expect(link.textContent).toContain('https://www.apotea.se/evertaste-food-xylitol-500-g');
        expect(screen.getByText('Buy')).toBeTruthy();
    });

    it('shows a favicon for the URL host', () => {
        render(() => <LinkText text="https://www.apotea.se/x" />);
        const img = screen.getByRole('link').querySelector('img') as HTMLImageElement;
        expect(img.getAttribute('src')).toBe('https://www.google.com/s2/favicons?sz=64&domain=www.apotea.se');
    });

    it('drops the query string in the visible label but keeps the full URL in the href', () => {
        const url = `https://shop.example.com/product?utm_source=news&utm_campaign=spring&fbclid=${'x'.repeat(80)}&id=99887`;
        render(() => <LinkText text={`See ${url}`} />);

        const link = screen.getByRole('link') as HTMLAnchorElement;
        const label = link.querySelector('.link-chip__url') as HTMLElement;
        expect(label.textContent).toBe('https://shop.example.com/product…');
        expect(link.getAttribute('href')).toBe(url);
    });

    it('falls back to a generic icon when the favicon fails to load', () => {
        render(() => <LinkText text="https://example.com/x" />);
        const img = screen.getByRole('link').querySelector('img') as HTMLImageElement;
        fireEvent.error(img);
        expect(screen.getByRole('link').querySelector('.link-chip__icon')).toBeTruthy();
    });

    it('stops pointerdown from reaching the checklist row', () => {
        const onRowPointerDown = vi.fn();
        render(() => (
            <div onPointerDown={onRowPointerDown}>
                <LinkText text="Buy https://www.apotea.se/x" />
            </div>
        ));

        fireEvent.pointerDown(screen.getByRole('link'));
        expect(onRowPointerDown).not.toHaveBeenCalled();
    });

    it('stops click from reaching the checklist row', () => {
        const onRowClick = vi.fn();
        render(() => (
            // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: test double for the row, not shipped UI
            <div onClick={onRowClick}>
                <LinkText text="Buy https://www.apotea.se/x" />
            </div>
        ));

        fireEvent.click(screen.getByRole('link'));
        expect(onRowClick).not.toHaveBeenCalled();
    });
});
