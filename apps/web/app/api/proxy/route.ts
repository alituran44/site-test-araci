import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('URL parametresi eksik', { status: 400 });
  }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 }
    });

    const contentType = res.headers.get('content-type') || 'text/html';
    let html = await res.text();

    // Inject base tag so relative links, stylesheets, and images load correctly
    try {
      const parsedUrl = new URL(targetUrl);
      const origin = parsedUrl.origin;
      const baseTag = `<head><base href="${origin}/">`;

      if (html.includes('<head>')) {
        html = html.replace('<head>', baseTag);
      } else {
        html = baseTag + html;
      }
    } catch {
      // Ignore URL parsing errors
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { background: #0b0f19; color: #94a3b8; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #334155; max-width: 400px; }
            h2 { color: #f87171; margin-top: 0; }
            p { font-size: 0.875rem; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Önizleme Yüklenemedi</h2>
            <p><strong>${targetUrl}</strong> adresine doğrudan erişim iframe / güvenlik kısıtlamalarına takıldı veya sunucu yanıt vermedi.</p>
          </div>
        </body>
      </html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}
