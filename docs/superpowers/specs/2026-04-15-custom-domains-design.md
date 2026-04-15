# Custom Domain Support — Design Spec

**Date:** 2026-04-15
**Status:** Approved
**Scope:** Subdomain routing for all communes + optional custom domain with DNS verification

## 1. Domain Resolution Architecture

### How requests are routed

Next.js middleware (`middleware.ts`) inspects the hostname on every request:

1. **Subdomain** (`saint-martin.app.example.fr`) — extract `saint-martin` from hostname, look up commune by `slug`, rewrite to `/[commune-slug]/...`
2. **Custom domain** (`www.saint-martin.fr`) — look up commune by `custom_domain` column, rewrite to `/[commune-slug]/...`
3. **Main platform** (`app.example.fr` or `localhost:3000`) — pass through unchanged (resident app, admin panel, auth)
4. **No match** — 404

This is platform-agnostic: works on Vercel, Caddy, nginx, or any host. Only the public commune website is served via subdomain/custom domain — the resident app (`/app/`) and admin panel (`/admin/`) stay on the main platform domain.

### Schema changes

Add to `communes` table:
- `custom_domain TEXT UNIQUE` — bare domain entered by admin (e.g. `www.saint-martin.fr`), null if not configured
- `domain_verified BOOLEAN DEFAULT false` — true once DNS CNAME is confirmed pointing to the platform

Subdomains use the existing `slug` column — no new column needed. Every commune gets a subdomain automatically.

### DNS verification

- Admin enters their domain in the admin panel
- System instructs them to add a CNAME record: `www` → `communes.app.example.fr` (platform domain, configurable)
- Admin clicks "Vérifier" — a server action checks DNS via a public API (`https://dns.google/resolve?name={domain}&type=CNAME`)
- If the CNAME resolves to the platform domain, `domain_verified` is set to true
- No background polling — admin re-checks manually after setting up DNS

### SSL

Automatic on both deployment targets:
- Vercel: auto-provisions SSL for custom domains via their API
- Caddy (future self-hosted): auto Let's Encrypt
- No code needed for SSL management

## 2. Admin UI — Domain Management

New section in admin panel: "Nom de domaine"

### Three states

**State 1 — No domain configured:**
- Shows current URL: "Votre site communal est accessible à `{slug}.app.example.fr`"
- Input field + button to add a custom domain
- Placeholder: `www.saint-martin.fr`

**State 2 — Domain entered, not verified:**
- Shows the domain entered by admin
- DNS instructions box:
  - "Connectez-vous à votre fournisseur de domaine (OVH, Gandi...) et ajoutez un enregistrement CNAME :"
  - Hôte: `www`
  - Valeur: `communes.app.example.fr`
- "Vérifier la configuration DNS" button
- If check fails: "DNS non détecté. La propagation peut prendre jusqu'à 24h."
- "Supprimer" link to remove the domain

**State 3 — Domain verified and active:**
- Green badge: "Domaine actif"
- Shows the domain as a clickable link
- "Supprimer" button to disconnect

### Server action for DNS check

Uses `fetch("https://dns.google/resolve?name={domain}&type=CNAME")` to verify the CNAME record points to the platform domain. Works on edge/serverless — no Node.js `dns` module needed.

## 3. Implementation Scope

### What this spec covers
- Subdomain routing (`{slug}.app.example.fr`) — automatic for all communes, no admin action needed
- Custom domain routing (`www.saint-martin.fr`) — admin configures in panel, DNS verification
- `custom_domain TEXT UNIQUE` and `domain_verified BOOLEAN` columns on communes
- Next.js middleware for hostname → commune resolution (handles subdomain, custom domain, and main platform)
- Admin UI for custom domain management (enter, verify, remove)
- Server action for DNS verification via public DNS API
- Update commune website layout links to use the correct domain

### What this spec does NOT cover
- CMS / page customization — separate feature
- SSL certificate management — automatic on Vercel and Caddy
- Platform migration to French hosting — ops decision
- Wildcard DNS setup instructions — one-time ops task documented in README

### Files
- Create: `apps/web/middleware.ts` — domain resolution
- Create: `apps/web/src/components/admin/domain-manager.tsx` — admin UI
- Create: `apps/web/src/app/admin/dashboard/domain-actions.ts` — server actions
- Modify: `apps/web/src/app/admin/dashboard/page.tsx` — add domain manager section
- Modify: `apps/web/src/app/[commune-slug]/layout.tsx` — adapt internal links for custom domain context
- Create: `supabase/migrations/007_custom_domains.sql`

### Environment variable
- `PLATFORM_DOMAIN` — the main platform domain (e.g. `app.example.fr`). Used by middleware to identify subdomains and by DNS verification to check CNAME targets. Defaults to `localhost:3000` in development.
