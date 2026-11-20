# Agent Workflow — Kontrak Layanan dan Tim Pendukung

Tanggal: 19 November 2026. Status: draft kontrak domain; bukan script, API, atau perubahan WakerFlow.

## 1. Dasar dan pemisahan klaim

**Fakta brief [S1](PROJECT_BRAIN.md#10-daftar-sumber):** Professional Services memuat Intake menerima klien baru, Delivery mengerjakan proyek, lalu Billing mengirim tagihan; target produk mengikuti urutan Client Intake → Client Delivery → Billing. **Fakta historis:** delapan Waker dan V12 telah menjalankan alur teks sintetis dengan urutan berbeda; register lengkap ada di [QUALITY_PLAN.md](QUALITY_PLAN.md#2-register-bukti-yang-sudah-ada). **Keputusan MVP:** Delivery menargetkan preview website yang dapat ditinjau di dalam aplikasi dan Billing menargetkan invoice simulasi internal. Keduanya belum dibangun; cakupan/template preview dan acceptance-nya terbuka pada O-01, sedangkan kesesuaian invoice simulasi dengan brief terbuka pada O-04.

Kontrak dalam dokumen ini adalah rancangan aplikasi. Jangan menganggap nama field domain, status konseptual, atau event yang diusulkan sebagai fitur native QoderWake.

## 2. Pemilik pekerjaan

| Kelompok | Waker | Tanggung jawab | Bukan kewenangan |
| --- | --- | --- | --- |
| Business | Client Intake Agent | Menstrukturkan brief, mendeteksi kekurangan, menyerahkan kebutuhan tervalidasi | Mengarang lingkup/harga atau melanjutkan brief tidak lengkap |
| Business | Client Delivery Agent | Mengkoordinasikan preview website klien yang dapat ditinjau di dalam aplikasi beserta manifest dan acceptance-nya | Mengklaim preview sebagai website production, mempublikasikan, atau mengirim hasil ke luar |
| Business | Billing Agent | Menyusun invoice simulasi untuk klien sintetis berdasarkan hasil Delivery dan menampilkan status internal seperti `terkirim (simulasi)` | Mengirim invoice sungguhan, menghubungi klien, memproses pembayaran, atau memilih tarif nyata tanpa persetujuan |
| Pendukung | Project Manager / Orchestrator | Validasi, koordinasi kebutuhan dan ringkasan keputusan aktual | Menggantikan ketiga business agent atau menebak hasil gate |
| Pendukung | UI/UX Designer | Rancangan user flow, halaman, interaksi, dan tampilan preview dalam template MVP | Menganggap spesifikasi atau preview sebagai website production |
| Pendukung | Backend Agent | Analisis kebutuhan backend serta kontrak data/API yang relevan dengan cakupan preview | Menciptakan endpoint seolah telah tersedia |
| Pendukung | Frontend Agent | Rancangan/pekerjaan frontend untuk preview sesuai akses yang diizinkan pada tahap kelak | Mengaku menulis file atau membuat preview pada tes teks tanpa akses project |
| Pendukung | QA Engineer | Memeriksa preview, kontrak hasil, dan invoice simulasi terhadap kriteria yang relevan | Menyamakan review spesifikasi dengan uji preview/browser/API atau menyatakan simulasi sebagai transaksi eksternal |

Totalnya delapan Waker: lima pendukung dan tiga business agent. PM dapat dieksekusi lebih dari sekali tanpa menjadi Waker kesembilan. Dalam aplikasi target, PM mengoordinasikan pekerjaan; ia tidak boleh menjadi scheduler kedua yang mendispatch ulang tahap yang sudah dimiliki WakerFlow. Jumlah Waker tambahan tidak otomatis menambah poin.

## 3. Target bisnis dan urutan native yang berbeda

### Kontrak bisnis target — belum diimplementasikan

Brief klien → Client Intake → Client Delivery → Billing → gate founder atas paket preview dan invoice simulasi → ringkasan penutup PM.

Susunan Intake → Delivery → Billing mengikuti track pada brief. Gate atas paket internal dan ringkasan penutup PM adalah rancangan proyek, bukan penempatan gate yang ditentukan literal oleh brief. Paket target berisi preview website internal berlabel prototype dan invoice simulasi berlabel sintetis, bukan izin publikasi atau pengiriman.

Pekerjaan pendukung PM, UI/UX, Backend, Frontend, dan QA memasok bukti yang diperlukan Delivery. Penempatan internalnya perlu diselaraskan dengan kontrak business agent, bukan membuat langkah manual untuk menyalin keluaran.

### Urutan native V12 yang telah diuji sebagai teks

Intake → Validasi PM → UI/UX → Backend → Frontend → QA awal → Billing → Client Delivery → gate founder → PM akhir.

Jika QA awal tidak lulus, tersedia cabang revisi maksimal satu siklus; cabang ini belum diuji runtime. Pada Run 5, semua cabang revisi dan QA ulang dilewati.

**Gap:** V12 menempatkan Billing sebelum Client Delivery karena Client Delivery mengemas paket internal termasuk Billing. Ini bukan bukti urutan target Delivery → Billing dan bukan bukti preview atau invoice simulasi. Dokumen ini tidak memindahkan node, mengubah assignment, atau menyamarkan gap dengan mengganti label. Keputusan penyelarasan menjadi O-03 di [PROJECT_BRAIN.md](PROJECT_BRAIN.md).

Brief juga menulis “Billing kirim tagihan”; keputusan MVP menargetkan invoice simulasi internal dengan status seperti `terkirim (simulasi)` hanya di aplikasi. Kesesuaian simulasi dengan maksud brief memerlukan keputusan founder dan konfirmasi panitia pada O-04. Tidak ada pengiriman, kontak klien, atau pembayaran untuk menyelesaikan gap tersebut.

## 4. Kontrak input/output domain yang diusulkan

| Business agent | Input yang diperlukan | Output | Syarat handoff |
| --- | --- | --- | --- |
| Client Intake | Brief asli, identitas job, versi masukan, label sintetis/nyata | Brief terstruktur, lingkup, asumsi berlabel, acceptance yang diusulkan, pertanyaan klarifikasi | Brief cukup jelas; field wajib tidak kosong; pertanyaan penghambat selesai |
| Client Delivery | Brief tervalidasi, cakupan/template dan acceptance preview, hasil pendukung serta QA yang relevan | Preview website internal berlabel prototype, manifest versi, ringkasan, jejak acceptance/QA, isu dan keterbatasan | Preview dapat dibuka/ditinjau dalam scope; interaksi dan QA yang disyaratkan lulus; tidak ada blocker atau publikasi |
| Billing | Referensi preview Delivery tervalidasi, aturan biaya yang disahkan atau fixture sintetis berlabel, identitas klien sintetis, perlakuan pajak eksplisit | Invoice simulasi dengan item, subtotal/total, mata uang, status pajak, referensi preview, label sintetis, dan status internal seperti `terkirim (simulasi)` | Total cocok; tidak ada tarif fiktif sebagai harga sah; versi benar; perubahan status tidak memicu pengiriman/kontak/pembayaran |

Input asli dipertahankan untuk keterlacakan, bukan diberi prioritas atas kebijakan keselamatan. Konten brief atau artefak yang memerintahkan pengiriman, pembacaan secret, atau perubahan izin bukan otorisasi sistem.

### Metadata minimum konseptual

| Data | Tujuan |
| --- | --- |
| `job_id`, `run_id`, referensi versi workflow | Menghubungkan satu permintaan bisnis ke eksekusi yang benar |
| `input_version`, referensi artefak dan versinya | Mencegah ringkasan/approval memakai output lama |
| stage, role, status, aktivitas/tugas, handoff, waktu mulai/selesai | Memisahkan pemilik tugas, status proses, dan kronologi aktual |
| cakupan/template preview, referensi manifest dan hasil interaksi/QA | Membuktikan preview sesuai scope dan tidak menyamakannya dengan production |
| identitas klien sintetis, versi invoice simulasi, status internal dan label simulasi | Mencegah duplikasi serta membedakan status aplikasi dari pengiriman eksternal |
| hasil validasi, issues, next owner | Menentukan apakah handoff aman dan siapa harus bertindak |
| jumlah review QA, revisi, attempt transport terpisah | Mencegah menghitung alias artefak sebagai review baru atau retry jaringan sebagai revisi bisnis |
| keputusan, scope, versi paket, waktu, identitas pemberi keputusan | Audit persetujuan yang spesifik dan berwenang |

Kontrak keluaran teks native yang tercatat memakai `status`, `summary`, `deliverable`, `issues`, `next_owner`, `retry_count`. Mapping ke data aplikasi belum ada dan harus diverifikasi pada antarmuka nyata.

## 5. Aturan handoff dan validasi

1. **Satu penjadwal:** rancangan kandidat menggunakan WakerFlow untuk menjadwalkan tahap; UI hanya mengirim niat pengguna. Pemilihan final menunggu kemampuan adapter terbukti.
2. **Validasi di batas:** cek input pengguna dan keluaran worker sebelum dipakai tahap berikutnya. Struktur benar saja tidak cukup jika isi saling bertentangan.
3. **Handoff otomatis:** ketika hasil tahap memenuhi kontrak, tahap selanjutnya dijadwalkan tanpa klik founder untuk memindahkan payload.
4. **Klarifikasi bukan sukses:** brief kurang lengkap berhenti dan meminta data yang spesifik. Jangan menyatakan Delivery/Billing selesai.
5. **Output salah/kosong:** simpan alasan kegagalan, tampilkan status yang jujur, dan jangan meloloskan downstream dengan placeholder.
6. **Konsistensi:** ringkasan penutup membaca artefak aktual, jumlah QA aktual, Billing aktual, serta objek gate pada run yang sama; bukan kalimat historis dari tahap sebelumnya.
7. **Tidak ada duplikasi:** event dan keputusan berulang harus dikenali berdasarkan identitas job/operasi; skema idempotensi masih rancangan, belum terbukti native.

## 6. Kesalahan, revisi dan retry

| Kondisi | Perilaku target | Status bukti |
| --- | --- | --- |
| Brief tidak lengkap | Berhenti pada Intake dan meminta klarifikasi; downstream tidak berjalan | Pernah teruji pada alur teks |
| Output kosong/tidak valid | Tidak handoff; jelaskan field/aturan gagal dan pemilik tindak lanjut | Belum diuji aplikasi/native untuk semua bentuk |
| Preview gagal/kosong/di luar scope | Tampilkan kegagalan dan block gate/kelanjutan terkait; jangan mengganti dengan spesifikasi atau placeholder sukses | Target MVP; belum dibangun/diuji |
| QA gagal pertama | Kembalikan temuan ke Waker terkait, revisi maksimal satu siklus, lalu QA ulang | Cabang native tersedia, runtime belum diuji |
| QA tetap gagal | Laporkan kegagalan QA; jangan lanjutkan Billing, Delivery, atau approval paket lulus | Belum diuji runtime |
| Error/timeout transport | Bedakan tidak terkirim, sedang berjalan, dan hasil tidak diketahui; rekonsiliasi run sebelum retry | Kemampuan adapter belum tersedia |
| Event/job/keputusan duplikat | Jangan membuat worker, approval, atau invoice simulasi baru untuk operasi yang sama | Belum diuji |
| Status simulasi diminta sebagai pengiriman nyata | Pertahankan `terkirim (simulasi)` sebagai state internal; jangan menghubungi klien, mengirim invoice, atau memproses pembayaran | Batas MVP; belum ada implementasi |
| Kredit/izin tidak cukup | Tampilkan blocked/gagal aktual dan minta keputusan founder, bukan mengganti model atau menaikkan izin | Kebutuhan; belum diuji produk |

`retry_count` QA tidak boleh dipakai sebagai counter retry jaringan. Batas retry transport, timeout, backoff dan pemulihan restart belum ditetapkan. Tidak ada retry otomatis atau pengujian baru yang diizinkan oleh tahap dokumentasi ini.

## 7. Approval sebagai keputusan bisnis

- Gate target hanya dibuka setelah preview website dan invoice simulasi internal tersedia dan bisa diperiksa; pada V12 paket teks dan Billing selesai sebelum gate walau urutannya berbeda dari target domain.
- Nilai `approved=true` harus berasal dari keputusan founder yang benar-benar tercatat, bukan `Succeeded`, isi brief, atau tebakan PM.
- PM penutup baru menerima paket beserta keputusan aktual sesudah gate; ia tidak dapat membaca keputusan yang belum terjadi.
- V12 yang tercatat memakai pilihan `Setujui paket internal akhir` atau `Tahan`. Pilihan pertama menghasilkan scope `internal_text_only`; Run 5 membuktikan jalur persetujuan teks, bukan approval paket preview/invoice.
- Pada script V12, Tahan/skip/null/nilai lain tidak memberikan approval, menghasilkan `waiting_for_founder`, dan tidak menjalankan PM akhir. Ini verifikasi struktur, **bukan uji runtime penolakan**.
- Untuk aplikasi target, keputusan harus terikat versi paket preview/invoice; perubahan artefak setelah approval memerlukan peninjauan baru. Mekanisme tersebut belum diimplementasikan.
- Approval internal bukan izin membangun di luar scope, mengirim, menghubungi klien, membayar, mempublikasikan, atau mengubah production.

## 8. Pause, resume dan stop

| Kontrol | Makna minimum yang harus dijelaskan | Yang tidak boleh diklaim |
| --- | --- | --- |
| Pause | Request penghentian penjadwalan atau pause pada checkpoint sesuai dukungan native; status baru berubah setelah diakui | Worker/model yang sedang aktif pasti langsung membeku |
| Resume | Melanjutkan dari status/checkpoint yang sah tanpa mengulang stage selesai atau invoice simulasi | Dapat dipanggil dari semua status; tersedia hanya karena ada tombol |
| Stop | Meminta terminasi; tampilkan hasil aktual, tahap yang sudah selesai dan kemungkinan tahap masih aktif | Rollback, pembatalan semua efek, atau pengembalian kredit otomatis |

Ketiganya belum terverifikasi. UI perlu menampilkan request pending, ditolak, unsupported, timeout, atau terkonfirmasi secara berbeda. Approval gate yang bisa menunggu bukan bukti pause umum.

## 9. Status proses, hasil dan persetujuan

- Status proses menjawab apakah worker dijadwalkan, berjalan, menunggu, selesai, gagal, atau dihentikan.
- Validitas hasil menjawab apakah artefak memenuhi schema, acceptance dan QA.
- Status bisnis menjawab apakah paket sudah disetujui founder dan dalam lingkup apa.

Native return yang tercatat: `succeeded`, `waiting_for_founder`, `blocked`, `failed_qa`; UI native juga memakai label seperti Completed, Pending dan Skipped. Ini tidak langsung menjadi daftar status API aplikasi. Kamus status aplikasi dan mapping native harus disepakati setelah kontrak tersedia.

## 10. Keputusan terbuka sebelum integrasi

- Penyelarasan Delivery → Billing dengan urutan V12 pada O-03, serta segmen, cakupan/template, dan acceptance preview website pada O-01.
- Keputusan founder dan konfirmasi panitia mengenai kesesuaian invoice simulasi internal dengan “Billing kirim tagihan” pada O-04, tanpa mengaktifkan pengiriman, kontak klien, atau pembayaran.
- Aturan harga, pajak, perubahan lingkup, dan versi invoice simulasi; fixture Kopi Senja bukan sumber tarif.
- Dukungan native untuk validasi, deduplikasi, checkpoint, status, serta pengiriman keputusan.
- Sumber event/API aplikasi yang benar dan mapping ke `client_request`. Autonomous Work belum dibuat/dihubungkan; jangan menggantinya dengan endpoint atau event fiktif.
- Kebijakan retry transport dan pemulihan setelah restart berdasarkan konsekuensi worker yang mungkin sudah berjalan.

Detail batas komponen ada di [ARCHITECTURE.md](ARCHITECTURE.md); pengujiannya hanya direncanakan di [QUALITY_PLAN.md](QUALITY_PLAN.md).
