interface ConfettiOrigin {
    x: number;
    y: number;
}

interface ConfettiSettings {
    count: number;
    gravity: number;
    speed: number;
    /** Launch cone width in degrees (360 = full circle). */
    spread: number;
    fade: number;
    /** Base particle size in CSS pixels. */
    size: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    vr: number;
    size: number;
    color: string;
    alpha: number;
}

const COLORS = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb'];

const SETTINGS: ConfettiSettings = {
    count: 300,
    gravity: 0.3,
    speed: 50,
    spread: 360,
    fade: 0.002,
    size: 8,
};

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let running = false;
let resizeBound = false;

/**
 * True when completing `id` would clear the last incomplete task in `list`.
 */
function shouldCelebrateLastTask(list: { id: string; completed: boolean }[], id: string): boolean {
    const incomplete = list.filter((t) => !t.completed);
    return incomplete.length === 1 && incomplete[0]?.id === id;
}

/**
 * Burst confetti from `origin` (CSS viewport pixels). No-ops under prefers-reduced-motion.
 * Falls back to viewport center when origin is omitted.
 */
function fireConfetti(origin?: ConfettiOrigin): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    ensureCanvas();
    if (!canvas || !ctx) {
        return;
    }

    // Polar velocities so the burst expands as a disc, not a rectangle
    const startX = origin?.x ?? window.innerWidth / 2;
    const startY = origin?.y ?? window.innerHeight / 2;
    const halfCone = (SETTINGS.spread / 2) * (Math.PI / 180);

    for (let i = 0; i < SETTINGS.count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2 * halfCone;
        const mag = Math.random() * SETTINGS.speed;

        particles.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * mag,
            vy: Math.sin(angle) * mag,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.3,
            size: SETTINGS.size * (0.75 + Math.random() * 0.5),
            color: COLORS[(Math.random() * COLORS.length) | 0],
            alpha: 1,
        });
    }

    if (!running) {
        running = true;
        requestAnimationFrame(loop);
    }
}

function ensureCanvas(): void {
    if (canvas && ctx) {
        resize();
        return;
    }

    const el = document.createElement('canvas');
    el.setAttribute('aria-hidden', 'true');
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '999';
    document.body.appendChild(el);

    const context = el.getContext('2d');
    if (!context) {
        el.remove();
        return;
    }

    canvas = el;
    ctx = context;

    if (!resizeBound) {
        window.addEventListener('resize', resize);
        resizeBound = true;
    }
    resize();
}

function resize(): void {
    if (!canvas || !ctx) {
        return;
    }

    // CSS size must stay in viewport pixels; bitmap alone is device pixels.
    // Without this, high-DPR canvases overflow and origin % maps below the fold.
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loop(): void {
    if (!canvas || !ctx) {
        running = false;
        return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);

    particles = particles.filter((p) => p.alpha > 0);

    for (const p of particles) {
        p.vx *= 0.99;
        p.vy += SETTINGS.gravity;

        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        p.alpha -= SETTINGS.fade;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
        ctx.restore();
    }

    if (particles.length > 0) {
        requestAnimationFrame(loop);
    } else {
        running = false;
        ctx.clearRect(0, 0, width, height);
    }
}

export { fireConfetti, shouldCelebrateLastTask };
export type { ConfettiOrigin };
