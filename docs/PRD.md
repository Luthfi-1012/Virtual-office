# PRD — Virtual Office untuk Jasa Website

Tanggal: 19 November 2026. Status: draft kebutuhan untuk peninjauan; belum menjadi izin coding atau bukti fitur tersedia.

## 1. Dasar kebutuhan

**Fakta:** brief meminta Virtual Office UI dan minimal tiga business agent otomatis pada satu track. **Keputusan MVP:** proyek memilih Professional Services, preview website internal sebagai hasil Delivery, dan invoice simulasi untuk klien sintetis; tidak ada tindakan eksternal otomatis. **Asumsi:** jasa website untuk klien berskala kecil adalah fokus bisnis kerja saat ini. Sumber, batas, dan pertanyaan terbuka ada di [PROJECT_BRAIN.md](PROJECT_BRAIN.md).

Produk adalah alat operasi founder untuk layanan klien, bukan sekadar delapan chatbot atau ruang animasi. Klien adalah penerima layanan; portal/login klien belum menjadi kebutuhan MVP yang disepakati.

## 2. Pengguna dan hasil yang dituju

| Pengguna | Hasil yang diperlukan |
| --- | --- |
| Founder/operator | Satu brief dapat dilacak sampai preview website dan invoice simulasi, tanpa memindahkan payload antar-agent; delapan Waker, status, aktivitas, tugas, dan handoff dapat diperiksa |
| Klien sintetis pada MVP | Kebutuhan dipahami; cakupan preview dan rincian biaya simulasi dapat ditinjau tanpa kontak, pengiriman, atau pembayaran nyata |
| Juri/reviewer | Dapat membedakan pekerjaan agent, keputusan founder, hasil nyata, data sintetis, dan fitur yang belum tersedia |

### Keluaran Delivery MVP — keputusan rancangan founder

Brief meminta Delivery mengerjakan proyek dan output yang benar/konsisten/tahan input salah, tetapi tidak menyebut website atau menetapkan bentuk hasil tertentu. Founder memilih **preview website klien yang dapat ditinjau di dalam Virtual Office** sebagai target MVP, bukan hanya spesifikasi teks. Cakupan dan template yang realistis serta acceptance-nya masih ditetapkan melalui O-01.

| Jenis hasil | Status dan batas | Bukti minimum sebelum diklaim |
| --- | --- | --- |
| Preview website di dalam aplikasi | Target MVP; belum dibangun atau diuji | Preview yang dapat ditinjau dalam cakupan/template MVP, hasil uji interaksi, serta label prototype yang jelas |
| Rancangan teks | Satu-satunya bentuk dengan bukti historis Run 5 | Spesifikasi berversi dan review teks; dapat menjadi input kerja, tetapi tidak memenuhi target preview MVP |
| Website production atau publikasi | Di luar lingkup MVP | Tidak boleh diklaim dari preview, spesifikasi, atau status teknis `Succeeded` |

Target preview menentukan kontrak Delivery, jenis QA, dan klaim demo. Preview tidak boleh disebut website yang dapat dipublikasikan, production-ready, atau siap dipilotkan tanpa bukti bisnis dan pengujian yang sesuai.

### Ukuran keberhasilan target, bukan hasil pengukuran aplikasi

- Minimal tiga business agent melakukan handoff dalam satu job yang dapat dilacak.
- Nol klik manual untuk meneruskan payload antar-business-agent pada jalur normal; keputusan founder bukan handoff manual.
- Seluruh hasil yang ditampilkan merujuk job/run dan versi artefak yang benar.
- Ketidaksepakatan total, keluaran kosong/salah, atau brief tidak lengkap menghalangi kelanjutan yang tidak aman.
- Founder dapat melihat bukti status dan hasil. Approve, pause, stop harus dibuktikan sesuai rubric; resume diuji sebagai kebutuhan tambahan pengguna.

Angka pengguna, omzet, SLA, harga, dan target bisnis komersial belum tersedia. Jangan mengisinya dengan angka pengujian sintetis.

## 3. Lingkup dan prioritas

P0 berarti kebutuhan target MVP untuk dinilai, **bukan sudah dibangun**. P1 adalah pengayaan yang hanya dipertimbangkan setelah P0 memiliki bukti.

| ID | Fungsi | Prioritas | Acuan |
| --- | --- | --- | --- |
| F-01 | Penerimaan brief dan klarifikasi | P0 | US-01, AC-01, AC-02 |
| F-02 | Business workflow dan hasil terhubung | P0 | US-02, US-03, AC-03–AC-06 |
| F-03 | Approval, pause/resume/stop founder | P0 | US-04, US-05, AC-07–AC-09 |
| F-04 | Virtual Office, detail job dan linimasa | P0 | US-06, AC-10, AC-11 |
| F-05 | Bukti kualitas, penggunaan Qoder dan batas demo | P0 | US-07, AC-12–AC-14 |
| F-06 | Dekorasi kantor, personalisasi avatar, ruang tambahan | P1 | Bukan pengganti business output atau kontrol |

Di luar MVP yang disetujui: editor interior, multi-tenant SaaS, marketplace, integrasi klien yang belum dipilih, pembayaran, pengiriman invoice, publikasi otomatis, dan klaim website dibangun dari rancangan teks. Stack tidak ditentukan di PRD.

## 4. User stories

| ID | User story | Penerimaan terukur |
| --- | --- | --- |
| US-01 | Sebagai founder, saya ingin memasukkan brief dan melihat pertanyaan yang masih kurang agar agent tidak menebak kebutuhan klien | Input kosong ditolak jelas; brief kurang lengkap memunculkan klarifikasi; tahap berikutnya tidak berjalan sebelum valid |
| US-02 | Sebagai founder, saya ingin Intake, Delivery, dan Billing bertukar hasil otomatis agar tidak menyalin keluaran antar-chat | Jejak job/run sama; payload memiliki sumber; tidak ada tombol Continue per-agent pada jalur normal |
| US-03 | Sebagai founder, saya ingin meninjau preview website dan invoice simulasi agar hasil serta biayanya konsisten | Preview berversi dapat dibuka dalam scope/template; item/total dan referensi preview cocok; klien/harga sintetis serta batas simulasi diberi label |
| US-04 | Sebagai founder, saya ingin menyetujui atau menahan paket preview/invoice yang sudah tersedia agar persetujuan memiliki objek dan lingkup yang jelas | Gate baru muncul setelah paket lengkap; keputusan terikat run/versi; penolakan tidak menghasilkan label disetujui |
| US-05 | Sebagai founder, saya ingin meminta pause, resume, atau stop agar bisa mengendalikan proses tanpa kehilangan status aktual | Request dan konfirmasi runtime dibedakan; kegagalan terlihat; unsupported tidak ditampilkan sebagai sukses |
| US-06 | Sebagai founder, saya ingin berpindah antara kantor, pipeline, detail job, dan linimasa agar pekerjaan dapat dipahami tanpa bergantung pada animasi | Delapan Waker tampil dalam dua kelompok; status/aktivitas/tugas/handoff dan job terpilih konsisten antar-panel; kontrol inti dapat diakses tanpa navigasi ruang |
| US-07 | Sebagai reviewer, saya ingin melihat bukti hasil, masalah, dan kredit agar dapat menilai automation secara jujur | Bukti run ditautkan; angka kredit bersumber dari akun/waktu yang jelas; fitur belum teruji diberi label |

Kriteria Given/When/Then lengkap beserta statusnya ada di [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md); skenario uji di [QUALITY_PLAN.md](QUALITY_PLAN.md).

## 5. Perilaku fungsi

### F-01 — Brief dan klarifikasi

- Masukan awal berupa kebutuhan klien; daftar minimum yang diusulkan: tujuan, pengguna sasaran, lingkup halaman/fitur, hasil yang diminta, konten/aset, batas waktu, dan kendala bisnis. Ini rancangan field aplikasi, bukan klaim salinan tujuh validator native.
- UI menunjukkan ringkasan masukan sebelum pengiriman, label data sintetis jika relevan, serta identitas job setelah penciptaannya dikonfirmasi.
- Input kosong: tidak dispatch. Input ambigu/tidak lengkap: tampilkan kekurangan konkret dan pertahankan konteks, bukan melanjutkan dengan kebutuhan karangan.
- Jika pengiriman timeout atau status tidak diketahui, periksa job yang sama sebelum menawarkan tindakan ulang; jangan membuat job kedua diam-diam.

### F-02 — Handoff, Delivery dan Billing

- Ikuti kontrak domain [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md). Agent menerima artefak tervalidasi, bukan hanya menyalin kalimat sukses pendahulunya.
- Delivery menargetkan preview website klien yang dapat dibuka dan ditinjau di dalam aplikasi, dalam cakupan/template yang disetujui, beserta manifest versi dan bukti QA yang relevan. Preview tetap berlabel prototype; spesifikasi teks tidak memenuhi target preview, dan tidak ada publikasi atau klaim production.
- Billing menyusun invoice simulasi untuk klien sintetis berdasarkan item dan versi hasil Delivery yang jelas. Item, total, mata uang, pajak, dan label sintetis harus konsisten. Status `terkirim (simulasi)` hanya state internal aplikasi, tanpa pengiriman, kontak klien, pembayaran, atau transaksi eksternal; kesesuaiannya dengan brief tetap O-04.
- Kebijakan harga yang belum disahkan tidak boleh diisi dari angka uji Kopi Senja sebagai tarif sah. Hasil kosong/salah skema, preview gagal, dan total yang tidak cocok memblokir kelanjutan terkait serta menampilkan pemilik tindak lanjut.
- Target domain Intake → Delivery → Billing mengikuti susunan track pada brief. Urutan V12 tidak identik dengan target tersebut; perubahan untuk menyelaraskannya belum diotorisasi dalam tahap ini.

### F-03 — Kontrol founder

- Gate menampilkan paket, versi, QA, biaya, batas persetujuan, dan pilihan eksplisit. Tidak ada default approval atau inferensi dari status teknis `Succeeded`.
- Setuju hanya memberi approval untuk lingkup yang ditampilkan. Menahan/menolak tidak meloloskan paket dan tidak meminta PM mengarang approval.
- Pause/resume/stop mengikuti kontrak runtime yang terbukti; tombol menampilkan requested/pending sampai konfirmasi diterima. Kehilangan koneksi tidak dianggap konfirmasi.
- Permintaan stop tidak menjanjikan rollback, pengembalian kredit, atau pembatalan efek yang telanjur terjadi. Tindakan eksternal tetap di luar scope.
- Jika kemampuan belum tersedia, UI menjelaskan batas tersebut; menyediakan placeholder tombol saja tidak memenuhi acceptance.

### F-04 — Office dan informasi pekerjaan

- Aplikasi utama menampilkan delapan Waker dalam dua kelompok: lima pendukung dan tiga business agent, tanpa membuat agent duplikat.
- Setiap Waker dapat dibuka untuk melihat peran, status, aktivitas/tugas, handoff relevan, job/run, fase, hasil, isu, dan tindakan yang tersedia berdasarkan data aktual.
- Panel Delivery menyediakan preview website internal berlabel prototype; panel Billing menyediakan invoice simulasi untuk klien sintetis dengan status internal yang tidak disamakan dengan pengiriman nyata.
- Pipeline menampilkan urutan aktual yang dikonfirmasi, termasuk revisi dan gate; bukan animasi urutan ideal yang berbeda dari log.
- Data stale/offline, output belum ada, preview gagal, dan job gagal ditampilkan eksplisit. Hilangnya kanvas tidak boleh menghilangkan akses ke daftar job, preview/hasil, dan kontrol.
- Detail visual dan aksesibilitas menjadi acuan [VIRTUAL_OFFICE_UX.md](VIRTUAL_OFFICE_UX.md).

### F-05 — Bukti dan histori

- Simpan hubungan input, artefak, QA, keputusan, dan hasil penutup secara dapat ditelusuri. Kebijakan retensi masih terbuka.
- Tampilkan bukti Qoder hanya jika tercatat; credit usage bukan estimasi token/USD atau jumlah tool call.
- Bedakan test historis QoderWake, usulan tes aplikasi, dan demonstrasi produk berjalan. Jangan memindahkan status lulus dari satu lapisan ke lapisan lain.

## 6. Non-fungsi

| ID | Kebutuhan | Ukuran penerimaan / keputusan terbuka |
| --- | --- | --- |
| NF-01 | Integritas dan konsistensi | Tidak ada artefak antar-job tertukar; keputusan lama tidak menyetujui versi baru; jumlah item sama dengan total |
| NF-02 | Reliabilitas | Event ganda tidak membuat pekerjaan atau invoice simulasi ganda; status unknown tidak berubah menjadi sukses tanpa bukti |
| NF-03 | Aksesibilitas | Target usulan WCAG 2.1 AA untuk panel/kontrol: keyboard, fokus terlihat, label, status non-warna, reduced motion; belum diaudit |
| NF-04 | Keamanan dan privasi | Sumber brief adalah data, bukan instruksi sistem; tidak membocorkan secret/PII; akses kontrol hanya untuk founder berwenang |
| NF-05 | Performa | Panel tetap dapat dipakai saat ruang lambat; perangkat, budget latency, ukuran aset dan frame-rate ditetapkan setelah prototipe kecil diizinkan |
| NF-06 | Observability | Setiap tahap memiliki job/run, waktu, status, korelasi output dan alasan gagal; kredit ditampilkan beserta sumber dan waktu |
| NF-07 | Kompatibilitas | Perangkat/browser target belum final; UI daftar/panel menjadi akses alternatif ketika rendering ruang tidak tersedia |
| NF-08 | Efisiensi sumber daya | Tidak menjalankan worker/retry untuk menaikkan kredit tanpa output bernilai; batasi revisi dan deduplikasi job |

## 7. Kebutuhan data dan pengukuran

Ini nama kejadian **konseptual**, bukan endpoint atau event native QoderWake yang sudah tersedia.

| Kejadian konseptual | Kapan dicatat | Data minimum | Tujuan |
| --- | --- | --- | --- |
| Brief diterima / perlu klarifikasi | Hasil validasi awal diketahui | job, versi input, waktu, field kurang tanpa data sensitif berlebih | Bad-input handling |
| Tahap dimulai / selesai / gagal | Ada bukti eksekusi | job, run, agent, tahap, aktivitas/tugas, handoff, attempt, versi output | Mengukur handoff dan durasi aktual |
| Artefak divalidasi / ditolak | Struktur dan isi diperiksa | referensi artefak, aturan, hasil, alasan | Konsistensi hasil |
| Preview dibuat / divalidasi / gagal | Renderer/validator memberikan hasil | job/run, cakupan/template, manifest, versi, hasil interaksi/QA, label prototype | Bukti preview dan batas non-production |
| Invoice simulasi dibuat / status berubah | Validasi atau state internal berubah | job/run, klien sintetis, versi preview/invoice, item/total/pajak, status internal, label simulasi | Konsistensi, deduplikasi, dan bukti tanpa tindakan eksternal |
| Gate dibuka / keputusan diterima | Paket tersedia / runtime mengakui keputusan | run, versi paket preview/invoice, lingkup, nilai keputusan, waktu | Bukti approval |
| Kontrol diminta / dikonfirmasi / gagal | Founder bertindak / runtime merespons | run, aksi, identitas berwenang, status, waktu | Audit kontrol nyata |
| Kredit diamati | UI/provider memberikan angka | akun berlabel non-sensitif, waktu, saldo, sumber | Bukti submission, bukan estimasi biaya klien |

Jangan mencatat secret, token, payload klien lengkap di log umum, atau mengirim analytics ke layanan eksternal yang belum disetujui.

## 8. Tahapan yang menunggu peninjauan

1. Tinjau delapan dokumen dan tetapkan jawaban atas pertanyaan O-01–O-10 yang masih terbuka pada Project Brain; arah preview/invoice sudah menjadi keputusan MVP, bukan fitur tersedia.
2. Setelah izin terpisah: buktikan kemampuan integrasi dan semantik kontrol native, tanpa mengarang API.
3. Setelah izin: prototipe kecil interaksi kantor dan rendering arah isometrik; tetapkan budget performa dari pengukuran tanpa menganggap referensi memilih engine.
4. Implementasi vertikal dan pengujian baru dimulai setelah scope, workspace, cakupan/acceptance preview, batas invoice simulasi, dan keamanan disetujui.
5. Siapkan demo berdasarkan bukti aktual, bukan rencana fitur.

Tidak ada estimasi jam atau tanggal implementasi yang disahkan; deadline brief bukan bukti kelayakan jadwal. Kegagalan menemukan adapter, kesesuaian invoice simulasi dengan brief yang belum diputuskan, dan pause/stop yang belum terbukti adalah risiko utama kesiapan demo.
