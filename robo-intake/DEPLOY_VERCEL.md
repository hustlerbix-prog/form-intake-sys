# Vercel Deployment

This app is a full Next.js 14 server application with API routes, payments, scraping, PDF generation, and env-based integrations. It should be deployed to a Node-compatible platform such as Vercel, not plain FTP hosting.

## Why Not InfinityFree

InfinityFree is suitable for static or PHP-style hosting over FTP. This project requires:

- Next.js App Router server runtime
- API routes under `src/app/api/**`
- environment variables for server-side secrets
- Node execution for Stripe, MercadoPago, Braintree, Supabase, Retell, Playwright-related logic, and PDF generation

That makes Vercel the correct deployment target for the live app. Your `robo-ai.howto.rocks` domain can still point to Vercel.

## One-Time Setup

1. Push the repository to GitHub.
2. In Vercel, create a new project from that GitHub repo.
3. Set the root directory to `robo-intake`.
4. Add the GitHub Actions secrets in your GitHub repository:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

5. Add the required Vercel environment variables from `.env.example`.

## Minimum Production Variables

At minimum, configure these in Vercel before production deploy:

```text
APP_URL=https://robo-ai.howto.rocks
NEXT_PUBLIC_APP_URL=https://robo-ai.howto.rocks
ADMIN_TOKEN=...
SETTINGS_ENCRYPTION_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Then add the provider-specific secrets you use:

- AI: `ANTHROPIC_API_KEY` or admin-saved encrypted settings
- Voice: `RETELL_API_KEY`, `TWILIO_*`
- Payments: Stripe, MercadoPago, Braintree
- Email: `RESEND_API_KEY`
- Scraper fallback: `ZYTE_API_KEY`

## GitHub Actions Flow

The workflow file is:

- [vercel-deploy.yml](file:///Users/kevche_mini/Robo%20AI%20Agency/form_intake/.github/workflows/vercel-deploy.yml)

Behavior:

- Pull requests: runs tests and build, then deploys a Vercel preview
- Push to `main`: runs tests and build, then deploys production

## Domain Setup

Point your custom domain to Vercel instead of InfinityFree:

1. Add `robo-ai.howto.rocks` in Vercel Project Settings -> Domains
2. Update the DNS records at your domain provider as instructed by Vercel
3. Wait for DNS propagation
4. Update `APP_URL` and `NEXT_PUBLIC_APP_URL` in Vercel to the final domain

If the domain is currently only managed through InfinityFree, use its DNS panel only if it allows custom records that point to Vercel. Otherwise, move DNS management to a registrar or DNS provider that does.

## First Deploy Checklist

- `main` branch exists and is connected to GitHub
- Vercel project root is `robo-intake`
- all required env vars are set
- Supabase project is reachable
- payment webhooks are updated to the Vercel production URL
- admin settings show persisted storage, not only in-memory

## Security Note

Do not commit hosting passwords, FTP credentials, or production secrets to the repository.

If credentials were shared in chat or screenshots, rotate them after setup.
