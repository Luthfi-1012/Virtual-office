'use client';
import { useState, useRef, useEffect } from 'react';
import { briefSchema, type Brief } from '@/lib/domain';
import { kopiSenja } from '@/lib/fixture';

const empty: Brief = { client: '', tagline: '', audience: '', description: '', location: '', hours: '', menu: [{ name: '', price: 0 }], synthetic: true };
const labels = { client: 'Nama klien sintetis', tagline: 'Tagline', audience: 'Audiens', description: 'Deskripsi kedai', location: 'Lokasi contoh', hours: 'Jam buka' };
export function BriefForm({ initial, busy, submitBlocked = false, nativeSubmitBlocked = false, onSubmit, onNativeSubmit, onCancel }: { initial?: Brief; busy: boolean; submitBlocked?: boolean; nativeSubmitBlocked?: boolean; onSubmit: (brief: Brief) => Promise<void>; onNativeSubmit?: (brief: Brief) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState<Brief>(initial ?? empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="brief-form panel" aria-label="Form brief">
    <div className="section-heading"><div><span className="eyebrow">INTAKE · DATA SINTETIS SAJA</span><h2 tabIndex={-1} ref={heading}>{initial ? 'Revisi brief' : 'Brief baru'}</h2></div><button onClick={onCancel} disabled={busy}>Batal</button></div>
    <p>Template kedai kopi satu halaman: pengenalan, menu, serta jam buka & lokasi. Tanpa formulir, pemesanan, backend klien, atau publikasi.</p>
    <form noValidate onSubmit={async event => {
      event.preventDefault();
      if (busy || submitBlocked) return;
      const result = briefSchema.safeParse(value);
      if (!result.success) { setErrors(Object.fromEntries(result.error.issues.map(issue => [issue.path.join('.'), issue.message]))); return; }
      setErrors({}); await onSubmit(result.data);
    }}>
      {Object.keys(errors).length > 0 && <p className="notice error" role="alert">Lengkapi field yang ditandai. Tidak ada proses baru.</p>}
      <fieldset disabled={busy}><legend className="sr-only">Brief preview</legend><div className="form-grid">
        {(Object.entries(labels) as [keyof typeof labels, string][]).map(([key, label]) => <label key={key} className={key === 'description' ? 'wide' : ''}>{label}
          {key === 'description' ? <textarea value={value[key]} maxLength={800} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={event => setValue({ ...value, [key]: event.target.value })}/> : <input value={value[key]} maxLength={{ client: 60, tagline: 120, audience: 180, location: 160, hours: 100 }[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={event => setValue({ ...value, [key]: event.target.value })}/>}
          {errors[key] && <span id={`error-${key}`} className="field-error">{errors[key]}</span>}
        </label>)}
      </div>
      <h3>Menu contoh</h3><p className="muted">Harga menu bukan biaya jasa pada invoice simulasi.</p>
      {value.menu.map((item, index) => <div className="menu-row" key={index}>
        <label>Nama menu {index+1}<input value={item.name} maxLength={60} aria-invalid={!!errors[`menu.${index}.name`]} onChange={event => setValue({ ...value, menu: value.menu.map((row, i) => i === index ? { ...row, name: event.target.value } : row) })}/></label>
        <label>Harga menu {index+1} (Rp)<input type="number" min="0" max="100000000" step="1" value={item.price} aria-invalid={!!errors[`menu.${index}.price`]} onChange={event => setValue({ ...value, menu: value.menu.map((row, i) => i === index ? { ...row, price: Number(event.target.value) } : row) })}/></label>
        <button type="button" aria-label={`Hapus menu ${index+1}`} disabled={value.menu.length === 1} onClick={() => setValue({ ...value, menu: value.menu.filter((_, i) => i !== index) })}>Hapus</button>
      </div>)}
      <button type="button" disabled={value.menu.length === 6} onClick={() => setValue({ ...value, menu: [...value.menu, { name: '', price: 0 }] })}>Tambah menu</button>
      <div className="form-footer"><button type="button" onClick={() => { setValue(structuredClone(kopiSenja)); setErrors({}); }}>Isi contoh Kopi Senja</button><button className="primary" type="submit" disabled={submitBlocked}>{busy ? 'Menyimpan…' : initial ? 'Simpan versi baru' : 'Proses uji lokal'}</button>{onNativeSubmit && !initial && <button type="button" disabled={submitBlocked || nativeSubmitBlocked} onClick={async () => {
        const result = briefSchema.safeParse(value);
        if (!result.success) { setErrors(Object.fromEntries(result.error.issues.map(issue => [issue.path.join('.'), issue.message]))); return; }
        setErrors({}); await onNativeSubmit(result.data);
      }}>{busy ? 'Mengirim…' : 'Jalankan WakerFlow V13'}</button>}</div>
      <p className="muted">Proses uji lokal satu halaman bersifat deterministik dan tidak memakai kredit. Tombol WakerFlow V13 menjalankan flow native berbayar satu kali dengan brief proyek empat halaman yang lengkap; tanpa approval otomatis, invoice nyata, kontak klien, pembayaran, atau publikasi. Jangan masukkan secret atau data pribadi.</p>
      </fieldset>
    </form>
  </section>;
}
