# Virtual Office UX

Tanggal: 19 November 2026. Status: arah desain untuk ditinjau; belum ada prototipe atau uji UI pada tahap ini.

## 1. Dasar desain

**Keputusan pengguna:** dua area kantor terhubung, dengan informasi dan kontrol terpisah dari ruang visual. **Asumsi:** pembagian ini membantu founder memahami perbedaan layanan bisnis dan pekerjaan pendukung. **Fakta brief:** UI virtual office dinilai dari kemampuan founder melihat status agent, menyetujui, pause dan stop; resume merupakan kebutuhan tambahan pengguna. Bobot primer ada di [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).

Kantor harus menunjukkan pekerjaan bisnis yang dapat diperiksa, bukan sekadar gerakan avatar. Rancangan 2.5D atau 3D tetap terbuka sampai prototipe kecil diizinkan dan diuji.

## 2. Referensi visual dan hak penggunaan

| Referensi yang disebut founder | Ringkasan arah visual untuk adaptasi | Sumber yang tersedia | Yang belum terverifikasi |
| --- | --- | --- | --- |
| Camaleodigital | Interior 3D isometrik dengan potongan bangunan terbuka sehingga beberapa ruang terlihat sekaligus; material hangat dan interior realistis. Adaptasikan menjadi kantor virtual, bukan menyalin layout apartemen | [Video lokal](file:///D:/Downloads/camaleaodigital_pindown.io_1794901582.mp4); ringkasan visual dan screenshot yang dirujuk founder | Nama kreator/identitas sumber, ejaan yang benar, URL asli, judul persis, dan lisensi aset |
| George Railean | Denah 3D isometrik dengan panel kontrol gelap, kategori di bagian atas, mini floor plan, serta pola navigasi seperti Gallery, Room View, dan Map. Adaptasikan pola navigasi/kontrol ke Virtual Office | [Video lokal](file:///D:/Downloads/george_railean_pindown.io_1794901265.mp4); ringkasan visual dan screenshot yang dirujuk founder | Nama kreator/identitas sumber, URL asli, judul persis, dan lisensi aset |

Ringkasan di atas berasal dari arahan founder. Screenshot yang ditunjukkan founder menjadi bukti arah visual yang terlihat, bukan verifikasi independen atas identitas kreator atau hak penggunaan. Video tidak diputar ulang, disalin, diunggah, atau diekstrak menjadi aset pada tahap ini. Sesi UI [S6](PROJECT_BRAIN.md#10-daftar-sumber) tetap menjadi sumber usulan interaksi dengan pembacaan yang tidak exhaustive.

Referensi ini bukan aturan hackathon. Brief tidak mewajibkan nama kreator tersebut, dua area, sidebar, mini floor plan, label navigasi tertentu, atau rendering 2.5D/3D; semuanya adalah rancangan produk MVP.

Boleh mengadaptasi prinsip potongan ruang, hierarki informasi, material hangat, panel kontrol, dan pola navigasi. Jangan menyalin layout apartemen atau denah secara identik, model, tekstur, audio, maupun aset lain. Aset produk harus orisinal atau memiliki lisensi yang sesuai; asal, pencipta, lisensi, dan kewajiban atribusi harus dicatat sebelum digunakan.

## 3. Tata ruang dua area

### Area A — Tim pengembang/orchestrator

Lima posisi: Project Manager / Orchestrator, UI/UX Designer, Backend Agent, Frontend Agent, QA Engineer. Area ini menjelaskan pekerjaan pendukung yang menyusun atau memeriksa preview website. Satu PM mewakili validasi dan ringkasan akhir; bukan dua avatar PM karena ada dua eksekusi.

### Area B — Business workflow

Tiga posisi: Client Intake, Client Delivery, Billing. Ini jalur bisnis klien Intake → Delivery → Billing. Founder dapat melihat brief yang diterima, status/aktivitas/tugas tiap Waker, handoff relevan, preview website yang dapat ditinjau di dalam aplikasi, dan invoice simulasi tanpa membuka percakapan setiap Waker.

Client Delivery membuka preview dalam cakupan/template MVP dengan label prototype, bukan website production. Billing menampilkan invoice simulasi untuk klien sintetis; status `terkirim (simulasi)` harus disertai penjelasan bahwa itu hanya state internal, tanpa pengiriman, pembayaran, atau transaksi eksternal.

### Hubungan antarruang

Area A memasok hasil pendukung dan QA ke layanan di Area B. Delapan posisi tetap mewakili delapan Waker yang sama—lima pendukung dan tiga business agent—tanpa avatar duplikat. Satu hubungan visual cukup menunjukkan ketergantungan; tidak perlu koridor rumit, elevator, editor furnitur, simulasi fisik, atau avatar yang harus berjalan untuk memicu pekerjaan.

Sketsa informasi, bukan keputusan rendering:

- Bagian atas: nama workspace, job terpilih, status koneksi, dan label sintetis bila berlaku.
- Bagian utama: Area A dan Area B yang dapat dipilih; relasi peran dapat dibaca tanpa animasi.
- Panel HTML: detail agent/job, hasil, isu, dan kontrol founder.
- Bagian bawah/samping: pipeline aktual serta linimasa bukti.
- Tampilan ringkas: daftar agent/job sebagai pengganti navigasi ruang pada layar sempit atau rendering tidak tersedia.

Usulan komposisi dari sesi referensi UI [S6](PROJECT_BRAIN.md#10-daftar-sumber), **belum disahkan sebagai keputusan founder atau kewajiban brief**:

- Daftar job di kiri, office view besar di tengah, inspector di kanan, serta pipeline/linimasa di bawah. Kantor menjadi pusat layar, bukan gambar kecil di antara KPI cards.
- Inspector dapat dibuka/tutup tanpa menghapus job terpilih atau konteks ruang; overview memakai kepadatan lebih rendah daripada panel detail.
- Lapisan Agents, Handoff, dan Approval dapat diganti pada ruang yang sama. Lapisan membaca state aktual; perpindahan layer atau animasi bukan bukti eksekusi.
- Jika navigasi kamera dipilih, sediakan orientasi awal/reset yang mudah dikenali. Pola Gallery/Room View/Map dan mini floor plan dari referensi George Railean dapat dipetakan ke galeri job, tampilan ruang, dan denah kantor, tetapi belum disahkan sebagai fitur final dan tidak memilih engine 3D.

Urutan target domain dan urutan native V12 harus diberi label berbeda. Jangan menggambar animasi Delivery → Billing sebagai rekaman V12 yang sebenarnya menjalankan Billing → Client Delivery. Rujuk [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md#3-target-bisnis-dan-urutan-native-yang-berbeda).

## 4. Hierarki informasi

| Lapisan | Isi utama | Perilaku |
| --- | --- | --- |
| Office overview | Delapan Waker dalam dua kelompok, status, aktivitas/tugas aktif, handoff relevan, jumlah isu | Memilih agent/job membuka detail tanpa mengubah eksekusi |
| Pipeline job | Tahap, ketergantungan, QA/revisi, gate | Menampilkan tahap aktual; selesai, skipped dan gagal dibedakan |
| Detail job | Brief, job/run, fase, waktu, artefak, validasi, biaya, approval | Referensi hasil tetap dapat dibuka meski job berhenti |
| Preview Delivery | Preview website dalam cakupan/template, manifest versi, acceptance dan QA | Dapat ditinjau di dalam aplikasi dengan label prototype; tidak menyediakan aksi publikasi |
| Invoice simulasi | Klien sintetis, item/total, mata uang, pajak, referensi preview, status internal | `terkirim (simulasi)` dijelaskan sebagai simulasi internal, bukan pengiriman/pembayaran |
| Detail agent | Peran bisnis/pendukung, assignment, aktivitas/tugas, job aktif dan tahap | Tidak menyamakan agent idle dengan flow selesai |
| Linimasa | Tahap mulai/selesai, handoff, error, gate, keputusan, kontrol | Terkorelasi pada satu run; event duplikat tidak dibuat tampak sebagai pekerjaan baru |
| Kontrol founder | Approve/tahan, pause/resume, stop sesuai kemampuan | HTML yang bisa difokuskan; tindakan penting tidak hanya berada dalam kanvas |

State terpilih harus konsisten: mengganti job tidak boleh menyisakan preview, invoice simulasi, atau approval dari job sebelumnya.

## 5. Status agent dan job

Berikut kamus tampilan **yang diusulkan**, bukan daftar status native/API yang sudah tersedia.

| Status tampilan | Bukti yang diperlukan | Tampilan/pesan |
| --- | --- | --- |
| Belum mulai / mengantre | Job/tahap ada tetapi belum aktif | Label teks netral, tanpa animasi kerja |
| Bekerja | Ada konfirmasi tahap aktif | Nama tugas dan waktu mulai; jangan memberi persentase fiktif |
| Perlu klarifikasi | Validasi menemukan kekurangan | Daftar pertanyaan, pemilik tindakan, downstream belum mulai |
| Menunggu founder | Gate aktual atau permintaan tindakan yang terkonfirmasi | Paket dan tindakan yang diperlukan; bukan approval otomatis |
| Selesai | Hasil tahap tercatat | Tautan artefak dan hasil validasi; label ini bukan persetujuan bisnis |
| Terkirim (simulasi) | Invoice simulasi valid dan state internal aplikasi berubah | Label sintetis dan penjelasan “hanya di dalam aplikasi”; bukan pengiriman, pembayaran, atau transaksi eksternal |
| Dilewati | Cabang tidak dieksekusi | Alasan cabang, tidak dihitung sebagai review/work baru |
| Gagal / terblokir | Alasan runtime/validasi tersedia | Masalah, dampak downstream, langkah founder tanpa retry diam-diam |
| Kontrol diminta | Request terkirim, belum dikonfirmasi | Aksi pending; jangan tampilkan Paused/Stopped lebih awal |
| Dijeda / dihentikan | Konfirmasi native yang cocok dengan run | Tahap yang sudah selesai, pekerjaan yang masih belum pasti |
| Tidak terhubung / status belum diketahui | Koneksi atau freshness tidak cukup | Waktu data terakhir, bukan label sukses atau agent idle |

Status memakai teks dan ikon/bentuk, tidak hanya warna. Pisahkan badge validasi hasil serta approval dari status eksekusi.

## 6. Interaksi utama

### Memulai dan meninjau pekerjaan

1. Founder memasukkan brief pada panel, melihat label sintetis dan batas proses.
2. Setelah request/job terkonfirmasi, panel menampilkan identitas dan pipeline.
3. Handoff berlangsung otomatis; founder boleh memeriksa hasil tanpa tombol Continue antar-agent.
4. Jika brief kurang, panel menjelaskan apa yang dibutuhkan dan tidak menganimasikan downstream sedang bekerja.

### Meninjau paket dan approval

1. Gate tampil hanya setelah preview website dan invoice simulasi siap ditinjau.
2. Panel memuat cakupan/template preview, manifest dan versi paket, bukti QA/interaksi, isu, rincian total, status pajak, serta label sintetis/simulasi.
3. Pilihan Setujui/Tahan memerlukan aksi eksplisit; approval terkait paket internal, bukan izin publikasi, pengiriman, pembayaran, atau tindakan eksternal lain.
4. UI menunggu acknowledgment; klik ganda tidak boleh menghasilkan keputusan/dispatch ganda.
5. Ringkasan akhir menampilkan keputusan aktual. Paket yang berubah tidak mewarisi approval lama.

### Pause/resume/stop

Tampilkan kontrol sesuai dukungan yang terbukti dan status job. Jelaskan jika pause hanya berlaku pada checkpoint, atau stop tidak membatalkan hasil yang telah selesai. Saat belum terhubung atau tidak didukung, tampilkan alasan dan jangan mensimulasikan sukses. Kontrak lengkap ada di [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md#8-pause-resume-dan-stop).

## 7. State yang wajib dirancang

| State | Kebutuhan desain |
| --- | --- |
| Belum ada job | Ajakan memasukkan brief; kantor tidak berpura-pura memiliki pekerjaan aktif |
| Memuat data | Indikator loading pada informasi; jangan mengubah status domain |
| Artefak belum tersedia | Sebutkan tahap penghasil dan statusnya, bukan panel kosong ambigu |
| Output kosong/salah | Tampilkan kesalahan validasi dan block kelanjutan terkait |
| Data panjang | Ringkasan yang bisa diperluas, teks dapat disalin dan dibaca tanpa kanvas |
| Banyak isu / QA gagal | Isu terurut menurut dampak, pemilik revisi dan batas siklus |
| Permission ditolak | Tindakan tidak dilakukan; pesan yang tidak membocorkan detail sensitif |
| Offline/stale | Waktu terakhir terkonfirmasi, kontrol berisiko tidak dianggap berhasil |
| Duplikat atau event terlambat | Linimasa tetap konsisten, output lama tidak menimpa hasil yang lebih baru |
| Rendering ruang gagal | Daftar/panel masih dapat digunakan; gap visual dicatat untuk rubric UI |

## 8. Aksesibilitas dan responsivitas

Target desain usulan: WCAG 2.1 AA untuk panel dan kontrol, bukan klaim kepatuhan.

- Keyboard dapat mencapai pilihan job, agent, artefak, gate dan kontrol; urutan fokus masuk akal.
- Fokus terlihat dan kembali ke pemicu setelah dialog ditutup; tidak ada keyboard trap.
- Elemen punya nama/label dan status perubahan penting diumumkan secara terbatas, tidak setiap frame animasi.
- Status tidak bergantung pada warna, ukuran avatar, kedipan atau posisi ruang.
- Teks dan kontrol memenuhi kontras yang sesuai; zoom dan konten panjang tidak menyembunyikan tindakan inti.
- Hormati reduced motion; animasi tidak wajib untuk memahami handoff.
- Tampilan sempit memakai daftar/panel dan navigasi sederhana, bukan memaksa miniatur kantor yang tidak terbaca.
- Target ukuran sentuh dan budget performa diputuskan setelah perangkat sasaran dikonfirmasi; belum ada angka pengukuran.

## 9. Pilihan rendering yang belum diputuskan

| Opsi | Potensi manfaat | Biaya/risiko yang perlu diuji |
| --- | --- | --- |
| 2.5D/isometrik | Lebih sederhana untuk hierarki ruang dan state, potensi beban aset lebih ringan | Interaksi kamera/ruang lebih terbatas |
| 3D interaktif | Rasa ruang dan pencahayaan lebih kuat | Beban perangkat/aset, navigasi, aksesibilitas, fokus beralih dari hasil bisnis |

Uji kecil kelak harus membandingkan kemampuan menemukan job bermasalah, membaca hasil, mencapai gate, dan memakai panel pada perangkat sasaran. Pilih yang cukup untuk bukti bisnis; fidelity visual bukan alasan memperluas scope. Tahap ini tidak membuat prototipe atau memilih engine.

## 10. Pertanyaan terbuka

- Apa segmen, cakupan/template, dan acceptance preview website pada O-01, serta bagaimana founder menilai hasilnya tanpa menganggapnya production?
- Apakah invoice simulasi dan label `terkirim (simulasi)` cukup jelas sebagai state internal, dan apakah pendekatan ini diterima pada O-04?
- Apakah dua kelompok delapan Waker lebih mudah dipahami daripada tampilan daftar tunggal untuk tugas founder?
- Apakah komposisi daftar job–office besar–inspector–linimasa dan lapisan Agents/Handoff/Approval dari S6 akan disahkan setelah peninjauan?
- Apakah pola Gallery/Room View/Map dan mini floor plan membantu navigasi tanpa menambah kompleksitas?
- Rendering, perangkat sasaran, budget performa, dan lisensi aset apa yang layak?
- Bagaimana menampilkan keterbatasan kontrol native tanpa memberi kesan pause/stop sudah lulus?
- Apa identitas kreator, URL/judul persis referensi, dan ejaan sumber tambahan yang benar?

Acceptance visual dan kontrol ada di [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md); status tes ada di [QUALITY_PLAN.md](QUALITY_PLAN.md).
