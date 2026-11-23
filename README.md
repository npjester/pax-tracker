# PAX Tracker

An unofficial, invite-only PAX Unplugged booth planner. React + Vite serves the frontend on Vercel; Supabase Auth and Postgres provide email sign-in and private cross-device progress. The original HTML export provides an optional starter shortlist, not an official directory. Verify booth numbers and availability before using it on the show floor.

## Set up the backend

1. Use separate Supabase projects for preview and production. Apply the files in `supabase/migrations/` in filename order in each project's SQL Editor. The database enforces account ownership on both tables, including the parent booth for each game.
2. In Authentication, enable the Email provider and disable **Allow new users to sign up**. Under **Users**, create or invite an account for each approved email address. If creating users manually, mark their emails confirmed; don't share the temporary passwords. The app uses email codes rather than passwords.
3. Configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) first; hosted Supabase requires it to edit email templates. Then go to **Authentication > Email Templates > Magic Link or OTP**, set the subject to `Your PAX Tracker sign-in code`, and paste [the email template](supabase/templates/magic-link-or-otp.html) into the body. Keep `{{ .Token }}` intact: Supabase replaces it with the one-time code.
4. Copy `.env.example` to `.env.local` and use the preview project's URL and **publishable** key. Only these public values belong in Vite environment variables; never use a service-role key or an SMTP credential there.

## Run and deploy

- Local: use Node.js 22, run `npm ci` and `npm run dev`. `npm run build` type-checks and builds the site.
- Local UI preview without sign-in: run `VITE_LOCAL_PREVIEW=true npm run dev -- --host 127.0.0.1`. Preview data stays in this browser's local storage and never connects to Supabase; it is separate from your account. This mode works only in the Vite development server on localhost and is disabled in production builds.
- Database: run `supabase/tests/isolation.sql` against a development Supabase database after applying the migration. It checks account isolation and rolls back its test data.
- Vercel: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for **Preview** and **Production** using the corresponding Supabase project. Push the branch or redeploy after changing variables; Vite reads them at build time.
- Before merging, sign in with an approved test user on two devices or browser profiles. Load the shortlist, mark a booth visited on one, and refresh the other. Then try a second account and confirm it starts with an empty list.

Checklist data is stored in Supabase; the browser only stores the auth session. The **Refresh** button fetches changes made on another device. **Export list** downloads a human-readable snapshot; it is not an import or restore format. Offline edits are not supported.

**Update booths** loads the public 2026 PAX Unplugged exhibitor directory on demand. Search by exhibitor or booth number, then import a stop or explicitly update a matching booth number without changing your progress. If the directory is offline, you can still add a booth manually.

**Collection** accepts the original BoardGameGeek **Collection → Download board games → all** CSV. Imports replace the saved collection. Only IDs, titles, publisher names, owned/want flags, and personal ratings sync to your account; the original CSV and other columns are not stored. Game-title matches use the official PAX Games & Goods listings, while publisher matches use the full expo exhibitor directory. Exact listed games rank ahead of publisher-only matches; within each match type, suggestions prioritize wanted games, then ratings of 8 or higher, then owned games. **Import owned-game booths** adds matching booths for owned games without replacing existing stops. **Refresh suggestions** reloads the saved collection and current PAX listings; upload a new CSV to incorporate changes made on BGG. The listings are partial, so no match does not mean a game won't be at the show. Removing the collection does not remove any saved booth stops.

**Map & route** is a prototype covering ten booths along one Hall B aisle from the [official 2026 expo map](https://unplugged.paxsite.com/philly/en-us/info/maps.html). Choose all unvisited, all, or selected checklist booths and a mapped starting booth. Unmapped and ambiguous booth numbers are listed separately, not routed. The schematic is not to scale. The Queue entrance near booth 1821 is outside the mapped section, so entrance starts are not yet available. Check the official map on site.

**Games** keeps separate Games to Try and Games to Buy lists with manual additions and checkboxes. Importing BGG want-to-buy games adds missing titles without removing existing entries. Collections imported before this feature must be re-imported from a CSV containing the `wanttobuy` column. Apply the latest migration before using these lists.
