import type { Brief, NativeProject } from './domain';

export const kopiSenja: Brief = {
  client: 'Kopi Senja', tagline: 'Ruang jeda, secangkir cerita.',
  audience: 'Penikmat kopi dan pekerja kreatif yang mencari tempat beristirahat.',
  description: 'Ada cerita di setiap cangkir. Kopi Senja mempertemukan biji kopi pilihan, obrolan hangat, dan waktu untuk diri sendiri.',
  location: 'Jalan Contoh No. 12, Kota Fiktif', hours: 'Setiap hari, 08.00–21.00', synthetic: true,
  menu: [
    { name: 'Kopi susu senja', price: 28000 },
    { name: 'Americano', price: 24000 },
    { name: 'Cokelat hangat', price: 30000 },
  ],
};

export const kopiSenjaNativeRequest: { brief: Brief; project: NativeProject } = {
  brief: kopiSenja,
  project: {
    objective: 'Membantu calon pengunjung memahami menu, suasana, jam buka, dan lokasi melalui website yang nyaman digunakan terutama dari ponsel.',
    audience: 'Warga sekitar, pekerja, dan pengunjung yang mencari tempat minum kopi.',
    pages: ['Beranda', 'Menu', 'Tentang', 'Kontak'],
    features: [
      'Navigasi yang jelas antarhalaman Beranda, Menu, Tentang, dan Kontak.',
      'Daftar menu dengan harga contoh; setiap harga diberi label data demo.',
      'Jam buka contoh dan lokasi contoh yang diberi label contoh.',
      'Tombol kontak hanya elemen preview internal; jangan menghubungi siapa pun.',
    ],
    acceptance: [
      'Semua halaman dapat ditinjau sebagai preview internal.',
      'Navigasi antarhalaman jelas dan tampilan mudah digunakan di layar ponsel.',
      'Informasi menu, harga, jam buka, dan lokasi diberi label contoh atau data demo.',
      'Input kosong atau tidak valid ditangani dengan pesan yang jelas.',
      'Tidak ada klaim bahwa kode production atau website production sudah dibuat.',
    ],
    scope: 'Rancangan dan preview internal sintetis saja. Tidak ada publikasi, API production, pengiriman invoice, pembayaran, atau kontak klien.',
    deadline: '7 hari kerja, tidak termasuk waktu menunggu approval founder dan satu kemungkinan siklus revisi.',
    budget: { maximum: 6000000, currency: 'IDR', rateCard: 'Asumsi demo, bukan harga yang disepakati klien.', tax: 'Tidak dihitung.' },
  },
};
