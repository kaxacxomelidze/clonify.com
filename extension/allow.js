// One-time allow: Chrome only shows its permission prompt from a click inside the extension.
const params = new URLSearchParams(location.search);
const requestId = params.get('requestId') || '';
const site = (params.get('site') || '').toLowerCase();
const bare = site.replace(/^www\./, '');
const scheme = params.get('scheme') === 'http' ? 'http' : 'https';
document.getElementById('site').textContent = bare || 'this site';

const reply = (granted) => chrome.runtime.sendMessage({ type: 'allow-result', requestId, granted });

document.getElementById('allow').addEventListener('click', async () => {
  const always = document.getElementById('always').checked;
  // The site and its subdomains — or, if the user chose it, every site (standing allow).
  const origins = always ? ['https://*/*', 'http://*/*'] : [`${scheme}://*.${bare}/*`];
  let granted = false;
  try { granted = await chrome.permissions.request({ origins }); } catch { granted = false; }
  await reply(granted);
  window.close();
});

document.getElementById('cancel').addEventListener('click', async () => {
  await reply(false);
  window.close();
});
