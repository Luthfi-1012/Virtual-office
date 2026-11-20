# Demo Plan — Virtual Office / One Person Company

Tanggal: 19 November 2026. Status: rencana demo/video, **bukan video yang sudah dibuat atau submission yang sudah dikirim**.

## 1. Ketentuan sumber primer

Brief lokal meminta link video demo One Person Company beserta pemakaian kredit Qoder melalui form via email, durasi **maksimal lima menit**, final submission **22 November 2026**. Jam/zona waktu cutoff, form aktual, lokasi unggah video, dan perubahan aturan belum tercatat. Jangan menebak URL atau mengirim apa pun pada tahap ini.

Tools tertulis “100% Qoder: IDE + QoderWake.” Rubric dan formula kredit menjadi acuan tunggal di [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md). Sumber primer lengkap ada di [PROJECT_BRAIN.md](PROJECT_BRAIN.md#10-daftar-sumber).

## 2. Narasi yang ingin dibuktikan

Virtual Office dirancang sebagai aplikasi utama bagi satu founder, menampilkan delapan Waker dalam dua kelompok: lima pendukung proyek dan tiga business agent. Founder dapat meninjau status, aktivitas, tugas, dan handoff relevan tanpa menyalin payload antar-agent.

Target Web Delivery adalah preview website klien yang dapat ditinjau di dalam aplikasi dalam cakupan/template MVP, bukan hanya spesifikasi teks. Billing menargetkan invoice simulasi untuk klien sintetis dengan status `terkirim (simulasi)` hanya di dalam aplikasi. Preview adalah prototype; invoice simulasi bukan pengiriman nyata, pembayaran, atau transaksi eksternal.

Ini target narasi produk, bukan ringkasan kemampuan yang sudah tersedia. Bukti saat ini hanya orkestrasi teks QoderWake; aplikasi kantor, preview website, invoice simulasi, integrasi, QA gagal, serta pause/resume/stop belum dibangun atau terverifikasi.

## 3. Pisahkan bukti tersedia dan bukti yang masih dibutuhkan

| Bagian cerita | Yang tersedia sekarang | Yang masih dibutuhkan untuk klaim produk |
| --- | --- | --- |
| Handoff | V12/Run 5, delapan Waker dan sembilan eksekusi; lihat E-01/E-02 | Urutan target domain Intake → Delivery → Billing dan input aplikasi yang nyata |
| Approval | Gate internal dan nilai `approved=true` pada input PM; E-03 | Kontrol approval aplikasi dan pengikatan versi paket preview/invoice |
| Preview dan QA | Rancangan teks serta satu review spesifikasi; E-04 | Preview website yang dapat ditinjau di dalam aplikasi, cakupan/template MVP, dan pengujian interaksi yang relevan |
| Invoice simulasi | Total fixture teks konsisten; E-04 | Invoice simulasi untuk klien sintetis, status `terkirim (simulasi)` internal, pencegahan duplikasi, serta penjelasan kesesuaiannya dengan brief pada O-04 |
| Bad input | Brief tidak lengkap berhenti pada Intake; E-06 | Bukti rinci run/input bila akan dimasukkan video; variasi invalid lain belum teruji |
| Pause/resume/stop | Belum terverifikasi | Uji kontrol nyata, acknowledgment dan akibatnya; tidak boleh mock sukses |
| UI kantor | Dua kelompok Waker dan referensi visual sebagai arah desain | Aplikasi utama yang menampilkan lima pendukung dan tiga business agent dengan status, aktivitas, tugas, handoff, preview, dan kontrol nyata |
| Kredit Qoder | Snapshot historis E-05 | Snapshot relevan saat perekaman, output terkait, aturan akun/seat yang benar |
| Penggunaan Qoder | Setup dan pemeriksaan native QoderWake tercatat; dokumen dipersiapkan melalui Qoder Desktop | Bukti penggunaan Qoder IDE untuk aplikasi belum tercatat; jangan menyamakan Desktop dengan IDE |

Semua kode E merujuk [register bukti QUALITY_PLAN.md](QUALITY_PLAN.md#2-register-bukti-yang-sudah-ada). Status teruji tidak diperluas melampaui kolom bukti yang tersedia.

## 4. Rundown target maksimal 300 detik

Rundown ini baru dapat direkam sebagai demo produk setelah bukti yang dibutuhkan tersedia dan aktivitas perekaman/pengujian diizinkan. Jika masih hanya ada bukti native, tampilkan sebagai demo orkestrasi teks dengan gap yang jelas, bukan demo aplikasi selesai.

| Waktu | Segmen | Yang ditampilkan / dibuktikan |
| --- | --- | --- |
| 0:00–0:25 | Masalah, pengguna, track | Founder jasa website, masalah handoff dan konsistensi; Professional Services; data demo sintetis |
| 0:25–0:55 | Virtual Office | Dua kelompok dan delapan Waker total; lima pendukung dan tiga business agent dengan status, aktivitas, tugas, serta handoff aktual hanya jika UI nyata tersedia |
| 0:55–1:55 | Brief dan handoff | Masukan, validasi, perpindahan otomatis dengan run yang sama, hasil tiap tahap; tidak ada klik manual antar-agent |
| 1:55–2:35 | Preview dan invoice simulasi | Preview website ditinjau di dalam aplikasi sebagai prototype dalam scope/template MVP; QA yang benar-benar dilakukan; invoice simulasi untuk klien sintetis dengan item/total/pajak eksplisit dan status `terkirim (simulasi)` hanya internal |
| 2:35–3:15 | Gate founder dan ringkasan | Paket preview/invoice sudah lengkap sebelum gate, keputusan aktual, PM sesudah gate menerima approval; lingkup internal saja |
| 3:15–3:50 | Input buruk | Bukti terpisah brief tidak lengkap, klarifikasi dan downstream yang tidak berjalan; jangan mengedit rekaman agar tampak satu run yang sama |
| 3:50–4:30 | Kontrol founder | Pause/resume/stop hanya jika teruji; tunjukkan requested → confirmed beserta dampaknya, atau ungkapkan belum terverifikasi sebagai gap |
| 4:30–5:00 | Qoder, kredit, hasil dan batas | Bukti tools yang benar-benar dipakai, penggunaan kredit beserta output, apa yang belum diuji/siap pilot; simulasi tidak disebut transaksi eksternal |

Durasi total 300 detik adalah batas maksimum; rencana penyuntingan perlu menyisakan margin agar hasil ekspor tidak melebihi lima menit. Durasi runtime agent bisa lebih lama dari segmen video. Pemotongan/fast-forward harus diberi label dan mempertahankan urutan, identitas run serta keputusan aktual.

## 5. Urutan rekaman dan integritas bukti

1. Tentukan klaim yang sudah memiliki bukti; tandai fitur belum tersedia sebelum merekam.
2. Gunakan arsip run yang ada jika cukup. Run baru hanya setelah izin eksplisit, dengan budget kredit dan batas tindakan yang jelas.
3. Perlihatkan asal input, identitas run/versi, tahap aktif dan hasil. Jangan menyatukan input satu run dengan output run lain.
4. Tunjukkan paket sebelum gate serta nilai keputusan pada input/ringkasan PM setelah gate. Klik approval adalah keputusan bisnis, bukan handoff manual antar-agent.
5. Untuk Run 5, sebut urutan native Billing → Client Delivery → gate → PM. Jangan menganimasikannya sebagai Delivery → Billing; gap penyelarasan target harus diungkapkan.
6. Sebut QA sebagai review spesifikasi bila yang tersedia hanya review teks; jangan menampilkan nama kategori QA seolah merupakan hasil browser/API test.
7. Labeli fixture Kopi Senja dan seluruh angka biayanya sebagai sintetis. Pajak tidak dihitung bukan berarti tarif pajak nol atau pajak tidak berlaku. Tampilkan preview sebagai prototype internal dan `terkirim (simulasi)` sebagai state aplikasi tanpa pengiriman/pembayaran nyata.
8. Gunakan bukti kontrol gagal/unsupported secara jujur bila belum ada hasil terkonfirmasi; jangan mengganti dengan animasi tombol sukses.
9. Catat kredit sebagai observasi akun/waktu tertentu. Selisih historis E-05 mencakup interval perubahan/run, bukan atribusi rinci per-Waker.
10. Review video untuk redaksi data sensitif, koherensi urutan, batas klaim dan durasi sebelum mempertimbangkan submission.

Tidak ada langkah perekaman, render, upload, atau submission yang dijalankan dalam tahap dokumentasi ini.

## 6. Bukti bisnis yang perlu dipersiapkan kelak

- Segmen klien serta masalah nyata yang dipilih, tanpa mengklaim riset/pelanggan yang belum ada.
- Cakupan/template preview website dan acceptance minimum pada O-01. Preview adalah target MVP yang dipilih founder, bukan kewajiban literal brief; jangan menjual rancangan teks sebagai preview atau preview sebagai website production.
- Acceptance preview serta jejak QA interaksi yang relevan, tidak hanya status Completed atau review spesifikasi.
- Kebijakan tarif, revisi, dan pajak yang disetujui founder. Rp5.500.000 pada fixture bukan harga komersial yang ditetapkan.
- Penjelasan invoice simulasi untuk klien sintetis dan status `terkirim (simulasi)` yang hanya internal. Kesesuaiannya dengan “Billing kirim tagihan” harus diputuskan founder dan, bila perlu, dikonfirmasi ke panitia pada O-04; tidak boleh ada pengiriman nyata untuk menutup gap.
- Peran operasional founder ketika brief kurang, preview/invoice salah atau eksekusi terblokir.

Klaim “siap dipilotkan” masih terbuka sampai gap ini diselesaikan dan hasilnya dibuktikan.

## 7. Klaim yang boleh dan tidak boleh

| Boleh dengan bukti saat ini | Tidak boleh disimpulkan |
| --- | --- |
| “QoderWake menjalankan alur teks sintetis dengan handoff otomatis pada Run 5.” | “Aplikasi Virtual Office sudah terintegrasi.” |
| “Approval founder paket internal diteruskan sebagai `approved=true` ke PM akhir.” | “Approval aplikasi, penolakan dan semua kontrol sudah lulus.” |
| “Satu review spesifikasi QA tercatat dan total fixture konsisten.” | “Preview website, kode, API, browser test, atau integrasi aplikasi sudah dibuat/diuji.” |
| “Rancangan MVP memilih preview website internal.” | “Preview sudah tersedia, production-ready, atau dapat dipublikasikan.” |
| “Rancangan MVP memilih invoice simulasi dengan status internal `terkirim (simulasi)`.” | “Invoice sudah dikirim, klien sudah dihubungi, pembayaran terjadi, atau simulasi pasti memenuhi brief.” |
| “Brief tidak lengkap pernah berhenti pada Intake dan meminta klarifikasi.” | “Semua bad input, output invalid dan cabang QA gagal sudah teruji.” |
| “Terdapat snapshot pemakaian kredit dengan hasil terkait.” | “Seluruh kredit pasti memenuhi skor panitia atau boleh digabung lintas akun.” |
| “Dua kelompok Waker dan referensi isometrik adalah arah desain yang akan diuji.” | “Pilihan 3D/stack final, lisensi aset, dan semua fitur UI sudah disetujui.” |

Autonomous Work belum dibuat/dihubungkan; pemicunya menunggu sumber event/API aplikasi yang sesungguhnya. Jangan memperlihatkan endpoint palsu atau menyebut trigger aplikasi siap.

## 8. Checklist sebelum submission — belum dijalankan

- [ ] Semua klaim video terhubung ke bukti nyata dan jenis pengujiannya disebutkan.
- [ ] Minimal tiga business agent dan handoff tanpa klik antar-agent dapat dibuktikan pada alur yang diklaim.
- [ ] Hasil bisnis, bad input, kontrol dan gap yang belum teruji ditampilkan dengan jujur.
- [ ] Pemakaian Qoder IDE dan QoderWake dibuktikan sesuai ketentuan, bukan diasumsikan.
- [ ] Kredit, akun/seat relevan dan output cocok; data akun sensitif disamarkan.
- [ ] Bahan visual/audio orisinal atau berlisensi; video referensi tidak disalin.
- [ ] Tidak ada token, secret, data klien nyata atau notifikasi pribadi dalam video.
- [ ] Durasi file final tidak melebihi lima menit.
- [ ] Form, cutoff dan ketentuan terbaru diverifikasi dari panitia; URL tidak ditebak.
- [ ] Izin untuk unggah/kirim submission diberikan terpisah; tidak dianggap bagian dari penulisan dokumen.

## 9. Keputusan terbuka dan titik berhenti

Tinjau [PROJECT_BRAIN.md](PROJECT_BRAIN.md#8-pertanyaan-terbuka) untuk segmen serta cakupan/template dan acceptance preview, urutan workflow, harga, kesesuaian invoice simulasi dengan brief, capability adapter, kontrol dan aturan submission. Bukti video, file aplikasi atau test fixture tambahan hanya rekomendasi pekerjaan berikutnya, bukan file yang dibuat sekarang.

Berhenti setelah delapan dokumen diperiksa dan dilaporkan. Coding, integrasi, pengujian aplikasi, perubahan QoderWake, pembuatan Autonomous Work, dan submission menunggu peninjauan serta izin berikutnya.
