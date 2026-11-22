'use client';
import { useState } from 'react';
import type { OfficeJob } from '@/server/store';
import { rupiah } from '@/lib/domain';
import { escapeHtml, renderPreview } from '@/lib/preview';

export const statusLabel = { waiting_for_founder: 'Menunggu founder', approved: 'Disetujui internal', failed_qa: 'Validasi gagal' };
const time = (value: string) => new Date(value).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' });

function downloadInvoiceHtml(invoice: NonNullable<OfficeJob['package']>['invoice']) {
  const rows = invoice.items.map(item => `<tr><td>${escapeHtml(item.label)}</td><td>${item.quantity}</td><td class="num">${escapeHtml(rupiah(item.price))}</td></tr>`).join('');
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'">
<title>Draft Invoice ${escapeHtml(invoice.invoiceId)}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#24372d}h1{margin:0 0 6px}small{color:#5c6a62}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:12px 8px;border-bottom:1px solid #d7ded3;text-align:left}th.num,td.num{text-align:right}tfoot th,tfoot td{font-weight:700;font-size:17px}.note{padding:14px;background:#f4f5ef;border-radius:8px;font-size:13px;color:#4f5f56}</style></head>
<body><small>WEB DELIVERY STUDIO · DRAFT INVOICE INTERNAL</small><h1>${escapeHtml(invoice.client)}</h1><p>ID: ${escapeHtml(invoice.invoiceId)} · Paket Preview v${invoice.previewVersion} (Invoice v${invoice.version})</p>
<table><thead><tr><th>Deskripsi</th><th>Qty</th><th class="num">Biaya (IDR)</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="2">Total draft</th><td class="num">${escapeHtml(rupiah(invoice.total))}</td></tr></tfoot></table>
<div class="note">Pajak belum dihitung. Dokumen ini adalah draft penagihan internal yang terikat versi preview v${invoice.previewVersion}; persetujuan & pengiriman akhir dilakukan oleh founder.</div></body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice-${invoice.invoiceId}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function JobPanel({ job, disabled, onDecide, onRevise, onReplayFlow }: { job: OfficeJob; disabled: boolean; onDecide: (decision: 'approve' | 'hold') => void; onRevise: () => void; onReplayFlow?: () => void }) {
  const [tab, setTab] = useState('Ringkasan');
  const [previewWidth, setPreviewWidth] = useState('desktop');
  const [billingFeedback, setBillingFeedback] = useState('');
  const packet = job.package;
  const run = job.runs.find(item => item.version === job.version)!;
  const steps = job.steps.filter(item => item.runId === run.id);
  let srcDoc: string | null = null;
  try { if (packet) srcDoc = renderPreview(packet.preview); } catch { srcDoc = null; }

  async function copyBillingDraft() {
    if (!packet) return;
    const lines = packet.invoice.items.map(item => `- ${item.label} (${item.quantity}x): ${rupiah(item.price)}`).join('\n');
    const draft = [
      `Subjek: Draft Tagihan Paket Website Internal — ${packet.invoice.client} (${packet.invoice.invoiceId})`,
      '',
      `Halo tim ${packet.invoice.client},`,
      `Berikut ringkasan draft biaya untuk preview paket v${packet.invoice.previewVersion}:`,
      lines,
      `Total: ${rupiah(packet.invoice.total)} (pajak belum termasuk)`,
      '',
      'Mohon konfirmasi sebelum finalisasi penagihan.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(draft);
      setBillingFeedback('Draft email tagihan tersalin ke clipboard.');
    } catch {
      setBillingFeedback('Clipboard tidak diizinkan; gunakan tombol unduh draft invoice.');
    }
  }

  return <section className="job-panel panel" aria-label="Paket pekerjaan">
    <div className="section-heading"><div><span className="eyebrow">PEKERJAAN TERPILIH · SINTETIS</span><h2>{job.brief.client}</h2></div><div className="job-meta"><span className="badge" data-testid="package-version">Versi {job.version}</span><span className={`badge ${job.status === 'approved' ? 'good' : 'warm'}`} data-testid="job-status">{statusLabel[job.status]}</span></div></div>
    <div className="pipeline" aria-label="Tahap pemrosesan lokal">{['intake', 'delivery', 'billing'].map((stage, index) => {
      const step = steps.find(item => item.stage === stage);
      return <div key={stage}><span className={step?.status === 'completed' ? 'step-number complete' : 'step-number'}>{step?.status === 'completed' ? '✓' : index+1}</span><span>{['Client Intake', 'Client Delivery', 'Billing'][index]}<small>{step ? step.status === 'completed' ? 'Selesai · lokal' : 'Gagal · lokal' : 'Belum diproses'}</small></span>{index < 2 && <span className="pipeline-arrow" aria-hidden="true">→</span>}</div>;
    })}</div>
    <p className="scope-note">Alur di atas adalah pemrosesan fixture lokal, bukan eksekusi atau handoff Waker.</p>
    <nav className="tabs" aria-label="Bagian hasil pekerjaan">{['Ringkasan', 'Preview', 'Invoice', 'Riwayat'].map(name => <button key={name} onClick={() => setTab(name)} aria-pressed={tab === name}>{name}</button>)}</nav>
    <div key={tab} className="tab-content tab-panel-fade">
      {tab === 'Ringkasan' && <div className="summary-grid"><div><h3>Hasil yang dapat ditinjau</h3><p>{job.brief.description}</p><dl className="facts"><div><dt>Scope</dt><dd>{/kopi|coffee|espresso|senja/i.test(`${job.brief.client} ${job.brief.description}`) ? 'Satu halaman · template kedai kopi' : 'Satu halaman · template profil usaha'}</dd></div><div><dt>Sumber</dt><dd>Proses lokal deterministik</dd></div><div><dt>Run lokal</dt><dd className="mono">{run.id}</dd></div><div><dt>Tindak lanjut</dt><dd>{job.status === 'approved' ? 'Keputusan tersimpan; tidak ada pengiriman.' : packet ? 'Founder meninjau preview dan invoice.' : 'Periksa brief atau kontrak output.'}</dd></div></dl></div><div><h3>Validasi paket</h3>{packet ? <ul className="qa-list">{packet.qa.map(check => <li key={check.name}><span aria-hidden="true">✓</span>{check.name}</li>)}</ul> : <p className="notice error">Paket gagal validasi. Tidak ada hasil atau approval yang diloloskan.</p>}<p className="muted">Pemeriksaan struktur dan konsistensi data, bukan bukti pengujian browser atau QA Waker.</p></div></div>}
      {tab === 'Preview' && <><div className="preview-toolbar"><span>Prototype internal · {job.brief.client}</span><div><button onClick={() => setPreviewWidth('desktop')} aria-pressed={previewWidth === 'desktop'}>Lebar</button><button onClick={() => setPreviewWidth('mobile')} aria-pressed={previewWidth === 'mobile'}>Ponsel</button></div></div>{srcDoc ? <div className={`preview-frame ${previewWidth}`}><iframe title="Preview website internal" sandbox="" referrerPolicy="no-referrer" srcDoc={srcDoc}/></div> : <p className="notice error" role="alert">Preview belum tersedia atau tidak valid. Approval diblokir.</p>}<details><summary>Manifest dan batas preview</summary><p>Hanya teks terstruktur, menu, dan disclosure jam buka/lokasi. Tanpa script, form, gambar eksternal, pesanan atau pembayaran.</p><pre>{JSON.stringify({ jobId: job.id, runId: run.id, version: job.version, template: packet?.preview.template, synthetic: true, production: false }, null, 2)}</pre></details></>}
      {tab === 'Invoice' && (packet ? <article className="invoice"><div className="section-heading"><div><span className="eyebrow">DRAFT INTERNAL TERIKAT PREVIEW</span><h3>Invoice simulasi</h3></div><span className="badge warm">terkirim (simulasi)</span></div><p>Untuk <strong>{packet.invoice.client}</strong> · klien sintetis</p><p className="mono invoice-id">{packet.invoice.invoiceId} · v{packet.invoice.version}</p><div className="table-scroll"><table><caption className="sr-only">Item biaya fiktif invoice simulasi</caption><thead><tr><th scope="col">Deskripsi</th><th scope="col" className="num">Jumlah</th><th scope="col" className="num">Harga fixture</th></tr></thead><tbody>{packet.invoice.items.map(item => <tr key={item.id}><td>{item.label}</td><td className="num">{item.quantity}</td><td className="num">{rupiah(item.price)}</td></tr>)}</tbody><tfoot><tr><th scope="row" colSpan={2}>Total simulasi</th><td className="num" data-testid="invoice-total">{rupiah(packet.invoice.total)}</td></tr></tfoot></table></div><div className="button-row invoice-actions"><button type="button" onClick={() => { downloadInvoiceHtml(packet.invoice); setBillingFeedback('File draft invoice HTML diunduh.'); }}>Unduh Draft Invoice (.html)</button><button type="button" onClick={() => void copyBillingDraft()}>Salin Draft Email Tagihan</button></div>{billingFeedback && <p className="muted" role="status">{billingFeedback}</p>}<p>Pajak: <strong>tidak dihitung</strong> — bukan tarif 0% atau pembebasan pajak.</p><p className="scope-note">Nilai fiktif, bukan tarif jasa sah. Draft internal ini tidak otomatis mengirim tagihan atau memproses pembayaran; terhubung ke preview v{packet.invoice.previewVersion}.</p></article> : <p>Invoice belum tersedia. Validasi Delivery harus lulus terlebih dahulu.</p>)}
      {tab === 'Riwayat' && <><h3>Jejak kerja tersimpan</h3><ol className="timeline">{job.audit.map(event => <li key={event.id}><span className="timeline-dot"/><div><p>{event.message}</p><span className="muted">v{event.version} · <time dateTime={event.createdAt}>{time(event.createdAt)}</time></span></div></li>)}</ol><details><summary>Versi artefak ({job.artifacts.length})</summary><ul>{job.artifacts.map(item => <li key={item.id}>{item.kind} · v{item.version} · <span className="mono">{item.runId}</span></li>)}</ul></details></>}
    </div>
    <div className="approval-bar"><div><strong>Keputusan founder</strong><p>Terikat paket v{job.version}; persetujuan hanya untuk preview dan invoice simulasi internal.</p></div><div className="button-row">{onReplayFlow && <button type="button" onClick={onReplayFlow}>Simulasikan alur tim di 3D</button>}<button onClick={onRevise} disabled={disabled}>Revisi brief</button><button onClick={() => onDecide('hold')} disabled={disabled || !packet || !srcDoc || job.status !== 'waiting_for_founder'}>Tahan paket</button><button className="primary" onClick={() => onDecide('approve')} disabled={disabled || !packet || !srcDoc || job.status !== 'waiting_for_founder'}>Setujui paket internal</button></div></div>
  </section>;
}
