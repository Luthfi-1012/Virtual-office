import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { createPackage } from '../src/lib/domain';
import { kopiSenja } from '../src/lib/fixture';
import { renderPreview } from '../src/lib/preview';

it('renders structured content and native disclosure without agent-provided markup', () => {
  const preview = createPackage({ ...kopiSenja, tagline: '<img src="https://attacker.invalid/a" onerror="alert(1)">' }, 'j', 'r', 1).preview;
  const doc = new JSDOM(renderPreview(preview)).window.document;
  expect(doc.querySelector('h1')?.textContent).toBe(preview.content.tagline);
  expect(doc.querySelectorAll('script, img, form, iframe, link, object, embed')).toHaveLength(0);
  expect(doc.querySelector('details summary')?.textContent).toBe('Jam buka & lokasi');
  expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain("default-src 'none'");
  expect(doc.querySelectorAll('[onclick], [onerror], [style]')).toHaveLength(0);
});
it('rejects invalid output instead of displaying a successful placeholder', () => {
  expect(() => renderPreview({ template: 'arbitrary', content: {} })).toThrow();
});
