# kagent ContribFest: Filter Agents by Status

One sequential lab: warm runtime-image caches while adding a Status filter,
return revision state from the controller, then build the finished controller
and UI and install kagent 1.x with Substrate into Kind once.

The backend adds a pure Go calculation and an additive `revision_state`
response field. The UI uses it with an older-controller fallback. No database,
CRD, request-filter, pagination, or agent-runtime changes are needed.

## Materials

- [Participant guide](participant-guide.md): follow its ten chapters in order.

## Participant setup

Choose either environment; both use the kagent repository's Dev Container:

- **Browser:** open [kagent on GitHub](https://github.com/kagent-dev/kagent),
  then **Code > Codespaces > ... > New with options**. You need a GitHub
  account with Codespaces access and quota, but no local tools.
- **Local:** use Git, Docker Desktop (or another supported Docker engine),
  VS Code, and the Dev Containers extension, then **Reopen in Container**.

Follow the [participant guide](participant-guide.md) for branch selection,
automatic Kind setup, the pinned workshop source, and browser port forwarding.
Publish the updated Dev Container to the selected GitHub branch before sending
attendees there. Codespaces setup still needs an end-to-end presenter rehearsal.

## Website

```sh
npm install
npm run dev
```

Open the printed URL. Guide and site edits rebuild automatically; refresh the
browser to see changes. To build for static hosting, run `npm run build` and
publish `dist/`. You can also open `dist/index.html` directly.

The participant Markdown is the guide content source. Site code lives in `site/`
and the build script in `scripts/`.

## Deploy to Cloudflare

The deploy script builds the site and uploads only `dist/` to Cloudflare Pages.
Wrangler is installed locally with the project dependencies.
Project creation and deployments are pinned to **Solo.io** account
`7d33c874b75a7afed3a44c6126896050`. The script rejects a conflicting account
environment variable instead of selecting another account.

Log in once, then create and deploy the default project:

```sh
npm run cloudflare:login
npm run deploy -- --create
```

Later deployments only need:

```sh
npm run deploy
```

The default project is `kagent-contribfest-2026`, with `main` as its production
branch. Wrangler prints the deployment URL. Run `--create` only for a new
project; omit it if the project already exists. The site and downloaded guide
will be public.

To use a different project, deploy a preview branch, or check the commands
without publishing:

```sh
npm run deploy -- --project my-workshop --create
npm run deploy -- --project my-workshop --branch preview
npm run deploy -- --dry-run
```

Use the same project option for subsequent deployments, or set
`CLOUDFLARE_PAGES_PROJECT`. For CI, supply `CLOUDFLARE_API_TOKEN` through the
CI secret store instead of browser login; the account ID is already pinned.
The token needs Pages edit permission for the chosen account. Never put it in
the script or tracked configuration. Cloudflare Direct Upload projects do not
switch to Git integration later; that would require a new Pages project.
