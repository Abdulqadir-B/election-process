import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const location = searchParams.get('q') || '';

  // Key is server-side only — no NEXT_PUBLIC_ prefix, never bundled into browser JS
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // Basic input guard: reject empty or suspiciously long location strings
  if (!location || location.length > 200) {
    logger.warn({ message: 'Maps embed: invalid location param', location: location.slice(0, 50), route: '/api/maps-embed' });
    return new NextResponse(
      `<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100%;font-family:sans-serif;color:#94a3b8;font-size:14px">Invalid location.</body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!apiKey) {
    logger.error({ message: 'Maps embed: GOOGLE_MAPS_API_KEY is not configured', route: '/api/maps-embed' });
    return new NextResponse(
      `<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100%;font-family:sans-serif;color:#94a3b8;font-size:14px">Map not configured.</body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  logger.info({ message: 'Maps embed rendered', location, route: '/api/maps-embed' });

  const mapsUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(location + ', India')}`;

  // Return a minimal HTML page containing the Maps iframe.
  // The API key only exists in this server response — it is never in the React bundle.
  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; }
    body, html { height: 100%; width: 100%; }
    iframe { border: none; width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <iframe
    src="${mapsUrl}"
    allowfullscreen
    referrerpolicy="no-referrer-when-downgrade"
    title="Polling Area Map for ${location.replace(/"/g, '')}"
  ></iframe>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      // Prevent this route from being embedded by third-party sites
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}
