# Deploy Data Center Decision Studio (no accounts or database)

## How visitor-specific settings work

The application contains one factory baseline in `src/model-data.json` and `src/fm-data.json`. All visitors load that same baseline but changes are written to **their own browser's `localStorage`**, under `dc-decision-studio-v1` (and optional saved personal defaults under `dc-decision-studio-personal-defaults-v1`). No edits go to GitHub, the website server, or other visitors.

- Inputs, selected scenario, rankings, diligence decisions, and saved checkpoints autosave on change and persist on refresh and subsequent visits with the same browser profile and hostname.
- **Save & export → Save current as my defaults** preserves a personal reference point. **Apply my defaults** restores that saved snapshot. **Clear this browser** deletes all local settings and those personal defaults from this browser profile.
- **Export project JSON** makes a backup. **Import project JSON** restores settings on another device. There is **no device sync**.
- Users sharing the same browser profile and website hostname share the same saved settings; private browsing sessions are temporary. Site data deletion also resets everything.
- The entire website and baseline JSON are downloadable to any visitor if the site is publicly hosted. `localStorage` isolates **edits**, not access to the underlying financial assumptions.

## Option A — GitHub Pages (public demo or nonconfidential project ONLY)

1. In GitHub, choose **New repository** and name it `data-center-decision-studio`. A *private repository* protects source visibility but **does not make its GitHub Pages website private**. Only use this route if everyone on the internet may read the baseline underwriting data and source files shipped in `dist/`.
2. Extract the **Source.zip** package. Upload its **contents**, preserving the `.github/workflows/publish-pages.yml` and `src/` directories. You can drag folders into GitHub's **Add file → Upload files** interface or push from a local Git checkout. Commit to the `main` branch.
3. Open **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Open **Actions → Publish site to GitHub Pages → Run workflow** on `main`. Check **"I understand the website and its baseline model data will be public"** to authorize publication.
5. Open the deployed address displayed by the action (typically `https://OWNER.github.io/data-center-decision-studio/`). Check the **Overview**, **Scenario Inputs**, **FM Budget**, and **Save & export** pages. Edit a harmless input, refresh, confirm it remains. Visit in an unrelated browser profile to confirm it starts from the factory baseline.

The workflow does **not** publish automatically on every push; it requires an intentional manual run because the baseline may be commercially confidential. Any subsequent publish also requires another manual run. The `Test and build` workflow runs on pushes without publishing.

You can use your own domain later. If the domain changes, browser settings from the previous domain do not migrate automatically; export/import JSON first.

## Option B — private shared app using GitHub + access-controlled hosting (recommended for actual projects)

1. Create a **private repository** with the source package.
2. Connect that repo to your static-site host, e.g. Cloudflare Pages. Build command: `npm run build`. Output folder: `dist`. Node.js: 22.
3. Require authentication **before** static files are served. On Cloudflare, use a production-domain Cloudflare Access policy for only the approved visitor email addresses, and protect preview/deployment URLs separately. Do not rely on Pages' preview-only Access toggle to secure the production `pages.dev` domain.
4. Confirm an anonymous visitor cannot open `https://YOURDOMAIN/src/model-data.json`. Anyone who can access the site can inspect its bundled baseline JSON; do not embed secret API keys or private credentials in these files.
5. Visitors still get completely independent local settings with no application accounts or database. The hosting identity check is separate from the app.

## Test locally

```bash
node --version  # v22 or later
npm test
npm run build
npm run dev
```

Open `http://127.0.0.1:4173/`. Browser settings are scoped to this origin and do not automatically transfer to GitHub Pages or another host. Export your project JSON for migration.

## GitHub command-line alternative

```bash
# In the directory containing package.json, after creating a private GitHub repo:
git init
git branch -M main
git add .
git commit -m "Initial Data Center Decision Studio"
git remote add origin https://github.com/OWNER/data-center-decision-studio.git
git push -u origin main
```

Replace `OWNER` with your account/organization. Don't push the raw real-world workbook, `.env` files, passwords, API keys, or confidential customer documents. The private baseline JSON is already included in the source package and will be exposed upon public Pages deployment.

## Limits of the financial model

The website preserves the workbook baseline results. Changed input economics are **provisional screening estimates**, not a fully reconciled replacement for Excel; lender covenants, replacement commitments, dated flows, taxes, and sponsor waterfalls still need independent validation. Public hosting does not change that limitation.
