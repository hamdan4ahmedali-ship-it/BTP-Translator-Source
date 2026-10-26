# Building the Windows installer

The installer is produced on this Windows PC with Electron Builder. End users do not run these commands.

```powershell
npm install
npm test
npm run typecheck
npm run dist
```

`npm run dist` generates the icon, builds the Electron app, and runs `electron-builder --win`. A successful build writes:

`release/BTP-Translator-Setup.exe`

The same command copies that file to:

`website/releases/BTP-Translator-Setup.exe`

If the copy step reports that the installer is missing, the website download button stays disabled.

The installer is an NSIS wizard. It lets the user choose a folder, adds a Start menu shortcut, can add a desktop shortcut, and includes an uninstaller. The packaged app contains the Electron runtime. A person who installs it does not need Python, Node.js, or a terminal.

Do not treat the installer as built until `release/BTP-Translator-Setup.exe` exists on disk and `npm run dist` finished without an error. Installing that file on a separate Windows PC, with no development tools, is a separate test. This repository's build log is not that test.

If packaging stops because an Electron Builder install script was blocked, approve that package's install script in npm and run `npm run dist` again.

The download website is documented in [docs/WEBSITE.md](docs/WEBSITE.md). Building the installer does not publish the website.
