import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const apiKey = process.env.PLAYERINDEX_API_KEY;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const url = request.nextUrl.clone();

  if (url.pathname.startsWith('/admin')) {
    // 1. Check if the server has the required Oracle API key
    if (!apiKey) {
      url.pathname = '/setup';
      return NextResponse.redirect(url);
    }

    // 2. Force the visitor to provide the admin password
    const basicAuth = request.headers.get('authorization');
    if (adminPassword) {
      // Note: Basic Auth header is 'Basic <base64>' -> index 1
      const authValue = basicAuth ? basicAuth.split(' ')[1] : '';
      const expectedAuth = btoa(`admin:${adminPassword}`);
      
      if (authValue !== expectedAuth) {
        return new NextResponse('Unauthorized Access', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Secure Admin Dashboard"' }
        });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
