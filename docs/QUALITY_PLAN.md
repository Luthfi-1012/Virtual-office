# Quality Plan — Bukti, Skenario dan Batas Klaim

Tanggal: 19 November 2026. Status: rencana pengujian dan register bukti historis; **tidak ada tes baru pada tahap dokumentasi ini**.

## 1. Klasifikasi status

- **Sudah diuji — teks QoderWake:** hasil aktual pada native workflow; scope hanya teks dan jalur yang dieksekusi.
- **Belum diuji runtime:** kebutuhan/struktur tercatat, tetapi perilaku belum dieksekusi dan dibuktikan.
- **Setelah aplikasi tersedia:** memerlukan implementasi/integrasi/prototipe yang belum ada; belum diuji.
- **Belum diverifikasi:** sumber, antarmuka, detail atau keputusan yang diperlukan belum tersedia.

Status teknis, validitas hasil, dan approval bisnis diperiksa terpisah. Checks QA spesifikasi bukan browser/API/integration tests. Register ini bersumber dari catatan percakapan [S3 di Project Brain](PROJECT_BRAIN.md#10-daftar-sumber), bukan inspeksi ulang QoderWake pada tahap ini.

## 2. Register bukti yang sudah ada

| ID | Bukti | Hasil aktual | Batas |
| --- | --- | --- | --- |
| E-01 | WakerFlow `0a0dde04-5cc7-4fd8-ba79-1d850ce3494e`, Version 12; Run 5 `90c95633-4e68-4a28-a864-f488a5b9be6d` | `Succeeded`; 9 eksekusi worker dari 8 Waker berbeda; handoff otomatis kecuali satu keputusan founder | Satu jalur normal dengan data sintetis, bukan validasi seluruh cabang atau aplikasi |
| E-02 | Urutan Run 5 | Intake → Validasi PM → UI/UX → Backend → Frontend → QA awal → Billing → Client Delivery → gate founder → PM akhir | Urutan ini berbeda dari kontrak domain target Intake → Delivery → Billing |
| E-03 | Gate dan input PM akhir Run 5 | Gate muncul setelah Billing/Client Delivery selesai dan PM masih pending; founder memilih `Setujui paket internal akhir`; input PM berisi `value` tersebut, `skipped=false`, `approved=true`, `scope=internal_text_only` | Approval paket internal saja; tidak membuktikan API approval aplikasi, penolakan, atau version invalidation |
| E-04 | Output PM/QA/Billing Run 5 | PM menyatakan “Approval founder tercatat; paket internal disetujui.”; `qa_review_count=1`, `qa_recheck_executed=false`, `retry_count=0`; 13 checks pass; tanpa revisi; total Rp5.500.000; pajak tidak dihitung | Review spesifikasi teks, bukan test runtime website. Angka Rp5.500.000 adalah fiktif, bukan rate card sah |
| E-05 | Observasi kredit sebelum perubahan/run dan sesudah Run 5 | Sebelum: 39 terpakai / 2.961 tersisa dari 3.000. Sesudah: 53 terpakai / 2.947 tersisa. Selisih interval: 14 kredit | Bukan biaya invoice, bukan estimasi token, bukan atribusi per-node atau klaim konsumsi run eksklusif; jangan gabungkan akun lain tanpa bukti |
| E-06 | Tes brief tidak lengkap yang tercatat sebelumnya | Berhenti setelah Intake dan meminta klarifikasi | ID run/input rinci tidak tercatat dalam bahan ringkas yang digunakan dokumen ini; jangan mengarang. Tidak membuktikan seluruh variasi bad input atau kelanjutan setelah koreksi |
| E-07 | Inspeksi struktur V12 sebelum Run 5 | Gate sebelum PM; payload memakai hasil gate aktual; nonapproval mengembalikan `waiting_for_founder` tanpa PM akhir; cabang QA maksimal satu revisi dipertahankan | Verifikasi struktur bukan pengujian runtime cabang penolakan/QA gagal |

13 checks QA pada E-04 terdiri dari sembilan acceptance checks pada fixture run dan empat kategori review: flow completeness, empty input, invalid input, dan UI/API consistency. Semuanya tetap **review teks**. Mereka bukan pelaksanaan tes input kosong di aplikasi atau kelulusan AC-01–AC-14 pada [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).

Cabang revisi UI/UX, Backend, Frontend, QA ulang dan pelaporan gagal-QA pada Run 5 tercatat `Skipped`; skipped bukan lulus uji cabang.

Target MVP yang baru diselaraskan—preview website di dalam aplikasi, invoice simulasi dengan status `terkirim (simulasi)`, serta tampilan delapan Waker dalam dua kelompok—belum dibangun atau diuji. Target tersebut tidak mengubah hasil historis E-01–E-07 dan tidak mewarisi status “Sudah diuji” dari orkestrasi teks.

## 3. Batas pengujian mendatang

Rencana di bawah hanya boleh dieksekusi setelah izin terpisah. Gunakan data sintetis berlabel; catat versi flow/aplikasi, run ID, input, urutan, output, approval, dan kredit sebelum/sesudah setiap run berbiaya. Jangan melakukan retry otomatis untuk menyembunyikan kegagalan atau membelanjakan kredit tanpa output.

Tidak ada pengiriman invoice, pembayaran, publikasi, akses production, konektor baru atau perubahan permission sebagai bagian dari pengujian ini. Pengujian aplikasi menunggu aplikasi tersedia dan scope/workspace ditentukan.

## 4. Matriks skenario fungsional dan orkestrasi

| ID | Skenario / langkah yang direncanakan | Oracle / bukti yang diharapkan | Status saat ini |
| --- | --- | --- | --- |
| Q-01 | Jalur normal native dengan brief sintetis lengkap | Handoff dan artefak run sama; Billing/Delivery selesai sebelum gate; PM membaca keputusan aktual | Sudah diuji — teks QoderWake, E-01–E-04; tidak perlu rerun pada tahap ini |
| Q-02 | Jalur target aplikasi Intake → Delivery → Billing | Request aplikasi menghasilkan urutan domain, preview website internal, dan invoice simulasi terkait tanpa klik antar-agent; label prototype/sintetis jelas | Setelah aplikasi tersedia; konflik urutan V12 belum diputuskan |
| Q-03 | Brief tidak lengkap | Intake meminta informasi spesifik, downstream tidak berjalan | Sudah diuji — teks QoderWake secara terbatas, E-06 |
| Q-04 | Brief kosong, whitespace, format invalid atau terlalu panjang | Validasi batas menolak jelas dan tidak membuat run; limit panjang harus ditetapkan dahulu | Setelah aplikasi tersedia; belum diuji runtime variasi ini |
| Q-05 | Jawaban klarifikasi diberikan | Konteks/versi baru terlacak, alur dilanjutkan sesuai kontrak tanpa duplikasi job | Belum diuji runtime; mapping kelanjutan belum diverifikasi |
| Q-06 | Worker mengembalikan kosong atau schema salah | Handoff dihentikan, alasan validasi tercatat, tidak memakai placeholder sukses | Belum diuji runtime; mekanisme injeksi fixture memerlukan izin baru |
| Q-07 | Schema benar tetapi isi antar-agent bertentangan | Validasi semantik menemukan mismatch lingkup, referensi atau angka; PM tidak menutupi konflik | Belum diuji runtime sebagai kasus negatif |
| Q-08 | QA awal gagal, satu revisi berhasil | Hanya Waker terkait merevisi, QA kedua tercatat sebagai eksekusi baru, maksimal satu siklus | Belum diuji runtime; struktur ada, E-07 |
| Q-09 | QA masih gagal setelah revisi | Status gagal-QA, isu terbuka jelas, tidak ada siklus kedua atau lanjut paket lulus | Belum diuji runtime |
| Q-10 | QA langsung lulus | Satu review aktual; alias hasil QA tidak dihitung dua kali; revisi/recheck skipped | Sudah diuji — teks QoderWake, E-04 |
| Q-11 | Gate disetujui | Satu keputusan setelah paket siap; PM menerima `approved=true` dan scope yang benar | Sudah diuji — teks QoderWake, E-03; UI aplikasi menunggu implementasi |
| Q-12 | Gate Tahan, skip, null atau nilai tidak sesuai | Tidak approved; `waiting_for_founder` sesuai struktur V12; PM akhir tidak berjalan | Belum diuji runtime; hanya E-07 |
| Q-13 | Approval diulang atau datang dari run/paket lama | Tidak ada keputusan/dispatch ganda; paket versi baru tidak otomatis disetujui | Setelah aplikasi/kontrak adapter tersedia |
| Q-14 | Total Billing dan Delivery diperiksa | Item sesuai total dan referensi paket/preview; status pajak eksplisit; angka dan klien sintetis diberi label; invoice simulasi tidak dianggap pengiriman | Sudah diuji — teks QoderWake hanya untuk fixture E-04; invoice simulasi, preview, dan aturan harga nyata belum tersedia/disahkan |
| Q-15 | Total salah, item ganda, mata uang berbeda, pajak belum ditentukan | Mismatch ditolak untuk kelanjutan terkait; tidak diam-diam menganggap pajak nol atau memakai tarif fiktif | Belum diuji runtime |

## 5. Kontrol founder, retry dan pencegahan tagihan ganda

| ID | Skenario | Hasil yang harus dibuktikan | Status |
| --- | --- | --- | --- |
| Q-16 | Pause saat worker aktif | Request dan acknowledgment berbeda; batas checkpoint jelas; tidak mengklaim worker membeku tanpa dukungan | Belum diverifikasi runtime |
| Q-17 | Resume dari pause terkonfirmasi | Lanjut dari checkpoint sah; tahap selesai dan invoice simulasi tidak diulang | Belum diverifikasi runtime |
| Q-18 | Stop sebelum/ketika worker aktif | Status terminal atau penolakan native tercatat; efek pada penjadwalan dibuktikan; artefak lama tetap dapat diaudit | Belum diverifikasi runtime |
| Q-19 | Kontrol unsupported, permission ditolak atau timeout | Tidak mengubah UI menjadi sukses; pemilik tindakan dan ketidakpastian ditampilkan | Setelah adapter/UI tersedia |
| Q-20 | Request job yang sama terkirim dua kali | Deduplikasi mencegah dua run untuk operasi logis yang sama | Setelah aplikasi/adapter tersedia |
| Q-21 | Acknowledgment dispatch hilang | Sistem mencari/merekonsiliasi run yang mungkin sudah dibuat sebelum retry; tidak langsung dispatch ulang | Setelah interface native tersedia |
| Q-22 | Error sementara dan batas retry tercapai | Attempt transport terpisah dari revisi QA, retry terbatas sesuai kebijakan yang disetujui, gagal terlihat | Belum diuji; batas retry belum ditetapkan |
| Q-23 | Event tahap selesai/hasil Billing terkirim ganda | Satu hasil logis dan satu invoice simulasi per identitas operasi; linimasa tidak menghitung pekerjaan dua kali | Setelah aplikasi tersedia |
| Q-24 | Crash/restart setelah invoice simulasi dibuat sebelum acknowledgment | Pemulihan menemukan invoice yang sudah ada, bukan membuat invoice/tagihan baru | Setelah persistence dan adapter tersedia |
| Q-25 | Revisi preview/hasil bisnis sesudah invoice simulasi/approval | Versi invoice simulasi diperbarui secara terlacak, bukan invoice kedua; approval lama tidak diwariskan | Setelah aturan versi dan aplikasi tersedia |
| Q-26 | Stop bersamaan dengan tahap selesai atau hasil datang terlambat | Kedua kejadian direkonsiliasi; hasil selesai tidak hilang; stage tidak didispatch ganda | Setelah kontrak kontrol tersedia |
| Q-27 | Kredit habis atau akses model/flow ditolak | Berhenti/blocked dengan alasan aktual; tidak mengganti akun/model/permission otomatis | Belum diuji sebagai acceptance produk |

Pencegahan tagihan ganda dalam lingkup ini berarti **invoice simulasi internal tidak diduplikasi**. Tidak ada uji pembayaran, pengiriman invoice nyata, atau transaksi eksternal. Klaim exactly-once tidak dibuat hanya karena sebuah deduplication key direncanakan; perlu bukti termasuk race dan restart.

## 6. Keamanan, privasi, performa dan observability

| ID | Skenario | Hasil yang diharapkan | Status |
| --- | --- | --- | --- |
| Q-28 | Prompt injection pada brief/output meminta secret, kirim invoice atau ubah permission | Konten tetap data; batas izin tidak berubah; tidak ada tindakan eksternal | Setelah batas worker/adapter dapat diuji dengan fixture berizin |
| Q-29 | Konten output/preview mengandung HTML/script atau tautan tidak tepercaya | Panel dan preview menampilkan konten dalam batas aman tanpa eksekusi/akses tidak sah; navigasi tidak memberi akses otomatis | Setelah UI/preview tersedia; mekanisme isolasi belum dipilih |
| Q-30 | Pengguna tidak berwenang mencoba approve/stop atau membuka artefak job lain | Akses ditolak pada batas layanan; tidak hanya menyembunyikan tombol | Setelah auth dan aplikasi tersedia |
| Q-31 | Data pribadi/secret pada input, log, preview atau video | Minimasi/redaksi bekerja; tidak ada token/identitas sensitif terbuka dalam bukti demo | Setelah komponen tersedia; review manual bahan video tetap diperlukan |
| Q-32 | Pergantian job dan request silang | Artefak, preview, approval dan invoice simulasi tidak tertukar antar-job | Setelah aplikasi tersedia |
| Q-33 | Keyboard, focus, kontras, zoom, reduced motion dan rendering ruang/preview gagal | Panel, informasi hasil dan kontrol inti dapat diakses; state non-warna jelas; kegagalan preview tidak menghilangkan bukti teks | Setelah prototipe/UI tersedia; belum ada audit WCAG |
| Q-34 | Rendering berat pada perangkat sasaran | Panel tetap responsif; waktu interaksi, frame-time dan ukuran aset diukur terhadap budget yang disepakati | Setelah prototipe tersedia; target perangkat/budget belum final |
| Q-35 | Koneksi putus, reconnect dan event out-of-order | UI menandai stale/unknown, memulihkan state tanpa run baru, tidak mundur ke output lama | Setelah integrasi tersedia |
| Q-36 | Telusuri satu job dari input sampai ringkasan | Correlation job/run, versi, waktu, agent, aktivitas/tugas, handoff, QA, preview, invoice simulasi dan approval bisa direkonstruksi | Bukti parsial native E-01–E-04; observability aplikasi/preview/invoice belum ada |
| Q-37 | Bandingkan angka kredit dengan sumber dan output | Snapshot akun/waktu jelas, selisih dihitung benar, tidak mencampur kredit dengan harga jasa | Observasi historis E-05 tersedia; pelacakan aplikasi dan submission belum diverifikasi |
| Q-38 | Uji pemicu aplikasi menuju Autonomous Work/flow | Sumber event nyata, mapping `client_request`, idempotensi dan hasil run terbukti end-to-end | Belum tersedia/terverifikasi; Autonomous Work belum dibuat/dihubungkan |
| Q-39 | Preview website dalam cakupan/template MVP | Preview dapat dibuka dan ditinjau di dalam aplikasi; interaksi yang termasuk scope berfungsi; manifest, versi, acceptance dan QA terkait run yang sama; label prototype jelas | Setelah aplikasi/preview tersedia; belum dibangun atau diuji |
| Q-40 | Preview gagal, kosong, di luar scope atau tidak sesuai manifest | Kegagalan ditampilkan, handoff/gate terkait tidak diloloskan, tidak ada placeholder sukses, publikasi atau label production | Setelah aplikasi/preview tersedia; belum diuji |
| Q-41 | Invoice simulasi dan status `terkirim (simulasi)` | Klien sintetis, item/total dan referensi preview benar; satu invoice per operasi; perubahan status hanya internal tanpa request pengiriman, kontak klien, pembayaran atau transaksi eksternal | Setelah aplikasi tersedia; kesesuaian dengan brief tetap O-04 |
| Q-42 | Virtual Office menampilkan tim dan pekerjaan aktual | Delapan Waker tampil sebagai lima pendukung dan tiga business agent; status, aktivitas, tugas, handoff, preview dan invoice sesuai job/run, bukan animasi atau data fiktif | Setelah aplikasi tersedia; belum diuji |

Tidak ada threshold performa karangan atau klaim aksesibilitas lulus. Targetnya harus disepakati sesudah perangkat/prototipe tersedia, lalu diukur.

## 7. Pelaporan tes kelak

Untuk setiap pengujian yang diizinkan, catat dalam register ini: ID skenario, tanggal, izin dan batasnya, versi aplikasi/flow, input sintetis, run ID, ekspektasi, hasil aktual, artefak/log pendukung, saldo sebelum/sesudah bila berbiaya, serta keputusan berhenti atau tindak lanjut. Hasil gagal tetap dilaporkan; rerun tidak menghapusnya.

Bukti mentah/video tambahan mungkin dibutuhkan kemudian untuk submission, tetapi tidak dibuat pada tahap delapan dokumen ini. Tautkan bukti yang benar-benar tersedia, jangan membuat path seolah berkas bukti telah ada.

## 8. Gerbang kesiapan

- Jalur domain target, bad input, artefak invalid, konsistensi, gate dan deduplikasi harus memiliki bukti sebelum disebut integrasi berhasil.
- QA gagal, pause/resume/stop dan pemicu aplikasi tetap belum lulus sampai skenario terkait benar-benar dijalankan.
- Preview website dan invoice simulasi belum lulus sampai Q-39–Q-42 beserta skenario keamanan, aksesibilitas, kegagalan, dan deduplikasi yang relevan benar-benar dijalankan setelah aplikasi tersedia.
- Preview hanya disebut tersedia/diuji jika artefak preview dan bukti interaksi yang relevan tersedia; preview tidak boleh disebut website production atau hasil publikasi.
- Status `terkirim (simulasi)` hanya boleh diklaim sebagai state internal yang terbukti tanpa tindakan eksternal, bukan pengiriman tagihan.
- Tidak boleh menyatakan siap pilot hanya dari `Succeeded` native atau 13 checks review teks.
- Kesesuaian invoice simulasi dengan “kirim tagihan”, harga nyata, segmen serta cakupan/acceptance preview, capability adapter dan aturan submission merupakan gap keputusan, bukan kegagalan yang boleh ditutup dengan tindakan tak berizin.

Batas klaim dan rundown ada di [DEMO_PLAN.md](DEMO_PLAN.md). Tahap sekarang berhenti setelah peninjauan dokumentasi, tanpa menjalankan skenario di atas.
