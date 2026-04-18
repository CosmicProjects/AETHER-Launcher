const ARTWORK_WIDTH = 400;
const ARTWORK_HEIGHT = 250;

const artworkCache = new Map();

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function buildSeed(title) {
    let seed = 0;
    for (let i = 0; i < title.length; i++) {
        seed = ((seed << 5) - seed) + title.charCodeAt(i);
        seed |= 0;
    }
    return seed;
}

export function getTitleTheme(title) {
    const safeTitle = String(title || 'Untitled Game').trim() || 'Untitled Game';
    const seed = buildSeed(safeTitle);
    const hue = ((seed % 360) + 360) % 360;

    return {
        title: safeTitle,
        seed,
        hue,
        accent: `hsla(${hue}, 90%, 64%, 1)`,
        accentSoft: `hsla(${hue}, 90%, 64%, 0.18)`,
        accentGlow: `hsla(${hue}, 100%, 72%, 0.28)`,
        accentGlow2: `hsla(${(hue + 38) % 360}, 92%, 66%, 0.16)`,
        edge: `hsla(${hue}, 80%, 60%, 0.4)`
    };
}

function buildSvgFallback(title, baseHue) {
    const safeTitle = escapeXml(title);
    const safeWord = escapeXml(title.toUpperCase().split(/\s+/)[0] || 'GAME');
    const initial = escapeXml((title.charAt(0) || 'G').toUpperCase());

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${ARTWORK_WIDTH}" height="${ARTWORK_HEIGHT}" viewBox="0 0 ${ARTWORK_WIDTH} ${ARTWORK_HEIGHT}">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="hsl(${baseHue}, 42%, 12%)" />
                    <stop offset="100%" stop-color="hsl(${(baseHue + 38) % 360}, 42%, 6%)" />
                </linearGradient>
                <radialGradient id="glow" cx="50%" cy="46%" r="50%">
                    <stop offset="0%" stop-color="hsla(${(baseHue + 18) % 360}, 85%, 62%, 0.35)" />
                    <stop offset="100%" stop-color="hsla(${(baseHue + 18) % 360}, 85%, 62%, 0)" />
                </radialGradient>
            </defs>
            <rect width="400" height="250" fill="url(#bg)" />
            <circle cx="202" cy="112" r="96" fill="url(#glow)" />
            <circle cx="202" cy="112" r="56" fill="none" stroke="hsla(${baseHue}, 90%, 64%, 0.45)" stroke-width="2" />
            <text x="200" y="118" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="800" fill="#ffffff">${initial}</text>
            <text x="200" y="190" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" letter-spacing="5" fill="#ffffff" fill-opacity="0.55">${safeWord}</text>
            <text x="200" y="220" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="500" fill="#ffffff" fill-opacity="0.28">${safeTitle}</text>
        </svg>
    `)}`;
}

export function generateTitleArtwork(title) {
    const theme = getTitleTheme(title);
    const safeTitle = theme.title;
    const cached = artworkCache.get(safeTitle);
    if (cached) return cached;

    const seed = theme.seed;
    const baseHue = theme.hue;

    if (typeof document === 'undefined') {
        const fallback = buildSvgFallback(safeTitle, baseHue);
        artworkCache.set(safeTitle, fallback);
        return fallback;
    }

    const canvas = document.createElement('canvas');
    canvas.width = ARTWORK_WIDTH;
    canvas.height = ARTWORK_HEIGHT;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        const fallback = buildSvgFallback(safeTitle, baseHue);
        artworkCache.set(safeTitle, fallback);
        return fallback;
    }

    let nextSeed = seed;
    const pseudoRandom = () => {
        const x = Math.sin(nextSeed++) * 10000;
        return x - Math.floor(x);
    };

    const gradient = ctx.createLinearGradient(0, 0, ARTWORK_WIDTH, ARTWORK_HEIGHT);
    gradient.addColorStop(0, `hsl(${baseHue}, 40%, 8%)`);
    gradient.addColorStop(1, `hsl(${(baseHue + 40) % 360}, 40%, 5%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ARTWORK_WIDTH, ARTWORK_HEIGHT);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
        const radius = 50 + pseudoRandom() * 150;
        const x = pseudoRandom() * ARTWORK_WIDTH;
        const y = pseudoRandom() * ARTWORK_HEIGHT;
        const nebula = ctx.createRadialGradient(x, y, 0, x, y, radius);
        nebula.addColorStop(0, `hsla(${(baseHue + i * 30) % 360}, 70%, 50%, 0.15)`);
        nebula.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = nebula;
        ctx.fillRect(0, 0, ARTWORK_WIDTH, ARTWORK_HEIGHT);
    }
    ctx.restore();

    ctx.strokeStyle = `hsla(${baseHue}, 80%, 60%, 0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const x = pseudoRandom() * ARTWORK_WIDTH;
        const y = pseudoRandom() * ARTWORK_HEIGHT;
        ctx.moveTo(x, y);
        for (let j = 0; j < 3; j++) {
            ctx.lineTo(pseudoRandom() * ARTWORK_WIDTH, pseudoRandom() * ARTWORK_HEIGHT);
        }
    }
    ctx.stroke();

    ctx.shadowColor = `hsl(${baseHue}, 80%, 60%)`;
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'white';
    ctx.font = '800 100px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(safeTitle.charAt(0).toUpperCase(), ARTWORK_WIDTH / 2, 115);

    ctx.shadowBlur = 0;
    ctx.font = '600 14px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.letterSpacing = '5px';
    ctx.fillText(safeTitle.toUpperCase().split(/\s+/)[0] || 'GAME', ARTWORK_WIDTH / 2, 190);

    const result = canvas.toDataURL();
    artworkCache.set(safeTitle, result);
    return result;
}
