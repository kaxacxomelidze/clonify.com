/**
 * Bridge between the Clonyfy web app and the Clonyfy Helper (runs on Clonyfy pages only).
 * The app talks to it with window.postMessage; it forwards to the background worker and
 * relays capture progress back. It reads nothing from the page.
 */
(() => {
  const APP = 'clonyfy-app';
  const HELPER = 'clonyfy-helper';
  const version = chrome.runtime.getManifest().version;
  const toApp = (msg) => window.postMessage({ source: HELPER, ...msg }, window.location.origin);

  // Announce on every load, so the app knows it's installed (and can skip the install card).
  toApp({ type: 'helper_ready', version });

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const msg = event.data;
    if (!msg || msg.source !== APP) return;
    if (msg.type === 'ping') {
      toApp({ type: 'pong', version });
      return;
    }
    if (msg.type === 'capture') {
      chrome.runtime.sendMessage({
        type: 'capture',
        requestId: String(msg.requestId || ''),
        url: String(msg.url || ''),
        jobId: String(msg.jobId || ''),
        token: String(msg.token || ''),
        apiBase: String(msg.apiBase || ''),
      }).catch((err) => toApp({ type: 'progress', requestId: msg.requestId, stage: 'error', message: String(err?.message || err) }));
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'progress') toApp(msg);
  });
})();
