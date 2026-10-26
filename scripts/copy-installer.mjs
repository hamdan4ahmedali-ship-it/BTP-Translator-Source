import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'release', 'BTP-Translator-Setup.exe');
const targetDir = join(root, 'website', 'releases');
const target = join(targetDir, 'BTP-Translator-Setup.exe');

if (!existsSync(source)) {
  console.error('No installer was found at release/BTP-Translator-Setup.exe. The website download stays disabled until that file exists.');
  process.exit(1);
}
mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log(`Copied installer to ${target}`);
