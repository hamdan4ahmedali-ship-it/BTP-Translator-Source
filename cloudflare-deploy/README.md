# BTP Translator website for Cloudflare Pages

Upload this folder only. It is a static copy of the public page. It does not contain the Windows installer, the Node.js server, source code, or private data.

The live counter and installer download still belong to the Node server in `website/`. This folder does not replace that server.

## Direct Upload

Cloudflare’s drag-and-drop upload accepts one folder or one zip. Each file must be 25 MiB or smaller, which is why `BTP-Translator-Setup.exe` is not included.

1. Open the Cloudflare dashboard and go to **Workers & Pages**.
2. Choose **Create application**, then **Get started**, then the drag-and-drop option.
3. Name the project.
4. Drag this `cloudflare-deploy` folder, or a zip of the files inside it, into the upload area. Do not upload the BTP Translator project root.
5. Deploy the site.

Cloudflare serves it at `https://<project-name>.pages.dev`. Attaching `btptranslator.linkpc.net` is a separate DNS step. This folder does not change DNS.

A Direct Upload project cannot later be switched to Git deployments. Create a new project if you want Git later.

Wrangler can deploy the same folder with `npx wrangler pages deploy cloudflare-deploy`. Drag and drop does not compile a `functions` directory. This folder has no Functions and no Worker.

## Download button

The button opens the published GitHub Release asset:

`https://github.com/hamdan4ahmedali-ship-it/BTP-Translator-Releases/releases/download/v1.0.0/BTP-Translator-Setup.exe`

The installer stays on GitHub. It is not uploaded to Cloudflare. This static page still does not count downloads.

## Download counter

The existing counter is not in this folder because it needs the Node server:

- `GET /download?dl=1` sends the installer and counts the request.
- Page views, `/api/downloads`, `/api/status`, and `/health` do not count.
- Repeats from the same browser inside 60 seconds do not count again.
- The count is stored in `website/data/downloads.json` on the PC. The stored value is a hash, not the visitor’s address.

Cloudflare Pages cannot write that file. This page therefore says **Downloads: not available on this static site**. It does not show a made-up number.

The smallest safe replacement, after a real installer URL exists, is one Cloudflare Worker with a KV namespace. The Worker increments one key when someone requests the download, then redirects to the real file. Do not count ordinary page loads. Dashboard drag and drop will not provide that KV binding by itself.

## What this site does not provide

`/health`, `/api/status`, `/api/downloads`, and `/download` are Node routes. They are not part of this static site and will not answer on Cloudflare Pages. Opening the home page, the version, the release notes, and the requirements does work, because those come from `release-info.json`.
