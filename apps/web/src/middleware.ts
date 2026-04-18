import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPER_ADMIN_EMAILS } from "@/lib/super-admin";

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? "localhost:3000";

const AUTH_PAGES_REQUIRING_ANON = [
  "/auth/login",
  "/auth/signup",
  "/auth/register-commune",
];

// Hostnames that should pass through without domain resolution
function isPlatformHost(hostname: string): boolean {
  // localhost / dev
  if (hostname === "localhost" || hostname.startsWith("localhost:")) return true;
  // Exact platform domain (e.g. app.example.fr)
  if (hostname === PLATFORM_DOMAIN) return true;
  // Vercel preview URLs
  if (hostname.endsWith(".vercel.app")) return true;
  return false;
}

function extractSubdomain(hostname: string): string | null {
  // hostname = "saint-martin.app.example.fr"
  // PLATFORM_DOMAIN = "app.example.fr"
  if (!hostname.endsWith(`.${PLATFORM_DOMAIN}`)) return null;
  const sub = hostname.slice(0, -(PLATFORM_DOMAIN.length + 1));
  // Ignore "www" subdomain
  if (sub === "www") return null;
  // Only single-level subdomains
  if (sub.includes(".")) return null;
  return sub;
}

async function getSessionUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Read-only path; we don't refresh tokens here.
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // 1. Platform host — pass through (with auth-page redirect for signed-in users)
  if (isPlatformHost(hostname)) {
    if (AUTH_PAGES_REQUIRING_ANON.some((p) => pathname.startsWith(p))) {
      const user = await getSessionUser(request);
      if (user) {
        const target = SUPER_ADMIN_EMAILS.includes(user.email ?? "")
          ? "/super-admin"
          : "/app/feed";
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = target;
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
    }

    // Gate authed routes: unsigned users get sent to login with ?next=
    const AUTHED_PREFIXES = ["/app/", "/admin/"];
    if (AUTHED_PREFIXES.some((p) => pathname.startsWith(p))) {
      const user = await getSessionUser(request);
      if (!user) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/auth/login";
        redirectUrl.search = `?next=${encodeURIComponent(pathname)}`;
        return NextResponse.redirect(redirectUrl);
      }
    }

    return NextResponse.next();
  }

  // 2. Subdomain — rewrite to /[commune-slug]/...
  const subdomain = extractSubdomain(hostname);
  if (subdomain) {
    const url = request.nextUrl.clone();
    url.pathname = `/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // 3. Custom domain — look up in database
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Middleware can't set cookies directly, but we need the interface
        },
      },
    }
  );

  const { data: commune } = await supabase
    .from("communes")
    .select("slug")
    .eq("custom_domain", hostname)
    .eq("domain_verified", true)
    .single();

  if (commune) {
    const url = request.nextUrl.clone();
    url.pathname = `/${commune.slug}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // 4. No match
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
