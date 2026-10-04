/**
 * ============================================================================
 *  LAPORAN PDF KEGIATAN — foto tersimpan HANYA di dalam PDF
 * ----------------------------------------------------------------------------
 *  Setiap kegiatan punya 1 file "Laporan Kegiatan - <nama>.pdf" di foldernya.
 *  • Halaman teks (info, uraian, berkas, riwayat) dibuat dari HTML → PDF.
 *  • Foto dokumentasi & bukti dukung ditanam sebagai halaman LAMPIRAN dengan
 *    grid 2 foto per baris, memakai pdf-lib (JPEG ditanam apa adanya).
 *  • Foto TIDAK disimpan di Drive. Saat PDF diperbarui, foto diambil kembali
 *    dari PDF lama (byte-per-byte, tanpa penurunan kualitas) lalu disusun ulang.
 *  • Daftar foto disimpan di PDF itu sendiri (katalog "DokuFoto") + ringkasan
 *    di kolom database "fotoJson".
 *  ⚠ Jika file PDF laporan dihapus, foto di dalamnya ikut hilang.
 * ============================================================================
 */

// ====== KONFIGURASI =========================================================
// Cadangan saja — utamanya pdf-lib dibaca dari file PdfLib.gs di proyek.
const PDF_LIB_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js'
];
const FOTO_LAMA_MAX = 700 * 1024; // foto lama (versi sebelumnya) > ukuran ini dikecilkan dulu saat dipindah ke PDF
const HARI_ = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];

// ====== PEMUAT pdf-lib ======================================================
let PDFLib_ = null;
/**
 * pdf-lib diambil dari file PdfLib.gs di proyek (tanpa internet).
 * Hanya bila file itu tidak ada, dicoba unduh dari CDN (butuh izin UrlFetchApp).
 */
function pdfLib_() {
  if (PDFLib_) return PDFLib_;
  if (typeof PDFLib !== 'undefined' && PDFLib && PDFLib.PDFDocument) { PDFLib_ = PDFLib; return PDFLib_; }
  const errors = [];
  const cache = CacheService.getScriptCache();
  let code = null;
  try {
    const n = Number(cache.get('pdflib_n') || 0);
    if (n) {
      const parts = cache.getAll(Array.from({ length: n }, function (_, i) { return 'pdflib_' + i; }));
      const arr = [];
      for (let i = 0; i < n; i++) { if (!parts['pdflib_' + i]) { arr.length = 0; break; } arr.push(parts['pdflib_' + i]); }
      if (arr.length === n) code = arr.join('');
    }
  } catch (e) { code = null; }
  if (!code) {
    for (let i = 0; i < PDF_LIB_URLS.length && !code; i++) {
      try {
        const r = UrlFetchApp.fetch(PDF_LIB_URLS[i], { muteHttpExceptions: true });
        if (r.getResponseCode() === 200) code = r.getContentText();
        else errors.push('HTTP ' + r.getResponseCode());
      } catch (e) { errors.push(String(e.message || e)); Logger.log('pdf-lib ' + PDF_LIB_URLS[i] + ': ' + e); }
    }
    if (!code) {
      throw new Error('Library PDF (pdf-lib) tidak ditemukan. Tambahkan file skrip "PdfLib" (isi dari PdfLib.gs) ke proyek Apps Script. ' +
        (errors.length ? 'Detail unduhan CDN: ' + errors[0] : ''));
    }
    try {
      const chunks = {}, size = 90000, n = Math.ceil(code.length / size);
      for (let i = 0; i < n; i++) chunks['pdflib_' + i] = code.slice(i * size, (i + 1) * size);
      chunks.pdflib_n = String(n);
      cache.putAll(chunks, 21600);
    } catch (e) { /* cache opsional */ }
  }
  // Apps Script tidak punya setTimeout/self → sediakan versi sinkron
  const g = (function () { return this; })() || {};
  if (typeof g.setTimeout !== 'function') g.setTimeout = function (fn) { fn(); return 0; };
  if (typeof g.self === 'undefined') g.self = g;
  PDFLib_ = new Function(code + '\n;return PDFLib;').call(g);
  return PDFLib_;
}

/** Jalankan dari editor untuk memeriksa apakah pembuatan PDF siap dipakai. */
async function cekLaporanPdf() {
  const PL = pdfLib_();
  const doc = await PL.PDFDocument.create();
  doc.addPage([200, 200]).drawText('OK', { x: 80, y: 90, size: 24 });
  const b64 = await doc.saveAsBase64({ objectsPerTick: Infinity });
  Logger.log('✔ pdf-lib siap (' + (typeof PDFLib !== 'undefined' ? 'dari file PdfLib.gs' : 'dari CDN') + '), PDF uji ' + b64.length + ' karakter base64.');
}

// ====== API (dipanggil klien) ===============================================
/** Susun ulang laporan PDF (setelah simpan, ubah progres, unggah/hapus dokumen). */
async function buatLaporanPdf(id) {
  await buildPdf_(id, {});
  return getDetail(id);
}

/**
 * Tambah foto langsung ke laporan PDF — TANPA menyimpan file foto di Drive.
 * photos = [{ name, data (base64 JPEG), kategori: 'dokumentasi' | 'bukti' }]
 */
async function tambahFotoLaporan(id, photos) {
  if (!photos || !photos.length) throw new Error('Tidak ada foto.');
  const add = photos.map(function (p) {
    if (!p || !p.data) throw new Error('Foto kosong.');
    let b64 = String(p.data);
    if (b64.indexOf('/9j/') !== 0) { // bukan JPEG → konversi
      const blob = Utilities.newBlob(Utilities.base64Decode(b64), p.mimeType || 'image/png', 'x').getAs('image/jpeg');
      b64 = Utilities.base64Encode(blob.getBytes());
    }
    return {
      meta: { u: uid_(), n: String(p.name || 'foto.jpg').slice(0, 120), k: p.kategori === 'bukti' ? 'b' : 'd',
        t: nowStr_(), s: Math.round(b64.length * 3 / 4) },
      data: b64
    };
  });
  await buildPdf_(id, { add: add });
  return getDetail(id);
}

/** Hapus satu foto dari laporan PDF (berdasarkan uid). */
async function hapusFotoLaporan(id, uid) {
  await buildPdf_(id, { remove: String(uid) });
  return getDetail(id);
}

/** Jalankan dari editor: susun ulang PDF semua kegiatan. */
async function regenerateAllPdf() {
  const start = Date.now();
  const list = readKegiatan_();
  let done = 0;
  for (let i = 0; i < list.length; i++) {
    if (Date.now() - start > 5 * 60 * 1000) { Logger.log('Batas waktu — jalankan lagi untuk melanjutkan.'); break; }
    if (await safeBuildPdf_(list[i].id)) done++;
  }
  Logger.log(done + ' dari ' + list.length + ' laporan PDF disusun ulang.');
}

async function safeBuildPdf_(id, opts) {
  try { return await buildPdf_(id, opts || {}); } catch (e) { Logger.log('Gagal menyusun PDF ' + id + ': ' + e); return null; }
}

// ====== UTIL ================================================================
function uid_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function fotoMeta_(rec) { try { const a = JSON.parse(rec.fotoJson || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }

/**
 * Hapus file secara PERMANEN (tidak lewat Sampah). Hanya untuk PDF versi lama
 * yang sudah digantikan PDF baru (isi & fotonya sudah tersalin). Fallback: Sampah.
 */
function hapusPermanen_(fileId) {
  try {
    const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?supportsAllDrives=true', {
      method: 'delete', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
    });
    if (r.getResponseCode() === 204 || r.getResponseCode() === 404) return true;
    Logger.log('Hapus permanen gagal (' + r.getResponseCode() + '), dipindah ke Sampah: ' + fileId);
  } catch (e) { Logger.log(e); }
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* sudah tidak ada */ }
  return false;
}

/** Foto versi lama (file di Drive) → base64 JPEG, dikecilkan bila besar. */
function fotoLamaBase64_(f) {
  try {
    if (f.size > FOTO_LAMA_MAX) {
      const headers = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
      const meta = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + f.id + '?fields=thumbnailLink&supportsAllDrives=true',
        { headers: headers, muteHttpExceptions: true });
      const link = meta.getResponseCode() === 200 ? (JSON.parse(meta.getContentText()).thumbnailLink || '') : '';
      if (link) {
        const img = UrlFetchApp.fetch(link.replace(/=s\d+(-[a-z0-9-]+)?$/i, '') + '=s1280', { headers: headers, muteHttpExceptions: true });
        const ct = String(img.getHeaders()['Content-Type'] || img.getHeaders()['content-type'] || '');
        if (img.getResponseCode() === 200 && /^image\/jpe?g/.test(ct)) return Utilities.base64Encode(img.getContent());
      }
    }
    let blob = DriveApp.getFileById(f.id).getBlob();
    if (!/jpe?g/i.test(blob.getContentType())) blob = blob.getAs('image/jpeg');
    return Utilities.base64Encode(blob.getBytes());
  } catch (e) { Logger.log('foto lama ' + f.name + ': ' + e); return ''; }
}

// ====== PENYUSUNAN PDF ======================================================
async function buildPdf_(id, opts) {
  opts = opts || {};
  // pdf-lib dibutuhkan untuk foto & nomor halaman. Bila tidak tersedia dan
  // kegiatan tidak punya foto, laporan tetap dibuat (tanpa nomor halaman).
  let PL = null, plErr = null;
  try { PL = pdfLib_(); } catch (e) { plErr = e; Logger.log(e); }
  // Satu penyusunan dalam satu waktu → foto tidak tertimpa bila ada unggahan bersamaan
  const lock = LockService.getScriptLock();
  lock.waitLock(240000);
  try {
    const rec = getRecord_(id).rec;

    // 1) Foto yang sudah ada di PDF lama
    let photos = [];
    if (rec.docId) {
      let oldB64 = '';
      try {
        const of = DriveApp.getFileById(rec.docId);
        if (/pdf/i.test(of.getMimeType()) && !of.isTrashed()) oldB64 = Utilities.base64Encode(of.getBlob().getBytes());
      } catch (e) { /* PDF lama tidak ada */ }
      if (oldB64 && PL) photos = await extractPhotos_(PL, oldB64);
    }
    const expected = fotoMeta_(rec).length;
    if (expected > 0 && !PL) throw plErr;
    if (expected > 0 && photos.length === 0) {
      throw new Error('Foto pada laporan PDF sebelumnya tidak dapat dibaca (file PDF terhapus/terganti?). ' +
        'PDF tidak diperbarui agar foto tidak hilang. Pulihkan file PDF dari Sampah Drive bila perlu.');
    }

    // 2) Foto versi lama aplikasi (masih berupa file di Drive) → dipindah ke dalam PDF
    const files = listFiles_(rec);
    const legacy = files.filter(function (f) { return isImageMime_(f.mimeType); });
    const legacyOk = [];
    legacy.forEach(function (f) {
      const b64 = fotoLamaBase64_(f);
      if (!b64) return;
      legacyOk.push(f);
      photos.push({ meta: { u: uid_(), n: f.name, k: f.kategori === 'bukti' ? 'b' : 'd', t: f.created, s: Math.round(b64.length * 3 / 4) }, data: b64 });
    });

    // 3) Hapus / tambah
    if (opts.remove) {
      const before = photos.length;
      photos = photos.filter(function (p) { return p.meta.u !== opts.remove; });
      if (photos.length === before) throw new Error('Foto tidak ditemukan di laporan.');
    }
    (opts.add || []).forEach(function (p) { photos.push(p); });

    // 4) Halaman teks (HTML → PDF)
    const docs = files.filter(function (f) { return !isImageMime_(f.mimeType); }).reverse();
    const html = renderLaporanHtml_({
      rec: rec,
      isiHtml: sanitizeHtml_(toRichHtml_(rec.isi)),
      riwayat: readRiwayat_(id),
      berkas: docs.map(function (f) { return { name: f.name, size: f.size, created: f.created, url: f.url, kategori: f.kategori }; }),
      nFotoDok: photos.filter(function (p) { return p.meta.k !== 'b'; }).length,
      nFotoBukti: photos.filter(function (p) { return p.meta.k === 'b'; }).length,
      dicetak: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
      oleh: userEmail_(),
      appName: APP_NAME
    });
    const textB64 = Utilities.base64Encode(Utilities.newBlob(html, 'text/html', 'laporan.html').getAs('application/pdf').getBytes());

    // 5) Gabungkan teks + lampiran foto
    let outB64;
    if (PL) outB64 = await composePdf_(PL, textB64, photos, { judul: rec.kegiatan, id: rec.id, app: APP_NAME });
    else if (!photos.length) outB64 = textB64; // tanpa foto → cukup halaman teks
    else throw plErr;
    const name = 'Laporan Kegiatan - ' + rec.kegiatan.replace(/[\\/:*?"<>|]/g, '-') + '.pdf';
    const file = DriveApp.getFolderById(rec.folderId).createFile(Utilities.newBlob(Utilities.base64Decode(outB64), 'application/pdf', name));
    file.setDescription('Laporan PDF ' + rec.id + ' — berisi foto dokumentasi. Jangan dihapus. (' + APP_NAME + ')');

    // 6) Simpan referensi & ringkasan foto
    const r = getRecord_(id);
    const oldId = r.rec.docId;
    r.rec.docId = file.getId();
    r.rec.docUrl = file.getUrl();
    r.rec.fotoJson = JSON.stringify(photos.map(function (p) { return p.meta; }));
    r.rec.jumlahFile = photos.length + docs.length;
    r.rec.diperbarui = nowStr_();
    writeRow_(r.sh, r.row, r.rec);

    // 7) Bersihkan: PDF lama (sudah tersalin) dihapus permanen; foto versi lama → Sampah
    if (oldId && oldId !== file.getId()) hapusPermanen_(oldId);
    legacyOk.forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) { /* abaikan */ } });
    if (legacyOk.length) {
      try { const m = mediaFolder_(id, false); if (m && !m.getFiles().hasNext()) m.setTrashed(true); } catch (e) { /* abaikan */ }
    }
    return file.getId();
  } finally {
    lock.releaseLock();
  }
}

/** Ambil foto (JPEG mentah) + metadata dari PDF laporan sebelumnya. */
async function extractPhotos_(PL, b64) {
  const doc = await PL.PDFDocument.load(b64, { updateMetadata: false, ignoreEncryption: true });
  const arr = doc.catalog.lookupMaybe(PL.PDFName.of('DokuFoto'), PL.PDFArray);
  const m = doc.catalog.lookupMaybe(PL.PDFName.of('DokuFotoMeta'), PL.PDFHexString, PL.PDFString);
  if (!arr || !m) return [];
  const meta = JSON.parse(m.decodeText());
  const out = [];
  for (let i = 0; i < arr.size(); i++) {
    const s = arr.lookup(i);
    if (s && s.contents && meta[i]) out.push({ meta: meta[i], data: s.contents });
  }
  return out;
}

/** Hanya karakter yang didukung font standar PDF (WinAnsi). */
function winAnsi_(s) {
  return String(s == null ? '' : s).replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…›‹€]/g, '?');
}
function fitText_(font, text, size, maxW) {
  text = winAnsi_(text);
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  while (text.length > 1 && font.widthOfTextAtSize(text + '…', size) > maxW) text = text.slice(0, -1);
  return text + '…';
}

/** Gabungkan halaman teks + halaman lampiran foto (grid 2 kolom) + nomor halaman. */
async function composePdf_(PL, textB64, photos, info) {
  const doc = await PL.PDFDocument.load(textB64, { updateMetadata: false });
  const font = await doc.embedFont(PL.StandardFonts.Helvetica);
  const bold = await doc.embedFont(PL.StandardFonts.HelveticaBold);
  const size0 = doc.getPage(0).getSize();
  const W = size0.width, H = size0.height;
  const M = 42, GAP = 16, FOOT = 34;
  const cellW = (W - 2 * M - GAP) / 2, maxImgH = cellW * 0.86, CAP = 28;
  const navy = PL.rgb(0.118, 0.227, 0.541), gray = PL.rgb(0.39, 0.45, 0.55), line = PL.rgb(0.80, 0.84, 0.88), ink = PL.rgb(0.2, 0.25, 0.33);

  const refs = [], meta = [];
  const groups = [
    { k: 'd', title: 'Dokumentasi Kegiatan', label: 'Foto' },
    { k: 'b', title: 'Bukti Dukung', label: 'Bukti' }
  ];
  let letter = 0, page = null, y = 0;
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const list = photos.filter(function (p) { return (p.meta.k === 'b' ? 'b' : 'd') === g.k; });
    if (!list.length) continue;
    const L = String.fromCharCode(65 + letter++);
    const imgs = [];
    for (let i = 0; i < list.length; i++) {
      const img = await doc.embedJpg(list[i].data);
      refs.push(img.ref); meta.push(list[i].meta);
      imgs.push({ img: img, meta: list[i].meta, no: i + 1 });
    }

    const heading = function (cont) {
      page.drawText(winAnsi_('LAMPIRAN ' + L), { x: M, y: y - 8, size: 8, font: bold, color: PL.rgb(0.114, 0.306, 0.847) });
      page.drawText(winAnsi_(g.title + (cont ? ' (lanjutan)' : '')), { x: M, y: y - 24, size: 13, font: bold, color: navy });
      page.drawLine({ start: { x: M, y: y - 32 }, end: { x: W - M, y: y - 32 }, thickness: 1, color: line });
      y -= 46;
    };
    const newPage = function (cont) { page = doc.addPage([W, H]); y = H - M; heading(cont); };
    // Lampiran berikutnya melanjutkan di halaman yang sama bila masih cukup ruang
    if (page && y - 46 - (maxImgH * 0.8 + CAP) > M + FOOT) { y -= 14; heading(false); } else newPage(false);

    for (let i = 0; i < imgs.length; i += 2) {
      const row = imgs.slice(i, i + 2).map(function (it) {
        const s = Math.min(cellW / it.img.width, maxImgH / it.img.height);
        return { it: it, w: it.img.width * s, h: it.img.height * s };
      });
      const rowH = Math.max.apply(null, row.map(function (c) { return c.h; })) + CAP + 12;
      if (y - rowH < M + FOOT - 20) newPage(true);
      row.forEach(function (c, j) {
        const cx = M + j * (cellW + GAP);
        const ix = cx + (cellW - c.w) / 2, iy = y - c.h;
        page.drawRectangle({ x: ix - 0.5, y: iy - 0.5, width: c.w + 1, height: c.h + 1, borderColor: line, borderWidth: 0.6 });
        page.drawImage(c.it.img, { x: ix, y: iy, width: c.w, height: c.h });
        const lbl = g.label + ' ' + c.it.no;
        const lw = bold.widthOfTextAtSize(lbl, 8);
        page.drawText(lbl, { x: cx, y: iy - 12, size: 8, font: bold, color: ink });
        page.drawText(fitText_(font, ' · ' + c.it.meta.n, 8, cellW - lw), { x: cx + lw, y: iy - 12, size: 8, font: font, color: ink });
        page.drawText(fitText_(font, tanggalIndo_(c.it.meta.t), 7.5, cellW), { x: cx, y: iy - 22, size: 7.5, font: font, color: gray });
      });
      y -= rowH;
    }
  }

  // Simpan daftar foto di dalam PDF (agar bisa diambil kembali saat PDF diperbarui)
  doc.catalog.set(PL.PDFName.of('DokuFoto'), doc.context.obj(refs));
  doc.catalog.set(PL.PDFName.of('DokuFotoMeta'), PL.PDFHexString.fromText(JSON.stringify(meta)));

  // Nomor halaman di setiap halaman
  const pages = doc.getPages(), N = pages.length;
  const judul = 'Laporan Kegiatan · ' + info.judul;
  pages.forEach(function (p, i) {
    const pw = p.getWidth();
    const right = 'Halaman ' + (i + 1) + ' dari ' + N;
    const rw = font.widthOfTextAtSize(right, 7.5);
    p.drawText(fitText_(font, judul, 7.5, pw - 2 * M - rw - 20), { x: M, y: 18, size: 7.5, font: font, color: gray });
    p.drawText(right, { x: pw - M - rw, y: 18, size: 7.5, font: font, color: gray });
  });

  doc.setTitle(winAnsi_('Laporan Kegiatan - ' + info.judul));
  doc.setSubject(winAnsi_('ID ' + info.id));
  doc.setProducer(winAnsi_(info.app));
  doc.setCreator(winAnsi_(info.app));
  return await doc.saveAsBase64({ objectsPerTick: Infinity });
}

// ====== RICH TEXT (WYSIWYG) =================================================
const RICH_TAGS_ = { p: 1, br: 1, b: 1, strong: 1, i: 1, em: 1, u: 1, s: 1, strike: 1, ul: 1, ol: 1, li: 1,
  h2: 1, h3: 1, h4: 1, blockquote: 1, a: 1, div: 1, span: 1, hr: 1, sub: 1, sup: 1 };

/** Isi lama berupa teks biasa → paragraf HTML. */
function toRichHtml_(s) {
  s = String(s || '');
  if (/<\/?(p|br|b|strong|i|em|u|s|ul|ol|li|h[2-4]|blockquote|div)\b/i.test(s)) return s;
  return s.split(/\n{2,}/).map(function (p) {
    return '<p>' + escH_(p).replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

/** Whitelist tag & atribut agar isi kegiatan aman ditampilkan & dicetak. */
function sanitizeHtml_(html) {
  html = String(html || '')
    .replace(/<(script|style|iframe|object|embed|svg|math|template|noscript|head|title|textarea|select)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const MAP = { h1: 'h2', h5: 'h4', h6: 'h4', strike: 's', pre: 'p' };
  return html.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, function (m, tag, attrs) {
    tag = tag.toLowerCase();
    tag = MAP[tag] || tag;
    if (!RICH_TAGS_[tag]) return '';
    if (m.charAt(1) === '/') return (tag === 'br' || tag === 'hr') ? '' : '</' + tag + '>';
    let out = '<' + tag;
    if (tag === 'a') {
      const h = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
      const url = h ? (h[2] || h[3] || '') : '';
      if (/^(https?:|mailto:)/i.test(url)) out += ' href="' + url.replace(/"/g, '&quot;') + '"';
    }
    const al = attrs.match(/text-align\s*:\s*(left|center|right|justify)/i);
    if (al && /^(p|h2|h3|h4|div|li|blockquote)$/.test(tag)) out += ' style="text-align:' + al[1].toLowerCase() + '"';
    return out + '>';
  });
}

function htmlToText_(html) {
  return String(html || '').replace(/<(br|\/p|\/li|\/h[2-4]|\/div|\/blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
}

// ====== TEMPLATE HTML (HALAMAN TEKS) ========================================
function escH_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tanggalIndo_(s, withDay) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?/);
  if (!m) return s || '-';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return (withDay ? HARI_[d.getDay()] + ', ' : '') + Number(m[3]) + ' ' + BULAN[Number(m[2]) - 1] + ' ' + m[1] +
    (m[4] ? ' pukul ' + m[4] + ' WIB' : '');
}

function fmtBytes_(b) {
  if (!b) return '-';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return (i ? b.toFixed(1) : b) + ' ' + u[i];
}

/** Fungsi murni — HTML halaman teks laporan (foto ditambahkan terpisah sebagai lampiran). */
function renderLaporanHtml_(c) {
  const r = c.rec;
  const prog = Math.max(0, Math.min(100, Number(r.progres) || 0));
  const status = prog >= 100 ? 'Selesai' : (prog > 0 ? 'Berjalan' : 'Belum Mulai');
  const stColor = prog >= 100 ? '#047857' : (prog > 0 ? '#1d4ed8' : '#475569');
  const stBg = prog >= 100 ? '#d1fae5' : (prog > 0 ? '#dbeafe' : '#e2e8f0');
  const barColor = prog >= 100 ? '#10b981' : '#2563eb';
  const path = [r.tahun, BULAN[r.bulan - 1]].concat(String(r.folderPath || r.folderNama || '').split(' / ')).join(' › ');
  const nDok = c.nFotoDok || 0, nBuk = c.nFotoBukti || 0;

  const bar = '<table cellspacing="0" cellpadding="0" style="width:220px;border-collapse:collapse;display:inline-table;vertical-align:middle"><tr>' +
    (prog > 0 ? '<td style="width:' + prog + '%;height:9px;background:' + barColor + ';font-size:1px">&nbsp;</td>' : '') +
    (prog < 100 ? '<td style="width:' + (100 - prog) + '%;height:9px;background:#e5e7eb;font-size:1px">&nbsp;</td>' : '') +
    '</tr></table>';

  let n = 0;
  const sec = function (title) { n++; return '<h2 class="sec"><span class="num">' + n + '</span>' + escH_(title) + '</h2>'; };

  const lamp = [];
  if (nDok) lamp.push(nDok + ' foto dokumentasi');
  if (nBuk) lamp.push(nBuk + ' foto bukti dukung');

  const info = [
    ['Nama Kegiatan', '<b>' + escH_(r.kegiatan) + '</b>'],
    ['Tanggal Pelaksanaan', escH_(tanggalIndo_(r.tanggal, true))],
    ['Penanggung Jawab (PIC)', escH_(r.pic || '-')],
    ['Lokasi Arsip', escH_(path)],
    ['Status', '<span class="badge" style="color:' + stColor + ';background:' + stBg + '">' + status + '</span>'],
    ['Progres', bar + '&nbsp;&nbsp;<b>' + prog + '%</b>'],
    ['Lampiran Foto', lamp.length ? escH_(lamp.join(', ')) + ' <span class="muted">(lihat Lampiran di akhir laporan)</span>' : '-'],
    ['Dibuat', escH_(tanggalIndo_(r.dibuat)) + (r.dibuatOleh ? ' oleh ' + escH_(r.dibuatOleh) : '')],
    ['Terakhir Diperbarui', escH_(tanggalIndo_(r.diperbarui))]
  ];

  let body = '';
  body += '<div class="eyebrow">LAPORAN KEGIATAN &nbsp;·&nbsp; No. ' + escH_(r.id) + '</div>' +
    '<div class="title">' + escH_(r.kegiatan) + '</div>' +
    '<div class="subtitle">' + escH_(tanggalIndo_(r.tanggal, true)) + (r.pic ? ' &nbsp;·&nbsp; PIC: ' + escH_(r.pic) : '') + '</div>' +
    '<div class="rule"></div>';

  body += sec('Informasi Kegiatan') + '<table class="info" cellspacing="0">' + info.map(function (row, i) {
    return '<tr' + (i % 2 ? ' class="alt"' : '') + '><td class="k">' + row[0] + '</td><td class="v">' + row[1] + '</td></tr>';
  }).join('') + '</table>';

  body += sec('Uraian Kegiatan') + '<div class="rich">' + (c.isiHtml && htmlToText_(c.isiHtml) ? c.isiHtml : '<p class="muted"><i>Belum ada uraian kegiatan.</i></p>') + '</div>';

  if (c.berkas && c.berkas.length) {
    body += sec('Berkas Lampiran') + '<table class="tbl" cellspacing="0"><tr><th width="28">No</th><th>Nama Berkas</th><th width="90">Jenis</th><th width="70">Ukuran</th><th width="150">Diunggah</th></tr>' +
      c.berkas.map(function (f, i) {
        return '<tr' + (i % 2 ? ' class="alt"' : '') + '><td align="center">' + (i + 1) + '</td><td><a href="' + escH_(f.url) + '">' + escH_(f.name) + '</a></td><td>' +
          (f.kategori === 'bukti' ? 'Bukti dukung' : 'Dokumentasi') + '</td><td>' + fmtBytes_(f.size) + '</td><td>' + escH_(tanggalIndo_(f.created)) + '</td></tr>';
      }).join('') + '</table>';
  }

  if (c.riwayat.length) {
    body += sec('Riwayat Progres') + '<table class="tbl" cellspacing="0"><tr><th width="175">Waktu</th><th width="58">Progres</th><th>Catatan</th><th width="140">Oleh</th></tr>' +
      c.riwayat.slice().reverse().map(function (h, i) {
        return '<tr' + (i % 2 ? ' class="alt"' : '') + '><td>' + escH_(tanggalIndo_(h.waktu)) + '</td><td align="center"><b>' + h.progres + '%</b></td><td>' + escH_(h.catatan || '-') + '</td><td>' + escH_(h.oleh || '-') + '</td></tr>';
      }).join('') + '</table>';
  }

  body += '<div class="foot">Dokumen ini dibuat otomatis oleh aplikasi ' + escH_(c.appName) + ' pada ' + escH_(tanggalIndo_(c.dicetak)) +
    (c.oleh ? ' oleh ' + escH_(c.oleh) : '') + '</div>';

  const css =
    '@page{size:A4;margin:16mm 15mm 18mm 15mm}' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#1f2937;line-height:1.5;margin:0}' +
    'table{border-collapse:collapse}' +
    '.eyebrow{font-size:8.5pt;font-weight:bold;color:#1d4ed8;letter-spacing:1.2px}' +
    '.title{font-size:19pt;font-weight:bold;color:#0f172a;margin:4px 0 3px;line-height:1.25}' +
    '.subtitle{font-size:10pt;color:#475569}' +
    '.rule{border-bottom:2px solid #1e3a8a;margin:12px 0 4px}' +
    'h2.sec{font-size:11.5pt;color:#1e3a8a;margin:20px 0 8px;padding-bottom:5px;border-bottom:1px solid #cbd5e1;page-break-after:avoid}' +
    'h2.sec .num{display:inline-block;background:#1e3a8a;color:#ffffff;font-size:9pt;width:18px;text-align:center;margin-right:8px}' +
    '.info{width:100%;border:1px solid #e2e8f0}.info td{padding:7px 10px;border-bottom:1px solid #e2e8f0;vertical-align:middle}' +
    '.info .k{width:32%;color:#475569;background:#f8fafc;font-weight:bold;font-size:9.5pt}.info tr.alt .v{background:#fcfdfe}' +
    '.badge{font-weight:bold;font-size:9pt;padding:2px 8px}' +
    '.rich{font-size:10.5pt;text-align:justify}.rich p{margin:0 0 8px}.rich h2{font-size:13pt;color:#0f172a;margin:12px 0 6px}' +
    '.rich h3{font-size:11.5pt;color:#0f172a;margin:10px 0 5px}.rich h4{font-size:10.5pt;margin:8px 0 4px}' +
    '.rich ul,.rich ol{margin:0 0 8px 0;padding-left:22px}.rich li{margin-bottom:3px}' +
    '.rich blockquote{margin:8px 0;padding:6px 12px;border-left:3px solid #93c5fd;background:#f1f5f9;color:#334155}' +
    '.rich a{color:#1d4ed8}.muted{color:#94a3b8}' +
    '.tbl{width:100%;font-size:9pt;border:1px solid #e2e8f0}.tbl th{background:#1e3a8a;color:#ffffff;text-align:left;padding:6px 8px;font-weight:bold}' +
    '.tbl td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}.tbl tr.alt td{background:#f8fafc}.tbl a{color:#1d4ed8;text-decoration:none}' +
    '.foot{margin-top:14px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:8pt;color:#94a3b8;text-align:center}';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + escH_('Laporan Kegiatan - ' + r.kegiatan) +
    '</title><style>' + css + '</style></head><body>' + body + '</body></html>';
}