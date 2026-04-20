import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();

  if (url.pathname.startsWith('/admin')) {
    // Middleware runs on Edge runtime and can't query Postgres, so we rely
    // solely on the admin_session cookie here. The Oracle API key is resolved
    // at the action/API layer (env → shop_config DB fallback).
    const hasSession = request.cookies.has("admin_session");
    if (!hasSession) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
