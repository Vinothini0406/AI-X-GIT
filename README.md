# Dionysus AI Git Workspace

A modern AI workspace for GitHub repositories. Dionysus helps teams connect repositories, sync commit history, generate AI summaries, ask repository-aware questions, and manage billing from a clean Next.js dashboard.

Built with Next.js, Clerk, tRPC, Prisma, PostgreSQL, Google Gemini, GitHub OAuth, and Stripe.

## Features

- Minimal SaaS landing page with Google and GitHub authentication
- Protected workspace routes with a smooth user sync flow after login
- Clean dashboard with selected-repository context, activity metrics, commit insights, and smart suggestions
- Repository Q&A powered by Google Gemini
- GitHub repository linking by URL
- GitHub import flow for users authenticated with GitHub
- Commit sync and AI commit summaries
- Stripe Checkout billing flow with Basic and Early Access plans
- Payment records and invoices stored in PostgreSQL
- Responsive black-and-white UI built with Tailwind CSS and shadcn-style components

## Tech Stack

| Area      | Technology                                   |
| --------- | -------------------------------------------- |
| Framework | Next.js 15, React 19, TypeScript             |
| Auth      | Clerk                                        |
| API       | tRPC, TanStack Query                         |
| Database  | PostgreSQL, Prisma                           |
| AI        | Google Gemini                                |
| GitHub    | Octokit, GitHub OAuth tokens                 |
| Billing   | Stripe Checkout and webhooks                 |
| UI        | Tailwind CSS, Radix UI, lucide-react, Sonner |

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd AI-X-GIT
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Then fill in the required values.

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/git"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Google Gemini
GEMINI_API_KEY=

# GitHub
GITHUB_TOKEN=
GITHUB_REPO_URL=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Optional auth notifications
RESEND_API_KEY=
AUTH_NOTIFY_FROM="onboarding@resend.dev"
AUTH_NOTIFY_TO=
```

Notes:

- Clerk keys are required for authentication.
- Enable Google and GitHub providers in your Clerk dashboard.
- For GitHub import, enable GitHub OAuth in Clerk and request repository read access.
- `GITHUB_TOKEN` is optional for public repos, but recommended for private repository sync and higher GitHub API limits.
- Stripe keys are required only for checkout and billing flows.

### 4. Set up the database

```bash
npm run db:push
```

You can open Prisma Studio with:

```bash
npm run db:studio
```

### 5. Run the development server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Authentication Flow

The app uses Clerk for authentication.

1. Users land on `/`.
2. Users sign in with Google or GitHub.
3. Clerk redirects to `/sync-user`.
4. The app syncs the Clerk user into PostgreSQL.
5. The user is redirected to `/dashboard`.

Protected workspace routes are blocked for signed-out users and redirect back to the landing page.

## GitHub Import

Users who authenticate with GitHub see an `Import from GitHub` button on the create project page.

The import flow:

1. Reads the user's GitHub OAuth token securely on the server through Clerk.
2. Fetches repositories with Octokit.
3. Displays searchable repositories in a modal.
4. Creates or links the selected repository as a project.
5. Redirects the user to the dashboard with the imported project selected.

The GitHub token is never exposed to the browser.

## Stripe Billing

Billing uses Stripe Checkout and a webhook endpoint.

Plans:

| Plan                   |                Price | Notes                                                         |
| ---------------------- | -------------------: | ------------------------------------------------------------- |
| Basic                  | Rs. 20 display price | Checkout uses the minimum Stripe-supported amount when needed |
| Early Access / Premium |              Rs. 499 | Full early access plan                                        |

For local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Add the generated webhook secret to:

```env
STRIPE_WEBHOOK_SECRET=
```

## Available Scripts

```bash
npm run dev          # Start local development server
npm run build        # Create production build
npm run start        # Start production server
npm run preview      # Build and start production server
npm run typecheck    # Run TypeScript checks
npm run lint         # Run Next.js lint
npm run lint:fix     # Run lint with fixes
npm run format:check # Check formatting
npm run format:write # Format supported files
npm run db:push      # Push Prisma schema to database
npm run db:migrate   # Run production migrations
npm run db:studio    # Open Prisma Studio
```

## Project Structure

```text
src/
  app/
    (protected)/       Protected dashboard, create, QA, and billing pages
    api/               tRPC, Stripe webhook, auth sync API
    sign-in/           Clerk sign-in routes
    sign-up/           Clerk sign-up routes
    sync-user/         Post-login user sync transition
  components/
    auth/              Clerk appearance and auth shell
    landing/           Landing page background and OAuth CTA components
    ui/                Reusable UI primitives
  hooks/               Client hooks for selected project and refetching
  lib/                 Gemini and GitHub helpers
  server/
    api/               tRPC routers
    auth/              Server-side user sync helpers
    billing/           Stripe helpers
    github/            GitHub OAuth repository import helpers
    notifications/     Auth notification email helpers
  styles/              Global Tailwind styles
prisma/
  schema.prisma        Database schema
```

## Deployment

The easiest deployment target is Vercel.

Before deploying:

1. Create a PostgreSQL database.
2. Add all required environment variables to your hosting provider.
3. Configure Clerk production URLs.
4. Configure Stripe webhook URL:

```text
https://your-domain.com/api/stripe/webhook
```

5. Run database migrations:

```bash
npm run db:migrate
```

## Troubleshooting

### GitHub import button does not show

The user must sign in with GitHub and Clerk must have a GitHub OAuth token for that user. Check that GitHub is enabled in Clerk and that repository scopes are configured.

### Stripe says the amount is too low

Stripe enforces minimum charge amounts. The Basic plan can show a lower previous price while checkout uses a compliant minimum amount.

### Private repositories do not sync

Add a valid `GITHUB_TOKEN` with repository read access to `.env`, then restart the dev server.

### User stays on `/sync-user`

Check Clerk environment variables, database connectivity, and server logs for sync errors.

## License

No license has been specified yet. Add a license before publishing the repository publicly.
