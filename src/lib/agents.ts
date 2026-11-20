export const agents = [
  { id: 'pm', short: 'PM', name: 'Project Manager / Orchestrator', group: 'development', role: 'Mengoordinasikan kebutuhan, bukti pekerjaan, dan ringkasan keputusan founder.', stage: null },
  { id: 'design', short: 'UX', name: 'UI/UX Designer', group: 'development', role: 'Merancang alur, tata halaman, dan interaksi dalam cakupan preview.', stage: null },
  { id: 'backend', short: 'BE', name: 'Backend Agent', group: 'development', role: 'Menyiapkan kontrak data dan kebutuhan backend sesuai cakupan layanan.', stage: null },
  { id: 'frontend', short: 'FE', name: 'Frontend Agent', group: 'development', role: 'Mengerjakan frontend preview sesuai template dan akses yang diizinkan.', stage: null },
  { id: 'qa', short: 'QA', name: 'QA Engineer', group: 'development', role: 'Memeriksa acceptance preview, integritas hasil, dan invoice simulasi.', stage: null },
  { id: 'intake', short: 'IN', name: 'Client Intake Agent', group: 'delivery', role: 'Menstrukturkan brief dan meminta klarifikasi sebelum handoff.', stage: 'intake' },
  { id: 'delivery', short: 'DE', name: 'Client Delivery Agent', group: 'delivery', role: 'Mengemas preview, manifest, dan bukti QA sebelum Billing.', stage: 'delivery' },
  { id: 'billing', short: 'BI', name: 'Billing Agent', group: 'delivery', role: 'Menyusun invoice simulasi yang terhubung dengan versi preview.', stage: 'billing' },
] as const;
export type Agent = typeof agents[number];
export const facilities = [
  { id: 'lobby', name: 'Lobi & resepsionis', description: 'Area sambut founder dan orientasi kantor.' },
  { id: 'meeting', name: 'Ruang rapat', description: 'Ruang rapat kecil untuk konteks visual. Tidak ada reservasi atau panggilan.' },
  { id: 'pantry', name: 'Pantry', description: 'Coffee corner bersama; fasilitas visual tanpa simulasi layanan.' },
  { id: 'lounge', name: 'Lounge konsol', description: 'Sudut jeda bersama. Konsol hanya elemen visual, bukan permainan.' },
  { id: 'prayer', name: 'Mushola & wudu', description: 'Ruang ibadah tenang dengan area wudu ringkas di sisinya.' },
  { id: 'toilet', name: 'Toilet', description: 'Fasilitas bersama pada sisi belakang kantor.' },
  { id: 'focus', name: 'Sudut fokus', description: 'Meja tenang terpisah dari ruang kerja kolaboratif.' },
] as const;
