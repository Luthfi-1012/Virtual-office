# Acceptance Criteria — Hackathon Virtual Office

Tanggal: 19 November 2026. Status: matriks peninjauan dan demonstrasi; bukan laporan semua kriteria lulus.

## 1. Sumber primer dan batas penilaian

Acuan primer: [arsip HTML brief](file:///D:/Downloads/Overview%20Pre-Hackathon%20%26%20Hackathon%20Onsite%20-%20Joint%20Hackathon.html), judul **Pre-Hackathon & Hackathon Onsite - Joint Hackathon Qwen Conference Indonesia 2026 x Lintasarta**. Teks lokal diperiksa pada 19 November 2026; belum dikonfirmasi terhadap pembaruan panitia. Daftar sumber lengkap ada di [PROJECT_BRAIN.md](PROJECT_BRAIN.md#10-daftar-sumber).

Bobot dan deskripsi berikut disalin dari bagian **“Porsi penilaian.”**. Teks pengantar brief: **“Total 100 poin. Dinilai dari video demo dan submission.”**

| Bobot persis | Nama rubric persis | Deskripsi persis dari brief |
| --- | --- | --- |
| **30%** | **Otomasi agent** | Minimal 3 agent saling oper kerjaan sendiri, tanpa klik manual. |
| **25%** | **Pemakaian kredit Qoder** | Dihitung dari jumlah kredit yang terpakai dari 3.000, ditunjukkan di video demo beserta hasil kerjanya. |
| **20%** | **Fungsionalitas & output** | Output tiap agent benar, konsisten, dan tahan input yang salah. |
| **15%** | **Implementasi bisnis nyata** | Pengguna jelas dan alurnya sesuai track, siap dipilotkan. |
| **10%** | **UI virtual office** | Founder bisa lihat status agent, menyetujui, pause, dan stop. |

Ketentuan tambahan persis pada bagian kredit:

> Skor = kredit terpakai ÷ 3.000 × 25
>
> Contoh: 2.400 kredit = 20 poin
>
> Syarat: kredit hanya dihitung kalau ada output-nya

Formula ini bukan ajakan membuang kredit. Jangan memperkirakan skor final dari jumlah tool call, token, biaya model, atau angka kredit lintas akun yang tidak terverifikasi. Bukti kredit harus disertai hasil kerja dan konteks akun/waktu yang sesuai aturan panitia.

## 2. Persyaratan brief di luar tabel bobot

| Persyaratan pada brief | Implikasi demonstrasi / batas |
| --- | --- |
| Individu; 1 seat Qoder + 3.000 credit | Tunjukkan kepemilikan kerja dan bukti penggunaan yang sesuai; status eligibility akun saat submission perlu diperiksa |
| Virtual Office UI + minimal 3 agent bisnis | Delapan Waker tidak otomatis membuktikan tiga business agent menjalankan layanan nyata |
| 100% Qoder: IDE + QoderWake | Perlu bukti penggunaan Qoder IDE dan QoderWake; pemakaian Desktop saja tidak otomatis memenuhi frasa IDE |
| Pilih 1 dari 3 track bisnis | Proyek memilih Professional Services; layanan paket konten lama bukan keputusan saat ini |
| Professional Services: Intake terima klien baru; Delivery kerjakan proyek; Billing kirim tagihan | Target urutan bisnis adalah Intake → Delivery → Billing; V12 berbeda. Preview website dan invoice simulasi adalah keputusan MVP proyek; status `terkirim (simulasi)` hanya internal dan kesesuaiannya dengan brief memerlukan keputusan founder/konfirmasi panitia pada O-04 |
| Video demo One Person Company + pemakaian kredit Qoder; maks. 5 menit; form via email; deadline 22 Nov | Rundown tidak melebihi 300 detik; URL form, jam/zona waktu deadline dan pembaruan aturan belum tercatat |
| Periode online 17–22 Nov 2026; form seat pada 17 Nov | Ini isi brief, bukan klaim registrasi sudah selesai atau instruksi melakukan registrasi sekarang |
| Top 50 lanjut onsite 26 Nov 2026; bawa prototipe, live twist, sprint upgrade, presentasi final | Konteks tahap lanjutan, bukan syarat fitur tambahan untuk tahap dokumen atau jaminan lolos |

Bentuk hasil Delivery tidak ditetapkan sebagai website pada brief: kata “website” dan “aplikasi” tidak ditemukan dalam teks yang diperiksa. Sebagai **keputusan rancangan MVP**, founder memilih preview website klien yang dapat ditinjau di dalam aplikasi, dengan cakupan/template dan acceptance yang masih terbuka pada O-01. Preview adalah prototype, bukan website production atau hasil publikasi. Run 5 hanya membuktikan rancangan/spesifikasi teks dan tidak membuktikan preview.

Billing juga menargetkan invoice simulasi untuk klien sintetis, termasuk status `terkirim (simulasi)` hanya di dalam aplikasi. Ini bukan pengiriman eksternal, pembayaran, atau transaksi nyata. Kesesuaian simulasi dengan “Billing kirim tagihan” pada brief masih memerlukan keputusan founder dan konfirmasi panitia pada O-04.

## 3. Cara memakai matriks

- **Teruji teks:** bukti spesifik dari eksekusi QoderWake; tidak diwariskan menjadi status lulus aplikasi.
- **Belum diuji runtime:** struktur/kebutuhan diketahui, cabang atau kontrol belum dieksekusi dan dibuktikan.
- **Menunggu aplikasi:** memerlukan produk/integrasi yang belum tersedia.
- **Gap/keputusan terbuka:** kontrak atau batas proyek belum selaras dengan klaim yang ingin dibuat.

ID AC-01–AC-14 di bawah adalah **kriteria dokumen produk ini**, bukan ID checks pada QA sintetis Run 5. Jangan mengklaim 13 checks Run 5 meluluskan tabel ini.

## 4. Kriteria Given / When / Then

| ID | Kaitan rubric / fungsi | Given | When | Then dan bukti yang harus terlihat | Status saat dokumen dibuat |
| --- | --- | --- | --- | --- | --- |
| AC-01 | Fungsionalitas; F-01 | Form brief tersedia | Founder mengirim kosong atau format tidak didukung | Kesalahan spesifik ditampilkan, input bisa diperbaiki, dan tidak ada dispatch; log menunjukkan nol downstream | Menunggu aplikasi; tes kosong/format belum terbukti |
| AC-02 | Fungsionalitas; F-01 | Brief kurang informasi wajib | Intake memeriksanya | Pertanyaan klarifikasi konkret muncul; tidak mengarang data; tahap berikutnya tidak berjalan | Teruji teks untuk brief tidak lengkap; resume setelah klarifikasi dan seluruh variasi belum diuji |
| AC-03 | Otomasi; F-02 | Brief valid dan kontrak domain disetujui | Job diproses | Client Intake → Client Delivery → Billing bertukar hasil otomatis dengan job/run yang terlacak, tanpa klik antar-agent | Gap: V12 membuktikan handoff teks tetapi Billing mendahului Client Delivery; target urutan belum terbukti |
| AC-04 | Fungsionalitas / bisnis; F-02 | Delivery menerima brief tervalidasi, hasil pendukung, serta cakupan/template preview yang telah diputuskan founder | Paket hasil dibuat | Preview website dapat dibuka dan ditinjau di dalam aplikasi; interaksi dalam scope diuji, manifest/versi dan acceptance terlacak, label prototype serta keterbatasan jelas; tidak ada publikasi atau klaim production | Target MVP telah dipilih tetapi belum dibangun/diuji; Run 5 hanya membuktikan rancangan teks |
| AC-05 | Fungsionalitas; F-02 | Artefak kosong/salah, preview gagal/invalid, atau QA gagal | Validasi/review dilakukan | Kelanjutan tidak diloloskan; isu dan pemilik revisi terlihat; maksimal satu siklus revisi, lalu berhenti bila tetap gagal; kegagalan preview tidak ditampilkan sebagai sukses | Belum diuji runtime cabang QA gagal, preview, dan variasi output invalid |
| AC-06 | Fungsionalitas / bisnis; F-02 | Hasil Delivery dan aturan harga yang sah/fixture sintetis tersedia | Billing menyusun invoice simulasi | Invoice ditujukan ke klien sintetis; item/total konsisten, mata uang/pajak eksplisit, referensi preview benar, duplikasi operasi tidak membuat invoice ganda; status `terkirim (simulasi)` hanya internal dan tidak memicu pengiriman/kontak/pembayaran | Total fixture teruji teks; invoice simulasi, status internal, tarif nyata, urutan domain, deduplikasi, dan kesesuaian dengan brief belum terbukti |
| AC-07 | UI / output; F-03 | Paket target berisi preview dan invoice simulasi lengkap | Founder menyetujui atau menahan gate | Gate hanya setelah paket tersedia; jika setuju, keputusan aktual `approved=true` diteruskan ke PM sesudah gate; jika Tahan/skip/null/nilai lain, tetap tidak approved, hasil `waiting_for_founder`, dan PM akhir tidak dijalankan; perubahan versi tidak memakai approval lama | Approve `internal_text_only` teruji teks pada Run 5; gate untuk paket preview/invoice, nonapproval runtime, dan invalidasi versi belum diuji |
| AC-08 | UI; F-03 | Job berjalan dan kemampuan pause/resume tersedia | Founder meminta pause lalu resume | UI membedakan requested dan confirmed, checkpoint/batas dijelaskan; tidak ada stage/invoice simulasi ulang saat resume; unsupported/gagal tidak ditampilkan sukses | Belum terverifikasi runtime; resume berasal dari kebutuhan pengguna, tidak disebut eksplisit dalam rubric |
| AC-09 | UI; F-03 | Job aktif dan dukungan stop tersedia | Founder meminta stop | Konfirmasi/penolakan nyata terlihat, tahap yang selesai tetap tercatat, dispatch setelah stop sesuai kontrak, tidak menjanjikan rollback | Belum terverifikasi runtime |
| AC-10 | UI; F-04 | Aplikasi Virtual Office tersedia | Founder memilih agent/job pada dua kelompok | Delapan Waker terlihat sebagai lima pendukung dan tiga business agent; status, aktivitas, tugas, dan handoff relevan berasal dari run aktual; preview dapat ditinjau, invoice simulasi berlabel jelas, panel dan pipeline/linimasa konsisten | Menunggu aplikasi/prototipe; dua kelompok dan jumlah delapan adalah rancangan MVP, sedangkan minimal tiga business agent adalah persyaratan brief |
| AC-11 | UI / kualitas; F-04 | Panel dan kantor tampil pada perangkat sasaran | Founder memakai keyboard, zoom, reduced motion atau rendering gagal | Informasi dan kontrol utama tetap dapat diakses; fokus/label jelas; stale/offline terlihat; daftar/panel tidak tergantung ruang | Menunggu aplikasi; target aksesibilitas berasal dari kebutuhan kualitas proyek |
| AC-12 | Implementasi bisnis nyata; F-05 | Segmen klien serta cakupan/template dan acceptance preview ditetapkan | Alur jasa website didemonstrasikan | Ada masalah/pengguna jelas, preview yang berguna dalam scope, invoice simulasi berlabel, batas lingkup/harga, serta penjelasan apakah simulasi memenuhi maksud brief; tidak mengklaim siap pilot tanpa bukti | Gap: segmen, cakupan/acceptance preview, harga sah, dan keputusan O-04 belum final |
| AC-13 | Kredit / tools; F-05 | Catatan Qoder dan output tersedia | Video menjelaskan proses dan pemakaian | Bukti Qoder IDE dan QoderWake sesuai yang benar-benar terjadi; kredit disandingkan output dengan akun/waktu yang tepat; tidak mengganti angka dengan estimasi token | Catatan QoderWake/kredit tersedia; bukti IDE untuk aplikasi dan eligibility submission belum terverifikasi |
| AC-14 | Submission / kejujuran; F-05 | Video dan form submission aktual siap | Paket submission ditinjau | Durasi ≤300 detik, input sintetis diberi label, batas tes disebut, data sensitif disamarkan, link video/form dan cutoff diperiksa | Belum ada video submission atau pengiriman; tugas sekarang hanya rencana |

## 5. Kriteria pendukung keamanan dan reliabilitas

Kriteria ini turunan kebutuhan proyek, bukan bobot baru pada rubric.

- Request/event/keputusan berulang tidak membuat run atau invoice simulasi ganda.
- Artefak, preview, invoice simulasi, dan approval dari satu job tidak dipakai untuk job lain.
- Brief atau output yang berisi instruksi di luar scope tidak memperluas izin agent.
- Secret, data pribadi dan rincian akun tidak bocor melalui log, panel, preview, screenshot atau video.
- Network error, timeout, hasil tidak diketahui dan restart direkonsiliasi sebelum retry.
- Stop atau penolakan approval tidak menghapus jejak kerja yang sudah terjadi.
- Tidak ada pembayaran, pengiriman invoice sungguhan, kontak klien, publikasi preview atau perubahan production otomatis; `terkirim (simulasi)` tetap state internal.

Skenario dan label bukti berada di [QUALITY_PLAN.md](QUALITY_PLAN.md), bukan dinyatakan lulus di sini.

## 6. Gerbang kelayakan klaim demo

| Klaim | Minimum bukti | Kondisi sekarang |
| --- | --- | --- |
| “Handoff QoderWake otomatis untuk teks sintetis” | Run spesifik, urutan worker, hasil dan gate | Didukung Run 5 dengan urutan native yang disebut jujur |
| “Business workflow target Intake → Delivery → Billing sudah terintegrasi” | Urutan target dan input aplikasi nyata terbukti end-to-end | Belum boleh diklaim |
| “Preview website dapat ditinjau di dalam aplikasi” | Preview aktual dalam scope/template, interaksi dan QA relevan, manifest/versi serta label prototype | Belum boleh diklaim; baru target MVP |
| “Invoice simulasi berstatus terkirim (simulasi)” | Invoice untuk klien sintetis, status internal terverifikasi, referensi benar, deduplikasi dan tidak ada tindakan eksternal | Belum boleh diklaim sebagai fitur tersedia; kesesuaian dengan brief tetap O-04 |
| “Billing sudah mengirim tagihan” | Bukti pengiriman aktual dan izin tindakan tersebut | Tidak boleh diklaim; pengiriman nyata dilarang dan simulasi bukan pengiriman |
| “Founder bisa pause dan stop” | Runtime request dan acknowledgment berikut akibat penjadwalan terbukti | Belum boleh diklaim |
| “Layanan website siap dipilotkan” | Hasil layanan nyata, QA relevan, pengguna/paket/harga dan batas operasional disepakati | Belum boleh diklaim |
| “Seluruh rubric terpenuhi” | Semua bukti relevan dan persyaratan panitia yang berlaku | Belum boleh diklaim; penilaian akhir milik juri |

Perubahan workflow, test tambahan atau tindakan eksternal untuk memenuhi kriteria ini membutuhkan izin baru. Matriks ini tidak memberi izin menjalankannya.
