const INSTALLER_URL = 'https://github.com/hamdan4ahmedali-ship-it/BTP-Translator-Releases/releases/download/v1.0.0/BTP-Translator-Setup.exe';

const download = document.querySelector('#download');
const downloads = document.querySelector('#downloads');
const note = document.querySelector('#download-note');
const version = document.querySelector('#version');
const notes = document.querySelector('#notes');
const requirements = document.querySelector('#requirements');
const shot = document.querySelector('#shot');

shot.addEventListener('load', () => shot.classList.add('ready'));
shot.addEventListener('error', () => { shot.alt = ''; });

download.href = INSTALLER_URL;
downloads.textContent = 'Downloads: not available on this static site';
note.textContent = 'The button downloads BTP-Translator-Setup.exe from the published GitHub release. This page does not count downloads.';

fetch('/release-info.json')
  .then((response) => {
    if (!response.ok) throw new Error('release-info');
    return response.json();
  })
  .then((info) => {
    version.textContent = `Version ${info.version}`;
    for (const item of info.notes ?? []) notes.append(itemRow(item));
    for (const item of info.requirements ?? []) requirements.append(itemRow(item));
  })
  .catch(() => {
    version.textContent = 'Version unavailable';
  });

function itemRow(text) {
  const item = document.createElement('li');
  item.textContent = text;
  return item;
}
