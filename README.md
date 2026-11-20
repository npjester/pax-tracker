# PAX Tracker

An unofficial, invite-only PAX Unplugged booth planner. React + Vite serves the frontend on Vercel; Supabase Auth and Postgres provide email sign-in and private cross-device progress. The original HTML export provides an optional starter shortlist, not an official directory. Verify booth numbers and availability before using it on the show floor.

## Set up the backend

1. Use separate Supabase projects for preview and production. Apply `supabase/migrations/20261120182500_tracker.sql` in each project's SQL Editor. The database enforces account ownership on both tables, including the parent booth for each game.
2. In Authentication, enable the Email provider and disable **Allow new users to sign up**. Under **Users**, create or invite an account for each approved email address. If creating users manually, mark their emails confirmed; don't share the temporary passwords. The app uses email codes rather than passwords.
3. Under **Email Templates**, update **Magic Link** to include the one-time code instead of a link, for example `<p>Your PAX Tracker sign-in code is <strong>{{ .Token }}</strong>.</p>`. The same template is used to send codes. Before production, configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp); Supabase's default sender is restricted to project team addresses and has strict rate limits.
4. Copy `.env.example` to `.env.local` and use the preview project's URL and **publishable** key. Only these public values belong in Vite environment variables; never use a service-role key or an SMTP credential there.

## Run and deploy

- Local: use Node.js 22, run `npm ci` and `npm run dev`. `npm run build` type-checks and builds the site.
- Database: run `supabase/tests/isolation.sql` against a development Supabase database after applying the migration. It checks account isolation and rolls back its test data.
- Vercel: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for **Preview** and **Production** using the corresponding Supabase project. Push the branch or redeploy after changing variables; Vite reads them at build time.
- Before merging, sign in with an approved test user on two devices or browser profiles. Load the shortlist, mark a booth visited on one, and refresh the other. Then try a second account and confirm it starts with an empty list.

Checklist data is stored in Supabase; the browser only stores the auth session. The **Refresh** button fetches changes made on another device. **Export list** downloads a human-readable snapshot; it is not an import or restore format. Offline edits are not supported.
