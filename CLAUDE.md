# Claude Code Context for Ascent

## Workflow

### 1. Plan First
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### 2. Verify Before Done
- Never mark a task complete without proving it works
- For UI changes: visually verify ONE instance before applying to many
- Build the app, check for errors, demonstrate correctness
- Ask yourself: "Would a staff engineer approve this?"

### 3. Self-Improvement Loop
- After ANY correction from the user: update memory files with the pattern
- Write rules for yourself that prevent the same mistake
- Review memory at session start

### 4. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 5. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user

### 6. Minimal Impact
- Make every change as simple as possible. Touch minimal code
- Find root causes. No temporary fixes. Senior developer standards
- Changes should only touch what's necessary. Avoid introducing bugs

---

## SECURITY: Never Commit Credentials

**CRITICAL:** This file is committed to a GitHub repository. NEVER include:
- Database passwords or connection strings
- API keys (Whoop, Vercel)
- Any secrets or tokens

For credentials, always use:
- Environment variable references: `$DATABASE_URL`, `$WHOOP_CLIENT_ID`
- References to where they're stored: "Get from Vercel environment variables"

---

## Deployment Process

**Vercel auto-deploy is NOT connected** — must deploy manually after push.

```bash
# 1. Commit and push to GitHub
git add <files>
git commit -m "message"
git push origin main

# 2. Deploy to Vercel
npx vercel deploy --prod
```

**TODO:** Connect GitHub repo in Vercel dashboard (Settings > Git) to enable auto-deploy.

### Infrastructure

- **Hosting:** Vercel
- **Database:** Neon PostgreSQL (serverless)
- **Domain:** ascent.matthewjamesschmidt.com
- **Cron:** Vercel Cron — daily at 6 AM UTC (`/api/whoop/sync`)
- **OAuth:** Whoop Developer API

---

## Project Structure

- **Framework:** Next.js 16, React 19
- **Database ORM:** Prisma 7 with Neon adapter (`@prisma/adapter-neon`)
- **UI:** Tailwind 4, shadcn/ui (base-ui, NOT Radix — no `asChild` prop, use `render` instead)
- **Auth:** Whoop OAuth 2.0 + JWT sessions (`jose`)
- **Animations:** Framer Motion

### Key Files
- `lib/sync.ts` — Whoop data sync logic (recovery, sleep, cycles, workouts, body)
- `lib/prisma.ts` — Prisma client singleton with Neon adapter
- `lib/auth.ts` — JWT session management
- `app/api/whoop/callback/route.ts` — OAuth callback, user upsert, post-login sync
- `app/api/auth/login/route.ts` — OAuth redirect (must include `offline` scope)
- `app/api/auth/refresh/route.ts` — Token refresh on app load
- `app/api/teams/[teamId]/compare/route.ts` — Team comparison data API
- `components/TeamCompare.tsx` — Team comparison dashboard UI
- `components/WhoopDashboard.tsx` — Personal dashboard UI
- `components/TokenRefresh.tsx` — Silent token refresh on app load

### Whoop OAuth
- Access tokens last ~7 hours
- Refresh tokens rotate on each use (old one invalidated)
- **CRITICAL:** The `offline` scope MUST be in the OAuth URL or no refresh token is returned
- Token refresh on app load + daily cron keeps the chain alive
- If refresh fails, `refreshToken` is nulled in DB and user sees "re-auth needed"

### Data Models
- `User` — Whoop credentials, profile info
- `Recovery` — daily recovery score, HRV, RHR, SpO2, skin temp
- `Sleep` — sleep stages, efficiency, performance, respiratory rate
- `Cycle` — day strain, calories, heart rate
- `Workout` — individual workouts with sport, HR zones, distance
- `BodyMeasurement` — height, weight, max HR
- `Team` / `TeamMember` — team management with invite codes
- `SyncLog` — sync audit trail

## UI Rules

### Dark Mode
- **Always use `text-muted-foreground` for secondary text** — NEVER use `text-muted` for text color (it's a background token, nearly invisible on dark backgrounds)
- Use CSS custom properties from `globals.css` for all colors
- Test contrast on the dark background before shipping

### shadcn/ui (base-ui)
- This project uses `@base-ui/react`, NOT Radix UI
- `asChild` prop does NOT exist — use `render` prop instead for composition
- Example: `<DialogTrigger render={<Button />}>` instead of `<DialogTrigger asChild><Button /></DialogTrigger>`

## Common Tasks

### Running locally
```bash
npm run dev
```

### Triggering a manual sync
```bash
# From local machine with .env loaded:
npx tsx -e "import 'dotenv/config'; import { syncUserData } from './lib/sync.js'; ..."

# Or via API (requires CRON_SECRET):
curl "https://ascent.matthewjamesschmidt.com/api/whoop/sync" -H "Authorization: Bearer $CRON_SECRET"
```

### Database changes
- Edit `prisma/schema.prisma`
- Run `npx prisma db push` to apply
- Run `npx prisma generate` to regenerate client

## Environment

- Dev config: `.env`
- Production config: Vercel environment variables

### Required Environment Variables:
- `DATABASE_URL` — Neon PostgreSQL connection string
- `WHOOP_CLIENT_ID` — Whoop OAuth app client ID
- `WHOOP_CLIENT_SECRET` — Whoop OAuth app client secret
- `CRON_SECRET` — Secret for protecting the sync endpoint
- `JWT_SECRET` — Secret for session JWT signing
- `NEXT_PUBLIC_BASE_URL` — App URL (https://ascent.matthewjamesschmidt.com)
