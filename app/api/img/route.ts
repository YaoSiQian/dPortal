// /api/img — server-side image proxy. The browser hits /api/img?url=<encoded>;
// we fetch the upstream and stream the binary back with CORS headers
// that let WebGL textures use it without tainting the canvas.
//
// Why this exists: WebGL TextureLoader needs CORS-clean image responses to
// avoid tainting the canvas — a tainted canvas refuses toDataURL() / toBlob(),
// which breaks the screenshot export. Routing all anitabi images through our
// same-origin proxy keeps the canvas exportable and lets us add a domain whitelist.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_HOSTS = new Set([
  'www.anitabi.cn',
  'image.anitabi.cn',
  'lain.bgm.tv'
]);

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif'
]);

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('url');
  if (!raw) return new Response('missing url', { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response('invalid url', { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return new Response('host not allowed', { status: 403 });
  }
  if (target.protocol !== 'https:') {
    return new Response('https only', { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'PortalAnimeProxy/0.1' },
      // Defensive: 8s timeout via AbortSignal.
      signal: AbortSignal.timeout(8000)
    });
  } catch (e) {
    return new Response(`upstream failed: ${(e as Error).message}`, {
      status: 502
    });
  }
  if (!upstream.ok) {
    return new Response(`upstream ${upstream.status}`, { status: 502 });
  }
  const ctype = upstream.headers.get('content-type') ?? 'application/octet-stream';
  if (!ALLOWED_TYPES.has(ctype.split(';')[0].trim())) {
    return new Response(`bad content-type ${ctype}`, { status: 415 });
  }

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': ctype,
      // Same-origin: no Access-Control-Allow-Origin needed for our own
      // <img>/TextureLoader. We still emit it explicitly so a future
      // sub-domain split keeps working.
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      // Let the browser cache aggressively — anitabi images are
      // content-addressed by path, immutable in practice.
      'Cache-Control': 'public, max-age=86400, immutable'
    }
  });
}
