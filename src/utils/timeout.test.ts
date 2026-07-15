import { describe, expect, it } from 'vitest';
import { withTimeout } from './timeout.ts';

describe('withTimeout', () => {
    it('resolves when the promise settles in time', async () => {
        await expect(withTimeout(Promise.resolve('ok'), 50, 'timed out')).resolves.toBe('ok');
    });

    it('rejects when the promise takes too long', async () => {
        await expect(
            withTimeout(
                new Promise<string>((resolve) => {
                    setTimeout(() => resolve('late'), 100);
                }),
                10,
                'timed out'
            )
        ).rejects.toThrow('timed out');
    });
});
