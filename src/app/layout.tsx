import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Virtual Office — Web Delivery Studio', description: 'Kantor virtual lokal untuk meninjau preview dan invoice simulasi.' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
