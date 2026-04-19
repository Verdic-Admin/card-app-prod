import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const apiKey = process.env.PLAYERINDEX_API_KEY;
  const url = request.nextUrl.clone();

  if (url.pathname.startsWith('/admin')) {
    // 1. Check if the server has the required Oracle API key
    if (!apiKey) {
      url.pathname = '/setup';
      return NextResponse.redirect(url);
    }

    // 2. Force the visitor to be authenticated via the login cookie
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
