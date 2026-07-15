/** Reject when `promise` does not settle within `ms` milliseconds. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(message)), ms);
        }),
    ]);
}

export { withTimeout };
