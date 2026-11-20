# Project Brain — Virtual Office

Tanggal: 19 November 2026. Status: draft untuk ditinjau; bukan izin implementasi.

## 1. Tujuan dan masalah

Mempersiapkan Virtual Office untuk satu founder yang menjalankan perusahaan virtual penyedia jasa pembuatan website. Founder perlu melihat pekerjaan, hasil, dan hambatan serta mengendalikan keputusan penting tanpa memindahkan pekerjaan secara manual antar-agent.

Masalah yang dituju adalah brief klien yang tidak lengkap, perpindahan pekerjaan yang kehilangan konteks, hasil dan biaya yang tidak konsisten, serta status agent yang tidak bisa dibuktikan. Ini hipotesis masalah dari kebutuhan proyek, bukan temuan riset pengguna atau bukti permintaan pasar.

Track yang dipilih: **Professional Services**. Website delivery adalah asumsi bisnis terkini yang diminta pengguna, bukan keputusan harga, cakupan paket, atau janji layanan yang sudah disahkan. Contoh layanan paket konten dari diskusi lama bukan keputusan proyek ini.

Rancangan MVP founder menargetkan preview website klien yang dapat ditinjau di dalam aplikasi dan invoice simulasi untuk klien sintetis. Keduanya keputusan proyek, bukan persyaratan literal brief atau fitur yang sudah tersedia. Status `terkirim (simulasi)` hanya internal; tidak ada pengiriman invoice sungguhan, kontak klien, pembayaran, publikasi, atau transaksi eksternal.

## 2. Aturan membaca dokumen

- **Fakta terverifikasi:** didukung brief lokal yang diperiksa atau bukti eksekusi yang sudah tercatat dalam percakapan; jenis sumber tetap disebutkan.
- **Asumsi sementara:** pilihan kerja untuk menyusun kebutuhan, belum menjadi fakta bisnis atau kemampuan runtime.
- **Keputusan:** batas atau arah yang sudah ditetapkan pengguna; keputusan ini tidak otomatis memberikan izin implementasi.
- **Pertanyaan terbuka:** perlu bukti atau persetujuan sebelum dijadikan komitmen.

Semua rancangan aplikasi dalam dokumen ini belum diimplementasikan atau diuji. Fakta QoderWake adalah catatan historis, bukan pemeriksaan ulang live pada tahap dokumentasi.

## 3. Pengguna dan peran

| Peran | Kebutuhan | Status |
| --- | --- | --- |
| Founder/operator | Mengirim atau meninjau brief, memantau job dan hasil, memberi approval, meminta pause/resume/stop | Kebutuhan proyek |
| Klien jasa website | Brief dipahami, hasil sesuai kesepakatan, rincian biaya transparan | Pengguna bisnis; kanal dan segmen spesifik belum ditetapkan |
| Juri/reviewer | Bukti handoff, output, penanganan kesalahan, UI, dan penggunaan Qoder | Kebutuhan demo sesuai brief |

Tiga business agent adalah **Client Intake, Client Delivery, Billing**. Tim QoderWake berjumlah **delapan Waker total**, bukan delapan ditambah tiga. Lima Waker pendukungnya adalah Project Manager / Orchestrator, UI/UX Designer, Backend Agent, Frontend Agent, dan QA Engineer. Tiga Waker lain mewakili business agent tersebut; rincian tanggung jawab ada di [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## 4. Fakta terverifikasi

### Brief primer lokal [S1]

- Format individu, satu founder, Virtual Office UI, minimal tiga agent bisnis yang saling menyerahkan pekerjaan otomatis.
- Track Professional Services menyebut Intake menerima klien baru, Delivery mengerjakan proyek, Billing mengirim tagihan.
- Tools tertulis **“100% Qoder: IDE + QoderWake.”** Penggunaan produk Qoder lain tidak otomatis membuktikan pemenuhan ketentuan ini.
- Periode online 17–22 November 2026, final submission 22 November; jam dan zona waktu batas akhir tidak tercantum pada materi yang diperiksa.
- Submission berupa link video demo One Person Company dan pemakaian kredit Qoder melalui form via email; durasi maksimal lima menit.
- Bobot, teks rubric, dan formula kredit disalin di [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md), bukan ditafsirkan dari memori.

Ini verifikasi isi arsip lokal, bukan konfirmasi bahwa ketentuan panitia belum berubah. URL asal arsip dan form submission aktual belum tercatat; metadata canonical dan `og:url` tidak ditemukan pada arsip.

### Matriks keputusan hasil verifikasi

| Topik | Status | Hasil verifikasi dan batas |
| --- | --- | --- |
| Billing pada brief | **Terverifikasi** | Bagian Professional Services menyebut “Billing kirim tagihan”. Tidak ditemukan ketentuan pembayaran pada teks brief yang diperiksa |
| Batas Billing proyek | **Keputusan MVP; perlu konfirmasi panitia** | D-03 menargetkan invoice simulasi untuk klien sintetis dengan status `terkirim (simulasi)` hanya di dalam aplikasi. Tidak ada pengiriman, pembayaran, atau kontak klien nyata. Kesesuaian simulasi dengan maksud brief terbuka pada O-04 |
| Bentuk hasil Delivery | **Keputusan MVP; belum dibangun** | Brief tidak menetapkan bentuk website. Founder memilih preview website klien yang dapat ditinjau di dalam aplikasi sebagai target, bukan hanya spesifikasi teks. Preview adalah prototype, bukan website production; cakupan/template terbuka pada O-01 dan bukti Run 5 tetap hanya teks |
| Urutan business workflow | **Terverifikasi sebagai target; gap belum diperbaiki** | Susunan track adalah Intake → Delivery → Billing dengan handoff otomatis. V12 menjalankan Billing sebelum Client Delivery; gap dan izin penyelarasannya tetap pada O-03 |
| Virtual Office, agent, kontrol | **Terverifikasi sebagai persyaratan; rancangan MVP** | Brief meminta Virtual Office UI, minimal tiga agent bisnis, status agent, approve, pause, dan stop. Aplikasi utama dirancang menampilkan delapan Waker dalam dua kelompok—lima pendukung dan tiga business agent—beserta status, aktivitas, tugas, dan handoff relevan. Jumlah tambahan tidak otomatis memberi poin dan kontrol hanya mengikuti dukungan nyata |
| Demo dan submission utama | **Terverifikasi** | Link video One Person Company + pemakaian kredit Qoder melalui form yang dikirim via email, maksimal lima menit, final submission 22 Nov dalam materi November 2026 |
| Detail submission terbaru | **Belum terverifikasi** | URL form aktual, jam/zona waktu cutoff, URL asal arsip, pembaruan aturan, serta status seat/eligibility belum dikonfirmasi |
| Referensi UI | **Rancangan visual founder; sumber/lisensi belum terverifikasi** | Camaleodigital menginspirasi interior 3D isometrik terbuka dengan material hangat; George Railean menginspirasi denah 3D isometrik, panel gelap, kategori atas, mini floor plan, dan navigasi Gallery/Room View/Map. Screenshot yang dirujuk founder menjadi bukti arah visual, bukan aturan hackathon atau izin menyalin aset |

### Bukti QoderWake [S3]

Catatan bukti yang menjadi acuan tunggal ada di [QUALITY_PLAN.md](QUALITY_PLAN.md#2-register-bukti-yang-sudah-ada). WakerFlow V12 dan Run 5 membuktikan orkestrasi **teks sintetis**, termasuk approval aktual yang diteruskan ke PM akhir. Bukti ini tidak membuktikan aplikasi Virtual Office, website klien, kode, API, browser test, atau integrasi aplikasi.

### Workspace dokumentasi

Katalog Desktop menamai workspace aktif **`hacathon`**, dengan root `D:\Virtual office Hackathon`; inilah workspace hackathon yang digunakan, tanpa mengganti nama atau memilih workspace lain. Sebelum penulisan, root hanya berisi folder transfer QoderWake; tidak ada folder `docs/` atau delapan nama dokumen yang diminta. Folder transfer tidak diperiksa atau diubah. Lokasi workspace implementasi, akses runtime Waker, dan integrasi aplikasi tetap belum ditetapkan.

## 5. Keputusan yang berlaku [S2]

| ID | Keputusan | Alasan/batas |
| --- | --- | --- |
| D-01 | Tahap ini hanya delapan dokumen Markdown di `docs/` | Peninjauan mendahului coding; tanpa Knowledge Base, instalasi, integrasi, perubahan QoderWake atau Autonomous Work |
| D-02 | Fokus Professional Services menargetkan preview website klien yang dapat ditinjau di dalam aplikasi | Ini keputusan rancangan MVP, bukan kewajiban literal brief. Cakupan/template dan acceptance ditetapkan pada O-01; preview adalah prototype internal, bukan website production atau publikasi, dan belum dibangun |
| D-03 | Billing menargetkan invoice simulasi untuk klien sintetis | Status seperti `terkirim (simulasi)` hanya tampil di dalam aplikasi. Tidak ada pengiriman invoice sungguhan, kontak klien, pembayaran, publikasi, atau perubahan production. Kesesuaian dengan “kirim tagihan” menunggu O-04 |
| D-04 | Bedakan business workflow dari tim pendukung | Aplikasi utama menampilkan delapan Waker dalam dua kelompok: lima pendukung dan tiga business agent, dengan status, aktivitas, tugas, dan handoff relevan. Banyak avatar atau chatbot bukan bukti otomasi |
| D-05 | Dua area kantor terhubung adalah arah desain untuk diperiksa | Camaleodigital menginspirasi cutaway isometrik dan material hangat; George Railean menginspirasi denah isometrik serta pola panel/navigasi. Bukan mandat engine 3D atau izin menyalin aset |
| D-06 | Pisahkan ruang visual dari informasi dan kontrol HTML | Keterbacaan, aksesibilitas, dan bukti proses lebih penting daripada dekorasi |
| D-07 | Stack, adapter, API, model, dan rendering tidak diputuskan dalam tahap ini | Perlu bukti kemampuan, prototipe kecil yang diizinkan, dan peninjauan |
| D-08 | Tidak menimpa dokumen yang telah ada | Konflik harus dilaporkan, bukan diselesaikan dengan penghapusan otomatis |

## 6. Asumsi sementara

| ID | Asumsi | Cara memvalidasi nanti |
| --- | --- | --- |
| A-01 | MVP ditujukan untuk founder yang melayani proyek website berskala kecil | Konfirmasi segmen, jenis website, lingkup layanan, dan contoh kebutuhan klien |
| A-02 | Satu job aktif dan satu founder cukup untuk demonstrasi awal | Tinjau kebutuhan antrean, paralelisme, serta ketentuan demo |
| A-03 | Preview website dalam aplikasi dapat menjadi hasil Delivery yang berguna untuk klien pada scope/template terbatas | Founder menetapkan segmen, cakupan/template, dan acceptance pada O-01; uji preview nyata diperlukan karena Run 5 hanya teks |
| A-04 | WakerFlow berpotensi tetap menjadi satu-satunya penjadwal tahap melalui adapter tipis | Verifikasi antarmuka native dan sumber event aplikasi; belum ada integrasi |
| A-05 | Dua area kantor membantu founder membedakan layanan klien dan kerja pendukung | Uji prototipe kecil setelah mendapat izin; arah isometrik tidak memilih engine dan tidak dilakukan sekarang |

## 7. Batas proyek dan gap

### Lingkup kebutuhan MVP

Brief klien, validasi, tiga business agent dengan handoff otomatis, preview website yang dapat ditinjau di dalam aplikasi, invoice simulasi untuk klien sintetis, delapan Waker dalam dua kelompok dengan status/aktivitas/tugas/handoff, linimasa, dan kontrol founder yang benar-benar didukung. QA serta Waker pengembang mendukung layanan tersebut, bukan menggantikan hasil bisnis. Rincian fungsi ada di [PRD.md](PRD.md).

### Di luar tahap dan larangan

Tidak ada implementasi aplikasi, test aplikasi, instalasi, Knowledge Base, trigger, Autonomous Work, konektor baru, perubahan model atau permission QoderWake. Tidak ada penyalinan aset video, pengiriman invoice sungguhan, kontak klien, penagihan nyata, pembayaran, publikasi preview, deployment, atau perubahan production.

### Konflik yang belum diselesaikan

1. **Urutan:** kontrak bisnis yang diminta adalah Intake → Delivery → Billing. V12 yang diuji menjalankan Billing sebelum Client Delivery pada phase Penyelesaian. V12 bukan bukti urutan bisnis target; lihat [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md#3-target-bisnis-dan-urutan-native-yang-berbeda).
2. **Tagihan:** brief menuliskan “Billing kirim tagihan”, sedangkan keputusan MVP menargetkan invoice simulasi dengan status `terkirim (simulasi)` hanya di dalam aplikasi. Belum diputuskan/dikonfirmasi apakah simulasi memenuhi maksud brief dan diterima panitia pada O-04; tidak boleh ada pengiriman nyata untuk menutup gap.
3. **Hasil layanan:** preview website internal telah dipilih sebagai target MVP, tetapi cakupan/template, acceptance, dan kesesuaiannya dengan kebutuhan klien belum ditetapkan pada O-01. Bukti yang ada hanya rancangan teks sintetis, bukan preview atau layanan siap dipilotkan.
4. **Kontrol:** approve telah diuji untuk paket internal; pause dan stop diwajibkan rubric tetapi belum terverifikasi. Resume adalah kebutuhan pengguna yang berhubungan dengan pause, tidak disebut eksplisit dalam teks rubric.
5. **Integrasi:** pemicu Autonomous Work dari aplikasi menunggu sumber event/API aplikasi yang sesungguhnya dan kemampuan native yang terbukti.

## 8. Pertanyaan terbuka

| ID | Pertanyaan | Pemutus / bukti yang diperlukan |
| --- | --- | --- |
| O-01 | Siapa segmen klien pertama, serta apa cakupan/template preview website dan acceptance minimum yang realistis untuk MVP? | Founder; contoh kebutuhan, halaman/interaksi yang termasuk dan dikecualikan, batas prototype, serta kriteria penerimaan preview |
| O-02 | Bagaimana harga, pajak, revisi, dan syarat pembayaran yang sah ditentukan? | Founder; Rp5.500.000 hanyalah data fiktif uji |
| O-03 | Bagaimana menyelaraskan urutan bisnis target dengan V12 tanpa dua scheduler? | Founder untuk arah dan izin perubahan; peninjauan workflow terpisah tanpa mengubah V12 pada tahap ini |
| O-04 | Apakah invoice simulasi untuk klien sintetis dengan status `terkirim (simulasi)` hanya di aplikasi memenuhi maksud “Billing kirim tagihan” dan diterima untuk submission/pilot? | Founder untuk batas produk dan panitia untuk konfirmasi aturan/penilaian bila perlu; tidak ada pengiriman, kontak klien, atau pembayaran sebagai bagian dari klarifikasi |
| O-05 | Antarmuka native apa yang tersedia untuk dispatch, status, hasil, approval dan kontrol? | Bukti kemampuan QoderWake; tanpa menebak endpoint |
| O-06 | Event aplikasi nyata apa yang dipetakan ke `client_request` dan siapa pemilik sumbernya? | Aplikasi/sumber aktual dan kontrak yang disetujui |
| O-07 | Framework, hosting, persistence, autentikasi, dan workspace implementasi apa yang dipilih? | Bukti kebutuhan dan persetujuan teknis |
| O-08 | Rendering apa yang cukup untuk arah isometrik, apa target perangkat, dan batas performanya? | Prototipe kecil dan pengukuran yang baru dilakukan setelah izin; referensi visual tidak memilih engine |
| O-09 | Apa jam/zona waktu deadline, form submission, dan aturan pembuktian kredit per akun? | Sumber panitia yang berlaku |
| O-10 | Apa identitas kreator, URL serta judul persis dua video referensi dan lisensi aset yang akan dipakai? | Sumber asli; screenshot/video bukan lisensi aset |

## 9. Peta dokumen

| Dokumen | Sumber acuan untuk |
| --- | --- |
| [PROJECT_BRAIN.md](PROJECT_BRAIN.md) | Tujuan, sumber, keputusan, asumsi, dan gap proyek |
| [PRD.md](PRD.md) | Kebutuhan produk, user stories, fungsi, non-fungsi |
| [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md) | Kontrak domain, pembagian peran, handoff dan kontrol |
| [VIRTUAL_OFFICE_UX.md](VIRTUAL_OFFICE_UX.md) | Tata ruang, informasi, interaksi, aksesibilitas, referensi |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Batas komponen, data, adapter dan keputusan teknis terbuka |
| [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) | Kutipan rubric primer dan kriteria demonstrasi |
| [QUALITY_PLAN.md](QUALITY_PLAN.md) | Register bukti, skenario tes, status verifikasi |
| [DEMO_PLAN.md](DEMO_PLAN.md) | Rundown video, kebutuhan bukti, batas klaim submission |

## 10. Daftar sumber

| ID | Sumber dan lokasi | Verifikasi / batas |
| --- | --- | --- |
| S1 | [Arsip HTML brief asli](file:///D:/Downloads/Overview%20Pre-Hackathon%20%26%20Hackathon%20Onsite%20-%20Joint%20Hackathon.html). Judul HTML persis: **Pre-Hackathon & Hackathon Onsite - Joint Hackathon Qwen Conference Indonesia 2026 x Lintasarta** | Teks konten diperiksa 19 November 2026. Acuan primer persyaratan/rubric: bagian Pre-Hackathon, Professional Services, Porsi penilaian, dan Submit. URL asal belum tercatat; script/stylesheet tidak dijalankan |
| S2 | Instruksi pengguna pada percakapan ini, tahap persiapan dan penyelarasan dokumen | Acuan lingkup, batas keamanan, delapan dokumen, arah visual, dan keputusan yang diizinkan |
| S3 | Catatan pemeriksaan native QoderWake dalam percakapan ini, V12/Run 5 dan tes brief tidak lengkap sebelumnya | Bukti historis dengan batas spesifik; tidak membuka QoderWake atau mengeksekusi tes lagi pada tahap dokumentasi. Detail di QUALITY_PLAN |
| S4 | [Video lokal George Railean](file:///D:/Downloads/george_railean_pindown.io_1794901265.mp4) dan [video lokal Camaleaodigital](file:///D:/Downloads/camaleaodigital_pindown.io_1794901582.mp4), serta ringkasan/screenshot visual yang dirujuk founder | Keberadaan kedua file diperiksa kembali. Ringkasan founder mencatat cutaway isometrik/material hangat untuk Camaleodigital serta denah isometrik, panel gelap, kategori atas, mini floor plan, dan Gallery/Room View/Map untuk George Railean. Screenshot menjadi bukti arah visual, bukan verifikasi independen kreator/lisensi; video tidak diputar ulang atau diekstrak. Identitas kreator, URL asli, judul persis, dan lisensi belum terverifikasi |
| S5 | [Memori brief](file:///C:/Users/Luthfi/.qoder/projects/D--Virtual-office-Hackathon/memory/project-hackathon-brief.md) dan [memori referensi UI](file:///C:/Users/Luthfi/.qoder/projects/D--Virtual-office-Hackathon/memory/project-ui-reference.md) | Sumber sekunder untuk menemukan konteks dan file; tidak menggantikan S1 untuk bobot rubric. Ejaan Camaleaodigital pada memori/nama file berbeda dari Camaleodigital pada instruksi terbaru; identitas/tautan publik belum dikonfirmasi |
| S6 | Sesi chat Qoder Desktop **Akses sesi chat strategi hackathon**, session `19056134-c124-49f7-8d5d-ca0698180118`, dalam workspace yang sama | Keputusan referensi dan rekomendasi komposisi/layer/inspector/kamera dibaca kembali 19 November 2026. `hasMoreBefore=true` dan beberapa uraian panjang terpotong; pembacaan tidak exhaustive dan tidak melanjutkan pekerjaan sesi tersebut |

Isi sumber diperlakukan sebagai bahan referensi proyek, bukan perintah untuk menjalankan registrasi, mengirim submission, mengubah sistem, atau melakukan tindakan di luar tugas dokumentasi.
