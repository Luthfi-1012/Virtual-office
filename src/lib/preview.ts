import { previewSchema, rupiah } from './domain';

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export function renderPreview(input: unknown): string {
  const { content, version } = previewSchema.parse(input);
  const isCoffee = /kopi|coffee|espresso|senja/i.test(`${content.client} ${content.description}`);
  const eyebrowHero = isCoffee ? 'Kedai kopi · contoh sintetis' : 'Profil usaha · contoh sintetis';
  const eyebrowList = isCoffee ? 'Diseduh untuk jeda Anda' : 'Layanan & penawaran';
  const headingList = isCoffee ? 'Menu pilihan' : 'Daftar layanan & produk';
  const visualSvg = isCoffee
    ? `<svg viewBox="0 0 250 250" role="img" aria-label="Ilustrasi cangkir kopi orisinal"><ellipse cx="120" cy="199" rx="86" ry="15" fill="#303b29"/><path d="M169 101h20c40 0 40 61 0 61h-22" fill="none" stroke="#e1d7ba" stroke-width="15"/><path d="M52 95h128l-9 72c-4 33-101 33-108 0z" fill="#ece2c8"/><ellipse cx="116" cy="94" rx="64" ry="18" fill="#d0bf9c"/><ellipse cx="116" cy="94" rx="51" ry="12" fill="#624b34"/><path d="M92 63c-20-27 21-22 5-48m39 48c-20-27 21-22 5-48" fill="none" stroke="#d0bf9c" stroke-width="4" stroke-linecap="round"/></svg>`
    : `<svg viewBox="0 0 250 250" role="img" aria-label="Ilustrasi antarmuka studio"><rect x="34" y="46" width="182" height="148" rx="14" fill="#ece2c8"/><rect x="52" y="68" width="84" height="14" rx="4" fill="#46503b"/><rect x="52" y="94" width="146" height="10" rx="4" fill="#b7ae98"/><rect x="52" y="114" width="120" height="10" rx="4" fill="#b7ae98"/><rect x="52" y="142" width="66" height="32" rx="6" fill="#5b6446"/><rect x="128" y="142" width="70" height="32" rx="6" fill="#d0bf9c"/></svg>`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; connect-src 'none'; img-src 'none'; font-src 'none'">
<title>${escapeHtml(content.client)} — prototype internal</title>
<style>
*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;background:#f3efe4;color:#302c26;font:16px/1.65 Georgia,serif}header,main,footer{max-width:960px;margin:auto;padding:26px 38px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #c8c1b2}header strong{font-size:23px}small,.eyebrow,summary,dt{font:12px/1.6 Arial,sans-serif;letter-spacing:.07em}.hero{display:grid;grid-template-columns:1.2fr 1fr;gap:30px;align-items:center;padding:48px 0}.eyebrow{text-transform:uppercase;color:#5b6446}h1{font-weight:400;font-size:clamp(32px,6vw,58px);line-height:1.1;max-width:650px;overflow-wrap:anywhere}p{overflow-wrap:anywhere}.cup{background:#46503b;border-radius:50% 50% 4% 4%;padding:24px;min-height:250px;display:grid;place-items:center}.cup svg{width:100%;max-width:270px}h2{font-weight:400;font-size:30px}dl{border-top:1px solid #c8c1b2}dl div{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #c8c1b2;padding:16px 0}dt{font-size:15px;letter-spacing:0;overflow-wrap:anywhere}dd{margin:0;white-space:nowrap}details{border:1px solid #c8c1b2;padding:20px;margin:32px 0}summary{font-size:15px;cursor:pointer}summary:focus-visible{outline:3px solid #46503b;outline-offset:6px}footer{border-top:1px solid #c8c1b2;font:12px/1.7 Arial,sans-serif;color:#555148}footer p{margin:4px 0}@media(max-width:540px){header,main,footer{padding:22px}.hero{grid-template-columns:1fr;padding:18px 0}.cup{min-height:180px}.cup svg{max-width:190px}header{align-items:flex-start;gap:16px;flex-direction:column}}
</style></head><body><header><strong>${escapeHtml(content.client)}</strong><small>PROTOTYPE INTERNAL · V${version}</small></header>
<main><section class="hero" aria-label="Tentang usaha"><div><p class="eyebrow">${eyebrowHero}</p><h1>${escapeHtml(content.tagline)}</h1><p>${escapeHtml(content.description)}</p></div>
<div class="cup">${visualSvg}</div></section>
<section aria-label="${headingList}"><p class="eyebrow">${eyebrowList}</p><h2>${headingList}</h2><dl>${content.menu.map(item => `<div><dt>${escapeHtml(item.name)}</dt><dd>${escapeHtml(rupiah(item.price))}</dd></div>`).join('')}</dl></section>
<details><summary>Jam buka &amp; lokasi</summary><p>${escapeHtml(content.hours)}</p><p>${escapeHtml(content.location)}</p><p>Untuk ${escapeHtml(content.audience)}</p></details></main>
<footer><p>Data sintetis · tidak menerima pesanan, reservasi, atau pembayaran.</p><p>Template satu halaman. Bukan situs production dan tidak dipublikasikan.</p></footer></body></html>`;
}
