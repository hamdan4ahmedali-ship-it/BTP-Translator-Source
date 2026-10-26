# BTP Translator

BTP Translator turns Python and Pybricks programs into Blockly blocks. It is a Windows desktop app owned by HAMDAN SYSTEMS and made by Hamdan Ahmed Iftikhar Ali.

After installation, translation runs on the computer. Users do not install Python, Node.js, or open a terminal.

## Development

Requirements for building: Node.js 24 or newer.

```powershell
npm install
npm test
npm run dev
```

`npm run dev` opens the Electron app. The first screen stays for five seconds. The second screen stays until Spacebar.

## Checks

```powershell
npm test
npm run test:website
npm run typecheck
```

## Installer

See [BUILDING.md](BUILDING.md). The installer is not part of the source tree until `npm run dist` succeeds.

## Website

See [docs/WEBSITE.md](docs/WEBSITE.md).

## What translates

See [docs/CAPABILITIES.md](docs/CAPABILITIES.md).
