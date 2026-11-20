import { describe, expect, it } from 'vitest';
import { briefSchema, createPackage, invoiceSchema } from '../src/lib/domain';

export const brief = {
  client: 'Kopi Senja',
  tagline: 'Ruang jeda, secangkir cerita.',
  audience: 'Penikmat kopi dan pekerja kreatif',
  description: 'Kedai kopi sintetis untuk menguji preview internal satu halaman.',
  location: 'Kota Contoh, Indonesia',
  hours: 'Setiap hari, 08.00–21.00',
  menu: [{ name: 'Kopi susu senja', price: 28000 }, { name: 'Americano', price: 24000 }],
  synthetic: true,
};

describe('structured one-page delivery', () => {
  it.each(['', '   '])('rejects missing audience without inventing it (%j)', audience => {
    expect(briefSchema.safeParse({ ...brief, audience }).success).toBe(false);
  });
  it('rejects arbitrary template code and real-client scope', () => {
    expect(briefSchema.safeParse({ ...brief, html: '<script>alert(1)</script>' }).success).toBe(false);
    expect(briefSchema.safeParse({ ...brief, synthetic: false }).success).toBe(false);
  });
  it('requires menu, location and bounded nonnegative integer prices', () => {
    for (const change of [{ menu: [] }, { location: '' }, { menu: [{ name: 'Kopi', price: -1 }] }, { menu: [{ name: 'Kopi', price: 1.2 }] }]) {
      expect(briefSchema.safeParse({ ...brief, ...change }).success).toBe(false);
    }
  });
  it('produces linked versioned preview and synthetic invoice from valid brief', () => {
    const result = createPackage(brief, 'job-a', 'run-a', 1);
    expect(result.preview).toMatchObject({ jobId: 'job-a', runId: 'run-a', version: 1, template: 'kopi-one-page', content: { client: 'Kopi Senja' } });
    expect(result.invoice).toMatchObject({ jobId: 'job-a', runId: 'run-a', version: 1, previewVersion: 1, total: 5500000, currency: 'IDR', tax: 'not_calculated', status: 'terkirim (simulasi)', synthetic: true });
    expect(result.qa.every(check => check.passed)).toBe(true);
  });
  it('rejects tampered totals, duplicate items, other currencies and implied zero tax', () => {
    const invoice = createPackage(brief, 'job-a', 'run-a', 1).invoice;
    for (const change of [{ total: 1 }, { items: [invoice.items[0], invoice.items[0]] }, { currency: 'USD' }, { tax: 'zero' }]) {
      expect(invoiceSchema.safeParse({ ...invoice, ...change }).success).toBe(false);
    }
  });
  it('does not produce artifacts for incomplete input', () => {
    expect(() => createPackage({ ...brief, tagline: '' }, 'j', 'r', 1)).toThrow();
  });
});
