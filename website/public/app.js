const download = document.querySelector('#download');
const downloads = document.querySelector('#downloads');
const note = document.querySelector('#download-note');
const version = document.querySelector('#version');
const notes = document.querySelector('#notes');
const requirements = document.querySelector('#requirements');
const shot = document.querySelector('#shot');

shot.addEventListener('load', () => shot.classList.add('ready'));
shot.addEventListener('error', () => { shot.alt = ''; });

fetch('/api/status')
  .then((response) => {
    if (!response.ok) throw new Error('status');
    return response.json();
  })
  .then((status) => {
    version.textContent = `Version ${status.version}`;
    if (status.downloadsAvailable) downloads.textContent = `Downloads: ${status.downloads}`;
    else downloads.textContent = 'Downloads: unavailable';
    if (status.installerAvailable) {
      download.href = '/download?dl=1';
      download.setAttribute('aria-disabled', 'false');
      note.textContent = 'The button downloads BTP-Translator-Setup.exe. The number counts download requests, not completed installations.';
    } else {
      download.removeAttribute('href');
      note.textContent = 'The Windows installer is not in this website copy yet, so the button is disabled. Build it with npm run dist and place BTP-Translator-Setup.exe in website/releases.';
    }
    for (const item of status.notes ?? []) notes.append(itemRow(item));
    for (const item of status.requirements ?? []) requirements.append(itemRow(item));
  })
  .catch(() => {
    downloads.textContent = 'Downloads: unavailable';
    note.textContent = 'The download counter could not be reached.';
  });

function itemRow(text) {
  const item = document.createElement('li');
  item.textContent = text;
  return item;
}
