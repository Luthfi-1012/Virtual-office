# Architecture — Batas Komponen dan Aliran Data Awal

Tanggal: 19 November 2026. Status: rancangan konseptual untuk peninjauan; tanpa stack final, endpoint fiktif, atau implementasi.

## 1. Fakta, keputusan dan asumsi

**Fakta historis:** QoderWake memiliki WakerFlow V12 dengan delapan Waker dan bukti eksekusi teks sintetis. Aplikasi Virtual Office, preview website, invoice simulasi, mapping API ke `client_request`, dan sumber event aplikasi belum tersedia/terverifikasi. Tidak ada Autonomous Work yang telah dibuat atau dihubungkan.

**Keputusan MVP pengguna:** Virtual Office menjadi aplikasi utama dengan delapan Waker dalam dua kelompok—lima pendukung dan tiga business agent; Delivery menargetkan preview website yang dapat ditinjau di dalam aplikasi, sedangkan Billing menargetkan invoice simulasi untuk klien sintetis dengan status internal `terkirim (simulasi)`. Tidak ada pengiriman invoice sungguhan, kontak klien, pembayaran, publikasi, perubahan production, atau integrasi pada tahap ini.

**Asumsi arsitektur kandidat:** aplikasi memakai satu batas layanan untuk mengirim niat founder, memvalidasi hasil dan menyajikan state; adapter tipis menghubungkan ke kemampuan native yang benar-benar tersedia. Jika WakerFlow dipilih sebagai scheduler, aplikasi tidak mendispatch setiap Waker secara paralel sebagai scheduler kedua.

Sumber dan keputusan terbuka lintas-proyek ada di [PROJECT_BRAIN.md](PROJECT_BRAIN.md). Kontrak domain menjadi acuan [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## 2. Komponen konseptual

| Komponen | Tanggung jawab | Batas / status |
| --- | --- | --- |
| Office renderer | Menyajikan dua kelompok, delapan Waker, status, aktivitas, tugas, handoff relevan, dan pemilihan agent/job | Rancangan visual isometrik tidak memilih engine; bukan sumber kebenaran status |
| Panel HTML | Brief, pipeline, detail hasil, isu, linimasa, gate, kontrol, dan invoice simulasi | Harus tetap dapat digunakan tanpa navigasi ruang |
| Preview renderer | Menampilkan preview website klien di dalam aplikasi untuk ditinjau founder | Target MVP; prototype internal, bukan publikasi atau website production |
| Lapisan state/presentasi | Menghubungkan pilihan UI ke snapshot job/run dan freshness | Bentuk implementasi/framework belum dipilih |
| Batas layanan aplikasi | Otorisasi founder, validasi request, korelasi job/run, audit tindakan dan status simulasi | Usulan, belum ada server/API yang dibuat |
| Adapter QoderWake | Dispatch yang didukung, pembacaan status/hasil, pengiriman keputusan/kontrol yang didukung | Antarmuka, autentikasi dan transport belum diverifikasi |
| WakerFlow dan delapan Waker | Menjalankan orkestrasi native yang sudah tersimpan | V12 bukan aplikasi; urutannya belum identik dengan target bisnis |
| Penyimpanan artefak/audit | Menyimpan referensi input, preview, invoice simulasi, validasi, keputusan dan deduplikasi | Kebutuhan konseptual; datastore, retensi, backup belum dipilih |
| Sumber event aplikasi | Menandai permintaan klien yang valid untuk diproses | Belum ada sumber nyata; bukan placeholder webhook yang dianggap aktif |

Tidak ada komponen yang dibuat oleh dokumen ini. Nama komponen bukan nama produk/dependency yang disetujui. Status `terkirim (simulasi)` hanya merupakan state aplikasi internal dan tidak boleh memicu pengiriman eksternal.

## 3. Aliran data kandidat

1. Founder memberikan brief melalui panel HTML. Validasi awal menangani kosong, panjang/format yang tidak didukung dan data sensitif sesuai kebijakan yang kelak disetujui.
2. Batas layanan memastikan founder berwenang, mengidentifikasi job dan versi masukan, lalu meminta dispatch melalui adapter **hanya bila interface native terbukti**.
3. Adapter memetakan request ke input WakerFlow. Nama `client_request` diketahui dari flow; schema transport, autentikasi, lokasi endpoint, dan cara mendapatkan run ID belum diketahui.
4. WakerFlow menjadi pemilik penjadwalan tahap dalam opsi ini. Tiga business role dan lima Waker pendukung tidak didispatch ulang oleh animasi, UI atau event handler lain.
5. Status, aktivitas, tugas, handoff, dan hasil yang tersedia dari sumber native direkonsiliasi menjadi state aplikasi, dengan job/run, versi, waktu dan asal bukti.
6. Panel, kantor, dan preview renderer membaca state yang sama. Render tidak menandai pekerjaan selesai berdasarkan timer atau pergerakan avatar; preview hanya tampil sebagai prototype internal dan tidak menjadi jalur publikasi.
7. Paket target yang lengkap—preview website dan invoice simulasi untuk klien sintetis—menghasilkan gate aktual. Keputusan founder dikirim melalui kemampuan resmi yang terbukti, terikat run dan versi paket; PM akhir membaca keputusan yang sudah diakui.
8. Status `terkirim (simulasi)` hanya diubah oleh state internal aplikasi setelah validasi yang disepakati. Status tersebut tidak memicu network request pengiriman, kontak klien, pembayaran, atau transaksi eksternal.
9. Request pause/resume/stop melalui pemeriksaan kemampuan dan status; konfirmasi native menentukan perubahan state, bukan keberhasilan klik di UI.

Pilihan push-event, polling, snapshot atau kombinasi belum diputuskan. Reconnect harus merekonsiliasi state run yang ada, bukan otomatis membuat run baru. Cara aman merender preview beserta isolasi kontennya tetap keputusan teknis terbuka; dokumen ini tidak memilih iframe, sandbox, atau mekanisme lain.

## 4. Boundary dan data konseptual

| Objek | Identitas/relasi penting | Invarian yang diusulkan |
| --- | --- | --- |
| Job | Permintaan bisnis dan versi brief | Tidak tertukar antar-klien; perubahan input dapat dilacak |
| Run | Relasi ke job dan versi workflow | Run yang sama dipakai untuk keputusan serta hasil terkait |
| Step execution | Peran, tahap, aktivitas/tugas, handoff, attempt, waktu, state | Eksekusi nyata dibedakan dari cabang skipped; UI tidak mengarang aktivitas |
| Artifact | Pemilik, versi, jenis hasil, validasi, referensi input | Artefak rancangan tidak dilabeli preview; preview tidak dilabeli website production |
| Preview website | Job/run, cakupan/template, manifest, versi, acceptance, hasil interaksi/QA | Hanya prototype internal untuk ditinjau; tidak ada publikasi |
| QA review | Referensi artefak/preview, checks dan hasil | Alias `qa_awal`/`qa_akhir` tidak otomatis berarti dua review; review teks bukan uji preview |
| Approval | Run, versi paket preview/invoice, keputusan, lingkup, waktu, aktor berwenang | Tidak diwariskan ke paket yang berubah |
| Invoice simulasi | Klien sintetis, versi preview, item, mata uang, total, status pajak, status internal | Satu operasi logis tidak menciptakan invoice ganda; `terkirim (simulasi)` tidak memicu tindakan eksternal |
| Control request | Run, aksi, status request dan acknowledgment | Requested berbeda dari Paused/Stopped |
| Usage observation | Sumber, akun berlabel aman, waktu, saldo | Kredit Qoder tidak disamakan dengan token/USD atau biaya klien |

Ini model konseptual, bukan schema database, kontrak SDK atau keputusan endpoint. Pemilihan ID, versioning, penyimpanan nominal uang, deduplication key, dan representasi status simulasi perlu review sebelum implementasi.

## 5. Adapter QoderWake: matriks kemampuan yang harus dibuktikan

| Kebutuhan | Yang diketahui | Yang masih perlu bukti |
| --- | --- | --- |
| Memanggil flow dengan brief | Input native bernama `client_request`; flow sudah pernah dijalankan manual | API/SDK/event resmi, auth, respons run ID, izin penggunaan |
| Membaca status dan output | Detail run dapat diperiksa lewat UI native | Interface aplikasi, schema, freshness, pagination atau event ordering bila relevan |
| Mengirim approval | Gate native pada Run 5 berhasil, lalu PM menerima nilai aktual | Interface kontrol aplikasi, pengikatan aktor/run/paket, penanganan request berulang |
| Pause/resume/stop | Belum terverifikasi runtime | Ketersediaan, checkpoint/terminasi, acknowledgment dan kondisi penolakan |
| Memicu Autonomous Work | Belum dibuat/dihubungkan | Event/API aplikasi nyata, mapping input, deduplikasi, serta dukungan native |
| Melihat penggunaan kredit | Snapshot UI historis tersedia | Interface untuk produk jika diperlukan dan otorisasi pembacaannya |

UI automation yang pernah dipakai untuk setup bukan bukti API aplikasi siap produksi. Jangan menebak endpoint, memeriksa binary internal untuk membuat jalur tersembunyi, menaruh secret dalam prompt, atau menganggap konfigurasi generic/custom berarti adapter resmi tersedia.

Jika interface tidak tersedia, laporkan blocker dan batasi klaim demo pada native flow yang dapat dibuktikan. Jangan memasang fallback otomatis yang diam-diam mengubah scope atau scheduler.

## 6. Konsistensi, idempotensi dan kegagalan

- Acknowledgment dispatch yang hilang tidak membuktikan request gagal: periksa run sebelum retry, sesuai kemampuan native yang kelak tersedia.
- Aksi founder yang diklik dua kali tidak boleh memulai dua run, dua keputusan, atau dua invoice simulasi.
- Event terlambat tidak menimpa state yang lebih baru; mekanisme ordering/version check belum dipilih.
- Retry jaringan, revisi QA, dan run baru memiliki makna berbeda; counter dan izin tidak digabung.
- Jika stop diminta bersamaan dengan tahap selesai, simpan kedua fakta dan tampilkan hasil rekonsiliasi, bukan menghapus artefak selesai.
- Outcome unknown tetap unknown sampai ada bukti; tidak memakai badge sukses sebagai fallback.
- Satu scheduler adalah invariant rancangan, bukan jaminan integrasi saat ini.

Detail skenario race, restart, duplikasi dan retry ada di [QUALITY_PLAN.md](QUALITY_PLAN.md).

## 7. Keamanan dan privasi target

- Kontrol eksekusi, approval dan akses artefak harus dibatasi ke founder yang berwenang. Mekanisme autentikasi belum dipilih; demo lokal bukan alasan mengekspor kontrol tanpa proteksi.
- Client brief, output worker, file referensi dan metadata diperlakukan sebagai data tidak tepercaya. Instruksi di dalamnya tidak memperluas izin sistem.
- Credentials hanya digunakan pada batas layanan yang semestinya, tidak di browser bundle, prompt, log atau video submission. Penyimpanan secret masih keputusan terbuka.
- Output tidak boleh dirender sebagai HTML aktif atau menjalankan perintah dari konten agent tanpa sanitasi/otorisasi yang tepat.
- Preview website harus ditampilkan dalam batas rendering yang disetujui agar konten prototype tidak memperoleh akses aplikasi, kredensial, atau kemampuan eksternal secara diam-diam. Mekanisme isolasinya belum dipilih atau diuji.
- Status `terkirim (simulasi)` tidak boleh dihubungkan ke pengiriman invoice, kontak klien, pembayaran, atau transaksi eksternal.
- Minimalkan data klien; gunakan sintetis untuk demo. Retensi, penghapusan, backup dan persetujuan penggunaan data perlu kebijakan sebelum pilot.
- Batasi hak adapter pada kemampuan yang disetujui. Pembayaran, pengiriman invoice dan publikasi tidak diaktifkan untuk memenuhi demo secara diam-diam.
- Deployment boundary dan isolasi antar-pengguna perlu diputuskan jika lingkup melampaui demo satu founder; multi-tenant bukan asumsi MVP.

Tidak ada kontrol keamanan di atas yang diklaim sudah diimplementasikan atau diuji.

## 8. Keputusan teknis terbuka

| Topik | Opsi/kriteria evaluasi | Status |
| --- | --- | --- |
| Rendering kantor | Implementasi arah isometrik; bandingkan kejelasan tugas, performa dan effort | Menunggu prototipe kecil berizin; referensi visual tidak memilih engine |
| Framework UI | Kesesuaian panel aksesibel, state dan lingkungan pengguna | Belum dipilih |
| Preview renderer | Cakupan/template, isolasi konten, interaksi yang diizinkan dan cara menguji | Belum dipilih; preview bukan publikasi |
| Layanan aplikasi | Kebutuhan runtime, otorisasi, korelasi dan adapter | Belum dipilih |
| Transport native | Hanya interface QoderWake yang terverifikasi | Belum tersedia/terverifikasi |
| Scheduler | Kandidat WakerFlow tunggal; alternatif harus menghindari dispatch ganda | Belum final untuk aplikasi; V12 native sudah berjalan |
| Persistensi | Durabilitas job, preview, invoice simulasi, approval dan deduplikasi | Belum dipilih |
| Hosting/workspace implementasi | Ketersediaan layanan, batas akses, izin dan biaya | Belum ditetapkan |
| Timeout/retry | Sesuai semantik dispatch dan idempotensi native | Belum ditetapkan |
| Observability | Log terstruktur, korelasi, redaksi dan budget retensi | Kebutuhan target; belum implementasi |
| Harga/invoice simulasi | Sumber tarif sah atau fixture berlabel, versi preview, aturan pajak, status internal | Menunggu founder; fixture uji tidak berlaku komersial dan status simulasi bukan pengiriman |

Tidak ada ADR terpisah dibuat karena belum ada keputusan stack final dan pengguna meminta hanya delapan file. Catat keputusan kelak pada dokumen ini setelah peninjauan; rekomendasi artefak tambahan tidak berarti izin pembuatannya.

## 9. Gerbang sebelum coding

Peninjauan harus menyelesaikan segmen serta cakupan/template dan acceptance preview pada O-01, konflik urutan V12 pada O-03, kesesuaian invoice simulasi dengan maksud brief pada O-04, sumber event yang sesungguhnya, akses adapter dan kontrol native, ruang lingkup data, batas keamanan preview, serta workspace implementasi. Tanpa itu, rancangan ini tetap proposal, bukan integrasi siap jalan.
