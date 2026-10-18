import { NextRequest } from 'next/server';

/** Development-only card art for the synthetic catalogue: a soft gradient with the item's name. */
export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const hex = /^#[0-9a-fA-F]{6}$/;
  const a = hex.test(q.get('a') ?? '') ? q.get('a')! : '#cfc7b8';
  const b = hex.test(q.get('b') ?? '') ? q.get('b')! : '#8c8579';
  const title = (q.get('t') ?? '').slice(0, 60).replace(/[<>&"']/g, '');
  const words = title.split(' ');
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= 16) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const text = lines
    .slice(0, 3)
    .map((l, i) => `<tspan x="50%" dy="${i === 0 ? 0 : 1.15}em">${l}</tspan>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-label="${title}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="800" height="1000" fill="url(#g)"/>
  <circle cx="620" cy="220" r="160" fill="#ffffff" fill-opacity=".14"/>
  <rect x="120" y="560" width="560" height="220" rx="28" fill="#ffffff" fill-opacity=".16"/>
  <text x="50%" y="46%" text-anchor="middle" font-family="Georgia, serif" font-size="58" fill="#1f1a15" fill-opacity=".78">${text}</text>
</svg>`;
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
