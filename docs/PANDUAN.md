# Panduan Lengkap — DokuKegiatan (Google Apps Script)

## Isi paket
| File | Keterangan |
|---|---|
| `Code.gs` | Backend: folder Drive, database Sheets, Google Doc kegiatan, upload, progres |
| `Index.html` | Kerangka halaman (sidebar, dashboard, kegiatan, folder, form, detail) |
| `Style.html` | Tampilan (CSS) |
| `Script.html` | Logika antarmuka (JS) |
| `appsscript.json` | Manifest (zona waktu Asia/Jakarta, V8, pengaturan web app) |

## Langkah pemasangan
1. Buka **https://script.google.com** → **Proyek baru**. Beri nama, mis. *Dokumentasi Kegiatan*.
2. Ganti isi `Code.gs` dengan isi file `src/Code.gs`, lalu isi `ROOT_FOLDER_ID` dengan ID folder Drive Anda.
3. Klik **＋ → HTML**, buat 3 file bernama persis **Index**, **Style**, **Script** (tanpa `.html`), lalu tempel isinya masing-masing.
4. (Opsional) **Setelan proyek ⚙ → centang "Tampilkan file manifes appsscript.json"**, lalu ganti isinya dengan `appsscript.json`.
5. Pilih fungsi **`setup`** di toolbar → **Jalankan** → izinkan akses (Drive, Docs, Sheets).
   Ini membuat spreadsheet **"Database - Dokumentasi Kegiatan"** di folder Drive Anda.
6. **Terapkan → Deployment baru → Jenis: Aplikasi web**
   - *Jalankan sebagai*: **Saya** (semua file tersimpan di Drive Anda)
   - *Siapa yang memiliki akses*: **Siapa saja yang memiliki Akun Google** (atau hanya domain kantor jika memakai Google Workspace)
7. Salin **URL aplikasi web** dan bagikan ke tim.

> Isi `ROOT_FOLDER_ID` di baris atas `Code.gs` dengan ID folder Google Drive Anda (bagian setelah `/folders/` pada URL folder). Lakukan sebelum menjalankan `setup`.
> Setiap mengubah kode, lakukan **Terapkan → Kelola deployment → Edit → Versi baru** agar URL memakai kode terbaru.

## Struktur di Google Drive
```
📁 Folder root (link Anda)
 ├─ 📄 Database - Dokumentasi Kegiatan   (Sheets: Kegiatan & Riwayat Progres)
 └─ 📁 2026
     └─ 📁 10 - Oktober
         └─ 📁 Rapat Koordinasi           ← dibuat oleh user
             ├─ 📄 Kegiatan - Rapat Koordinasi Bulanan   (Google Doc: kegiatan + isi + progres)
             ├─ 🖼 foto-1.jpg                             (dokumentasi)
             └─ 📄 notulen.pdf
```

## Fitur
- **Folder Drive**: kelola Tahun → Bulan (12 bulan, klik untuk membuat) → Folder buatan user.
- **Kegiatan**: isi Nama, Tanggal, PIC, Isi Kegiatan, Progres; pilih folder tujuan (bisa buat folder baru langsung dari form); lampirkan dokumentasi sekaligus.
- **Detail kegiatan**: cincin progres 0–100% + slider & tombol cepat, catatan progres, riwayat progres (timeline), unggah/hapus dokumentasi dengan pratinjau gambar, tautan ke folder & Google Doc.
- **Status otomatis**: 0% = Belum Mulai, 1–99% = Berjalan, 100% = Selesai.
- **Dashboard**: KPI (total, selesai, berjalan, belum mulai, rata-rata progres), grafik kegiatan per bulan, komposisi status, progres per folder, kegiatan perlu perhatian, aktivitas terbaru — bisa difilter per tahun.

## Ikon tab browser (favicon)
Aplikasi memakai ikon sendiri (dokumen biru dengan centang hijau), bukan ikon Apps Script.
- Saat fungsi `setup` dijalankan (atau aplikasi pertama kali dibuka), ikon diunggah otomatis sebagai `favicon-dokukegiatan.png` ke folder root Drive dan dibagikan "siapa saja yang memiliki link — lihat". **Jangan hapus file ini.**
- Ingin memakai logo kantor sendiri? Unggah PNG (persegi, mis. 128×128), bagikan "siapa saja yang memiliki link", lalu isi `FAVICON_URL` di baris atas `Code.gs`, misalnya:
  `const FAVICON_URL = 'https://drive.google.com/uc?export=view&id=ID_FILE_ANDA&name=logo.png';`
- Jika akun Google Workspace kantor melarang berbagi file ke publik, ikon hanya tampil untuk pengguna di domain yang sama. Alternatifnya, isi `FAVICON_URL` dengan URL gambar dari website kantor.
- Browser sering menyimpan (cache) ikon lama. Jika ikon belum berubah, tutup tab lalu buka lagi, atau tekan Ctrl+F5.

## Sub-folder bertingkat
Setiap folder kegiatan bisa berisi sub-folder, dan sub-folder bisa berisi sub-folder lagi (maks. 8 tingkat). Contoh:
```
📁 2026 › 📁 10 - Oktober
 └─ 📁 Pelatihan K3
     ├─ 📁 Hari 1
     │   ├─ 📁 Sesi Pagi
     │   └─ 📁 Sesi Siang
     └─ 📁 Hari 2
```
- Di menu **Folder Drive**, klik kartu folder untuk **masuk ke dalamnya**. Tombol ← dan breadcrumb dipakai untuk kembali.
- Tombol **"+ Sub-folder"** ada di tiap kartu. Saat berada di dalam folder, tombol di pojok kanan atas berubah menjadi **"Sub-folder Baru"**.
- Kegiatan bisa disimpan di folder tingkat mana pun:
  - Di form, daftar folder ditampilkan menjorok sesuai tingkatnya.
  - Tombol **"+ Sub"** membuat sub-folder di dalam folder yang sedang dipilih.
- Statistik kartu folder (jumlah kegiatan & rata-rata progres), serta tombol **Lihat**, sudah **termasuk semua sub-foldernya**.
- Nama **"Bukti Dukung"** dicadangkan untuk folder sistem penyimpan bukti dukung.

## Membuat laporan dari HP
- Di HP/tablet, menu ada di **navigasi bawah**: Dashboard, Kegiatan, **＋ Lapor**, Folder, Lainnya.
- Tombol **＋ Lapor** membuka menu cepat:
  - **Foto & Buat Laporan**: kamera langsung terbuka. Setelah memotret, form laporan muncul dengan foto sudah terlampir.
  - **Laporan Kegiatan Baru**: membuka form kosong.
  - **Update progres**: daftar kegiatan yang belum selesai; ketuk salah satu untuk mengubah progres atau menambah foto/bukti dukung.
- Form dan panel detail tampil **layar penuh**, dengan tombol Simpan yang selalu terlihat di bawah.
- Aplikasi **mengingat folder & PIC laporan terakhir** (per perangkat). Laporan berikutnya di bulan yang sama langsung terisi folder & PIC-nya.
- Tips: di Chrome Android pilih menu ⋮ → **Tambahkan ke layar utama** agar aplikasi bisa dibuka seperti aplikasi biasa.

## Menghapus folder
Di menu **Folder Drive**, setiap level punya tombol hapus 🗑:
- **Tahun** dan **Bulan**: arahkan kursor ke item, tombol hapus muncul di kanan. Di HP tombolnya selalu tampil.
- **Folder kegiatan / sub-folder**: tombol 🗑 ada di kartu folder, dan juga di panel folder yang sedang dibuka.

Keamanan:
- Sebelum menghapus, aplikasi menampilkan dampaknya: berapa sub-folder dan kegiatan yang ikut terhapus.
- Jika folder masih berisi sub-folder/kegiatan, atau jika yang dihapus folder tahun/bulan, pengguna wajib **mengetik nama folder** sebelum tombol hapus aktif.
- Folder **dipindahkan ke Sampah Google Drive**, tidak dihapus permanen. Folder bisa dipulihkan dari Sampah ±30 hari.
- Kegiatan di dalam folder tersebut **dihapus dari database aplikasi**. Jika foldernya dipulihkan dari Sampah, file tetap ada, tetapi kegiatannya perlu dicatat ulang.
- Folder utama (root) dan folder di luar struktur aplikasi tidak bisa dihapus.

## Kamera langsung & Bukti Dukung
Di form kegiatan baru dan di panel detail tersedia 3 tombol:
- **📷 Ambil Foto**: membuka kamera langsung di aplikasi.
  - Tombol bulat untuk memotret; bisa memotret beberapa foto sekaligus.
  - Tombol ↻ untuk ganti kamera depan/belakang.
  - Foto otomatis diberi **cap waktu (hari, tanggal, jam WIB) + nama kegiatan** sebagai bukti keaslian. Cap ini bisa dimatikan.
  - Kalau browser memblokir kamera langsung, muncul tombol **"Buka Kamera Perangkat"**: kamera bawaan HP terbuka, dan cap waktu tetap ditambahkan.
- **🖼 Upload Dokumentasi**: foto/video dari galeri.
- **📎 Upload Bukti Dukung**: surat tugas, daftar hadir, notulen, undangan, scan, PDF, Word, Excel, dll.

File yang di-drag & drop dipilah otomatis: gambar/video menjadi dokumentasi, dokumen menjadi bukti dukung. Di form, kategori bisa diganti dengan mengklik label kategorinya.

Penyimpanan di Drive:
```
📁 Rapat Koordinasi
 ├─ 📄 Kegiatan - Rapat Koordinasi Bulanan
 ├─ 🖼 Foto_20261003_110712_1.jpg      ← dokumentasi (kamera / upload)
 └─ 📁 Bukti Dukung
     ├─ 📄 Daftar Hadir.pdf
     └─ 📄 Surat Tugas.docx
```

> Kamera langsung membutuhkan izin kamera dari browser dan koneksi HTTPS (URL web app Apps Script sudah HTTPS). Di HP, buka URL aplikasi di Chrome/Safari, lalu pilih **Izinkan** saat diminta.

## Catatan
- Batas unggah **25 MB per file** (batas Apps Script); file diunggah satu per satu.
- Menghapus kegiatan hanya memindahkan Google Doc ringkasan ke Sampah; file dokumentasi tetap aman di folder.
- Database bisa dibuka langsung dari menu **Database Sheets** di aplikasi (untuk ekspor/rekap).
