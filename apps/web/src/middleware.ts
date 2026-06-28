import { NextResponse, type NextRequest } from "next/server";

// Coarse gate for the back office: no session cookie → bounce to login.
// Fine-grained role enforcement lives in the API (JWT + RolesGuard) and in the
// client RequireRole wrapper.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get("jm_session")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
