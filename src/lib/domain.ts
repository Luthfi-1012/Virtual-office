import { z } from 'zod';

z.config({ jitless: true });

const text = (max: number) => z.string().trim().min(1, 'Wajib diisi.').max(max, `Maksimal ${max} karakter.`);
const amount = z.number().int().min(0).max(100_000_000);
export const briefSchema = z.strictObject({
  client: text(60), tagline: text(120), audience: text(180), description: text(800),
  location: text(160), hours: text(100), synthetic: z.literal(true),
  menu: z.array(z.strictObject({ name: text(60), price: amount })).min(1).max(6),
});
export type Brief = z.infer<typeof briefSchema>;
export const nativeProjectSchema = z.strictObject({
  objective: text(500), audience: text(300),
  pages: z.array(z.enum(['Beranda', 'Menu', 'Tentang', 'Kontak'])).length(4),
  features: z.array(text(500)).min(4).max(10),
  acceptance: z.array(text(500)).min(4).max(10),
  scope: text(1000), deadline: text(300),
  budget: z.strictObject({
    maximum: z.number().int().min(0).max(6000000), currency: z.literal('IDR'),
    rateCard: text(200), tax: z.literal('Tidak dihitung.'),
  }),
});
export type NativeProject = z.infer<typeof nativeProjectSchema>;
const identity = { jobId: text(80), runId: text(80), version: z.number().int().positive() };
export const previewSchema = z.strictObject({
  ...identity, template: z.literal('kopi-one-page'), content: briefSchema,
});
export const invoiceSchema = z.strictObject({
  ...identity, invoiceId: text(100), previewVersion: z.number().int().positive(),
  client: text(60), synthetic: z.literal(true), currency: z.literal('IDR'),
  tax: z.literal('not_calculated'), status: z.literal('terkirim (simulasi)'),
  items: z.array(z.strictObject({ id: text(30), label: text(100), quantity: z.number().int().min(1).max(100), price: amount })).min(1).max(10),
  total: amount,
}).superRefine((value, ctx) => {
  if (value.total !== value.items.reduce((sum, item) => sum + item.price * item.quantity, 0))
    ctx.addIssue({ code: 'custom', path: ['total'], message: 'Total tidak cocok dengan item.' });
  if (new Set(value.items.map(item => item.id)).size !== value.items.length)
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Item invoice duplikat.' });
  if (value.previewVersion !== value.version)
    ctx.addIssue({ code: 'custom', path: ['previewVersion'], message: 'Versi preview tidak cocok.' });
});
export type Preview = z.infer<typeof previewSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
const qaCheckSchema = z.strictObject({ name: text(120), passed: z.boolean() });
const qaSchema = z.array(qaCheckSchema).min(1).max(20);
export type QaCheck = z.infer<typeof qaCheckSchema>;
export type DeliveryPackage = { preview: Preview; invoice: Invoice; qa: QaCheck[] };

export function createPackage(input: unknown, jobId: string, runId: string, version: number): DeliveryPackage {
  const content = briefSchema.parse(input);
  const preview = previewSchema.parse({ jobId, runId, version, template: 'kopi-one-page', content });
  const invoice = invoiceSchema.parse({
    jobId, runId, version, invoiceId: `SIM-${jobId}`, previewVersion: version,
    client: content.client, synthetic: true, currency: 'IDR', tax: 'not_calculated', status: 'terkirim (simulasi)',
    items: [
      { id: 'design', label: 'Rancangan satu halaman (fixture)', quantity: 1, price: 1500000 },
      { id: 'preview', label: 'Pembuatan preview (fixture)', quantity: 1, price: 3500000 },
      { id: 'review', label: 'Pemeriksaan paket (fixture)', quantity: 1, price: 500000 },
    ], total: 5500000,
  });
  return { preview, invoice, qa: [
    { name: 'Field brief lengkap', passed: true },
    { name: 'Manifest sesuai template tetap', passed: true },
    { name: 'Total invoice cocok dengan item', passed: true },
    { name: 'Referensi job, run, dan versi cocok', passed: true },
  ] };
}

export function validatePackage(value: DeliveryPackage, jobId: string, runId: string, version: number) {
  const preview = previewSchema.parse(value.preview);
  const invoice = invoiceSchema.parse(value.invoice);
  const qa = qaSchema.parse(value.qa);
  if ([preview, invoice].some(item => item.jobId !== jobId || item.runId !== runId || item.version !== version)
    || invoice.client !== preview.content.client || invoice.invoiceId !== `SIM-${jobId}`
    || qa.some(check => !check.passed)) throw new Error('Paket tidak konsisten atau QA gagal.');
  return { preview, invoice, qa };
}

export const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
