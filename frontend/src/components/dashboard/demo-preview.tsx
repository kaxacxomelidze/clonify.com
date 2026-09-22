export { CloneEngine as ScanningBrowser } from "./clone-engine";

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

export function buildDemoHtml(title: string, accent: string, domain: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#101113;color:#f2efe9;font:16px/1.6 system-ui,sans-serif}nav,main,footer{max-width:1000px;margin:auto;padding:24px}nav{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #ffffff22;font-size:12px}main{padding-top:64px}small{color:#b8bbc2;letter-spacing:.15em}h1{font-size:clamp(40px,7vw,72px);line-height:1.05;letter-spacing:-.05em;max-width:750px;margin:24px 0}p{color:#b8bbc2;max-width:560px}a{color:inherit}.cta{display:inline-block;text-decoration:none;background:${accent};color:#17181b;border:0;border-radius:24px;padding:16px 24px;font:inherit;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:56px 0}.card{padding:24px;border:1px solid #ffffff22;border-radius:16px}.card h2{font-size:20px;font-weight:500}footer{border-top:1px solid #ffffff22;color:#b8bbc2;font-size:12px}</style></head><body><nav><strong>${escapeHtml(domain)}</strong><span>Clonyfy demo concept</span></nav><main><small>A NEW STARTING POINT</small><h1>${escapeHtml(title)}</h1><p>A responsive sample you can make your own. Change the headline, choose a tone and take the code with you.</p><a class="cta" href="#possibilities">Explore the possibilities ↗</a><section class="grid" id="possibilities">${["Designed to adapt", "Built to be yours", "Ready for the next step"].map((label, i) => `<article class="card"><small>0${i + 1}</small><h2>${label}</h2><p>Thoughtful details. Clear structure. Room to create something of your own.</p></article>`).join("")}</section></main><footer>Sample concept generated locally by Clonyfy’s dashboard demo. This is not a copy of ${escapeHtml(domain)}.</footer></body></html>`;
}

export function downloadDemoFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
