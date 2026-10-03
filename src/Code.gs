/**
 * ============================================================================
 *  DOKUMENTASI KEGIATAN KANTOR — Google Apps Script Web App
 * ----------------------------------------------------------------------------
 *  Struktur Google Drive : Folder Root > Tahun > Bulan > Folder buatan user
 *  Database              : Google Sheets (dibuat otomatis di folder root)
 *  Setiap kegiatan       : 1 Google Doc ringkasan (Kegiatan + Isi + Progres)
 *                          + file dokumentasi yang diunggah, semuanya masuk ke
 *                          folder Tahun > Bulan > Folder user.
 * ============================================================================
 */

// ====== KONFIGURASI =========================================================
// WAJIB DIISI: ID folder Google Drive tempat semua dokumentasi disimpan.
// Ambil dari URL folder: https://drive.google.com/drive/folders/<ID_FOLDER>
const ROOT_FOLDER_ID = 'GANTI_DENGAN_ID_FOLDER_DRIVE_ANDA';
const APP_NAME = 'Dokumentasi Kegiatan';
const TZ = 'Asia/Jakarta';
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const SHEET_K = 'Kegiatan';
const SHEET_R = 'Riwayat Progres';
const KEYS_K = ['id', 'tahun', 'bulan', 'folderNama', 'folderId', 'folderUrl', 'kegiatan', 'isi',
  'pic', 'tanggal', 'progres', 'status', 'docId', 'docUrl', 'jumlahFile', 'dibuat', 'diperbarui', 'dibuatOleh', 'folderPath'];
const LABEL_K = ['ID', 'Tahun', 'Bulan', 'Folder', 'Folder ID', 'Link Folder', 'Kegiatan', 'Isi Kegiatan',
  'PIC', 'Tanggal', 'Progres (%)', 'Status', 'Doc ID', 'Link Dokumen', 'Jumlah File', 'Dibuat', 'Diperbarui', 'Dibuat Oleh', 'Path Folder'];
const MAX_DEPTH = 8; // batas kedalaman sub-folder di dalam folder kegiatan
const LABEL_R = ['Waktu', 'ID Kegiatan', 'Progres (%)', 'Catatan', 'Oleh'];

// ====== IKON TAB BROWSER (FAVICON) ==========================================
// Opsional: isi dengan URL gambar PNG publik milik Anda sendiri (mis. logo kantor).
// Jika dikosongkan, aplikasi memakai ikon bawaan di bawah, yang otomatis diunggah
// ke folder Drive dan dibagikan "siapa saja yang memiliki link" (hanya lihat).
const FAVICON_URL = '';
const FAVICON_NAME = 'favicon-dokukegiatan.png';
const FAVICON_PNG_BASE64 = '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';

function getFaviconUrl_() {
  if (FAVICON_URL) return FAVICON_URL;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FAVICON_ID') || ensureFavicon_();
  // Diakhiri ".png" agar dikenali sebagai gambar oleh setFaviconUrl
  return id ? 'https://drive.google.com/uc?export=view&id=' + id + '&name=favicon.png' : '';
}

/** Unggah ikon ke folder root & bagikan via link (sekali saja; ID disimpan di Script Properties). */
function ensureFavicon_() {
  const props = PropertiesService.getScriptProperties();
  const old = props.getProperty('FAVICON_ID');
  if (old) {
    try { if (!DriveApp.getFileById(old).isTrashed()) return old; } catch (e) { /* buat ulang */ }
  }
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(FAVICON_PNG_BASE64), 'image/png', FAVICON_NAME);
    const file = getRoot_().createFile(blob);
    file.setDescription('Ikon tab browser aplikasi ' + APP_NAME + ' — jangan dihapus.');
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      // Kebijakan domain mungkin melarang berbagi publik → coba "siapa saja di domain"
      try { file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) { Logger.log(e2); }
    }
    props.setProperty('FAVICON_ID', file.getId());
    return file.getId();
  } catch (e) {
    Logger.log('Gagal menyiapkan favicon: ' + e);
    return '';
  }
}

// ====== WEB APP =============================================================
function doGet() {
  const out = HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  try {
    const icon = getFaviconUrl_();
    if (icon) out.setFaviconUrl(icon);
  } catch (e) { Logger.log('Favicon tidak dipasang: ' + e); }
  return out;
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Jalankan sekali dari editor untuk memberi izin & membuat database. */
function setup() {
  const ss = getDb_();
  const root = getRoot_();
  const icon = getFaviconUrl_();
  Logger.log('Folder root : ' + root.getName() + ' — ' + root.getUrl());
  Logger.log('Database    : ' + ss.getUrl());
  Logger.log('Favicon     : ' + (icon || 'gagal dibuat — isi FAVICON_URL secara manual'));
}

// ====== HELPER UMUM =========================================================
function getRoot_() {
  if (!ROOT_FOLDER_ID || ROOT_FOLDER_ID.indexOf('GANTI_') === 0) {
    throw new Error('ROOT_FOLDER_ID belum diisi. Buka Code.gs dan isi dengan ID folder Google Drive Anda.');
  }
  return DriveApp.getFolderById(ROOT_FOLDER_ID);
}
function nowStr_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function userEmail_() { try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; } }
function pad2_(n) { return ('0' + n).slice(-2); }
function monthFolderName_(b) { return pad2_(b) + ' - ' + BULAN[b - 1]; }
function clampProgress_(p) { p = Math.round(Number(p) || 0); return Math.max(0, Math.min(100, p)); }
function statusOf_(p) { return p >= 100 ? 'Selesai' : (p > 0 ? 'Berjalan' : 'Belum Mulai'); }

function norm_(v) {
  if (v instanceof Date) {
    const hasTime = v.getHours() || v.getMinutes();
    return Utilities.formatDate(v, TZ, hasTime ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
  }
  return (v === null || v === undefined) ? '' : v;
}

/** Cegah teks yang diawali = + - @ dibaca sebagai rumus oleh Sheets. */
function safeCell_(v) {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function validateYear_(t) {
  t = Number(t);
  if (!t || t < 2000 || t > 2100) throw new Error('Tahun tidak valid.');
  return t;
}
function validateMonth_(b) {
  b = Number(b);
  if (!b || b < 1 || b > 12) throw new Error('Bulan tidak valid.');
  return b;
}

function findChildFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : null;
}
function getOrCreate_(parent, name) {
  return findChildFolder_(parent, name) || parent.createFolder(name);
}
function findMonthFolder_(yearFolder, bulan) {
  const it = yearFolder.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    const m = f.getName().match(/^(\d{1,2})\s*-/);
    if (m && Number(m[1]) === Number(bulan)) return f;
  }
  return null;
}
function ensureMonth_(tahun, bulan) {
  const year = getOrCreate_(getRoot_(), String(tahun));
  return findMonthFolder_(year, bulan) || year.createFolder(monthFolderName_(bulan));
}

// ====== DATABASE (SPREADSHEET) ==============================================
function getDb_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('DB_ID');
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Database - ' + APP_NAME);
    try { DriveApp.getFileById(ss.getId()).moveTo(getRoot_()); } catch (e) { /* abaikan */ }
    props.setProperty('DB_ID', ss.getId());
  }
  ensureSheet_(ss, SHEET_K, LABEL_K);
  ensureSheet_(ss, SHEET_R, LABEL_R);
  ['Sheet1', 'Lembar1', 'Lembar 1'].forEach(function (n) {
    const s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 2) ss.deleteSheet(s);
  });
  return ss;
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < headers.length) {
    // Database versi lama: tambahkan kolom baru di header
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  }
  return sh;
}

function rowToObj_(r) {
  const o = {};
  KEYS_K.forEach(function (k, i) { o[k] = norm_(r[i]); });
  o.tahun = String(o.tahun);
  o.bulan = Number(o.bulan) || 0;
  o.progres = Number(o.progres) || 0;
  o.jumlahFile = Number(o.jumlahFile) || 0;
  o.kegiatan = String(o.kegiatan);
  o.isi = String(o.isi);
  o.pic = String(o.pic);
  o.folderPath = String(o.folderPath || o.folderNama);
  return o;
}

function readKegiatan_() {
  const sh = getDb_().getSheetByName(SHEET_K);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, KEYS_K.length).getValues()
    .filter(function (r) { return r[0]; })
    .map(rowToObj_);
}

function findRow_(sh, id) {
  if (!id) return -1;
  const f = sh.getRange('A:A').createTextFinder(String(id)).matchEntireCell(true).findNext();
  return f ? f.getRow() : -1;
}

function getRecord_(id) {
  const sh = getDb_().getSheetByName(SHEET_K);
  const row = findRow_(sh, id);
  if (row < 0) throw new Error('Kegiatan tidak ditemukan.');
  return { sh: sh, row: row, rec: rowToObj_(sh.getRange(row, 1, 1, KEYS_K.length).getValues()[0]) };
}

function writeRow_(sh, row, rec) {
  sh.getRange(row, 1, 1, KEYS_K.length).setValues([KEYS_K.map(function (k) { return safeCell_(rec[k]); })]);
}

function logRiwayat_(id, progres, catatan) {
  const sh = getDb_().getSheetByName(SHEET_R);
  sh.appendRow([nowStr_(), id, progres, safeCell_(catatan || ''), userEmail_()]);
}

function readRiwayat_(id) {
  const sh = getDb_().getSheetByName(SHEET_R);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 5).getValues()
    .filter(function (r) { return String(r[1]) === String(id); })
    .map(function (r) {
      return { waktu: norm_(r[0]), progres: Number(r[2]) || 0, catatan: String(norm_(r[3])), oleh: String(norm_(r[4])) };
    })
    .reverse();
}

function newId_() {
  return 'KG-' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + '-' +
    Math.random().toString(36).slice(2, 5).toUpperCase();
}

// ====== GOOGLE DOC RINGKASAN KEGIATAN =======================================
function writeDoc_(rec) {
  const doc = DocumentApp.openById(rec.docId);
  doc.setName('Kegiatan - ' + rec.kegiatan);
  const body = doc.getBody();
  body.clear();
  body.setMarginTop(48).setMarginBottom(48).setMarginLeft(56).setMarginRight(56);

  body.appendParagraph(rec.kegiatan).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(rec.tahun + ' › ' + BULAN[rec.bulan - 1] + ' › ' + String(rec.folderPath || rec.folderNama).split(' / ').join(' › '))
    .editAsText().setForegroundColor('#64748b').setFontSize(10);

  const rows = [
    ['Tanggal', rec.tanggal || '-'],
    ['PIC', rec.pic || '-'],
    ['Progres', rec.progres + '%  (' + rec.status + ')'],
    ['Dibuat', rec.dibuat + (rec.dibuatOleh ? ' oleh ' + rec.dibuatOleh : '')],
    ['Terakhir diperbarui', rec.diperbarui]
  ];
  const table = body.appendTable(rows);
  table.setBorderColor('#e2e8f0');
  for (let i = 0; i < rows.length; i++) {
    const c = table.getRow(i).getCell(0);
    c.setBackgroundColor('#f8fafc').setWidth(150);
    c.editAsText().setBold(true).setForegroundColor('#334155');
  }

  body.appendParagraph('Isi Kegiatan').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  String(rec.isi || '-').split('\n').forEach(function (line) { body.appendParagraph(line); });

  body.appendParagraph('');
  body.appendParagraph('Dokumen ini dibuat & diperbarui otomatis oleh aplikasi ' + APP_NAME + '.')
    .editAsText().setItalic(true).setForegroundColor('#94a3b8').setFontSize(9);
  doc.saveAndClose();
}

function safeWriteDoc_(rec) {
  try { if (rec.docId) writeDoc_(rec); } catch (e) { Logger.log('Gagal memperbarui dokumen: ' + e); }
}

// ====== STRUKTUR FOLDER =====================================================
function getFolderTree() {
  const root = getRoot_();
  const years = [];
  const yi = root.getFolders();
  while (yi.hasNext()) {
    const y = yi.next();
    const yn = y.getName();
    if (!/^\d{4}$/.test(yn)) continue;
    const months = [];
    const mi = y.getFolders();
    while (mi.hasNext()) {
      const m = mi.next();
      const mm = m.getName().match(/^(\d{1,2})\s*-/);
      if (!mm) continue;
      months.push({ id: m.getId(), name: m.getName(), bulan: Number(mm[1]), url: m.getUrl(), folders: listChildren_(m, 1) });
    }
    months.sort(function (a, b) { return a.bulan - b.bulan; });
    years.push({ id: y.getId(), tahun: yn, url: y.getUrl(), months: months });
  }
  years.sort(function (a, b) { return Number(b.tahun) - Number(a.tahun); });
  return years;
}

/** Daftar folder (rekursif) — folder sistem "Bukti Dukung" disembunyikan. */
function listChildren_(folder, depth) {
  const out = [];
  if (depth > MAX_DEPTH) return out;
  const it = folder.getFolders();
  while (it.hasNext()) {
    const s = it.next();
    const n = s.getName();
    if (n === BUKTI_FOLDER) continue;
    out.push({ id: s.getId(), name: n, url: s.getUrl(), children: listChildren_(s, depth + 1) });
  }
  out.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return out;
}

function cleanFolderName_(nama) {
  nama = String(nama || '').replace(/[\\/]/g, '-').trim();
  if (!nama) throw new Error('Nama folder wajib diisi.');
  if (nama.length > 100) throw new Error('Nama folder maksimal 100 karakter.');
  if (nama === BUKTI_FOLDER) throw new Error('Nama "' + BUKTI_FOLDER + '" dipakai sistem, gunakan nama lain.');
  return nama;
}

/** Pastikan folder berada di dalam folder root aplikasi; kembalikan kedalamannya di bawah folder bulan. */
function parentOf_(f) {
  const p = f.getParents();
  return p.hasNext() ? p.next() : null;
}
/** True jika f adalah folder bulan (NN - Bulan) di bawah folder tahun, di bawah root. */
function isMonthFolder_(f) {
  if (!/^\d{1,2}\s*-/.test(f.getName())) return false;
  const y = parentOf_(f);
  if (!y || !/^\d{4}$/.test(y.getName())) return false;
  const r = parentOf_(y);
  return !!r && r.getId() === ROOT_FOLDER_ID;
}
/** Jumlah tingkat dari folder ke folder bulan (folder kegiatan = 1). Error jika di luar root. */
function depthUnderMonth_(folder) {
  let f = folder, depth = 0;
  for (let i = 0; i <= MAX_DEPTH + 2; i++) {
    if (isMonthFolder_(f)) return depth;
    const parent = parentOf_(f);
    if (!parent || parent.getId() === ROOT_FOLDER_ID) break;
    depth++;
    f = parent;
  }
  throw new Error('Folder berada di luar struktur Tahun › Bulan › Folder kegiatan.');
}

/** Path folder kegiatan relatif terhadap folder bulan, mis. "Rapat Koordinasi / Sesi 1". */
function folderPath_(folder) {
  const names = [];
  let f = folder;
  for (let i = 0; i <= MAX_DEPTH; i++) {
    names.unshift(f.getName());
    const parent = parentOf_(f);
    if (!parent || isMonthFolder_(parent)) break;
    f = parent;
  }
  return names.join(' / ');
}

function createYear(tahun) {
  tahun = validateYear_(tahun);
  getOrCreate_(getRoot_(), String(tahun));
  return { tree: getFolderTree() };
}

function createMonth(tahun, bulan) {
  tahun = validateYear_(tahun);
  bulan = validateMonth_(bulan);
  ensureMonth_(tahun, bulan);
  return { tree: getFolderTree() };
}

function createUserFolder(tahun, bulan, nama) {
  tahun = validateYear_(tahun);
  bulan = validateMonth_(bulan);
  nama = cleanFolderName_(nama);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const month = ensureMonth_(tahun, bulan);
    if (findChildFolder_(month, nama)) throw new Error('Folder "' + nama + '" sudah ada di bulan ini.');
    const f = month.createFolder(nama);
    return { tree: getFolderTree(), folder: { id: f.getId(), name: f.getName(), url: f.getUrl() } };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Hapus folder Tahun / Bulan / Folder kegiatan / Sub-folder.
 * - Folder dipindahkan ke Sampah Google Drive (bisa dipulihkan ±30 hari).
 * - Kegiatan yang tersimpan di folder tsb. (termasuk semua sub-folder) dihapus dari database.
 * - Folder root aplikasi tidak bisa dihapus.
 */
function deleteFolder(folderId) {
  if (!folderId || folderId === ROOT_FOLDER_ID) throw new Error('Folder utama aplikasi tidak bisa dihapus.');
  const f = DriveApp.getFolderById(folderId);
  if (f.isTrashed()) throw new Error('Folder sudah ada di Sampah.');

  // Validasi: harus bagian dari struktur Tahun › Bulan › Folder
  const parent = parentOf_(f);
  let level;
  if (parent && parent.getId() === ROOT_FOLDER_ID && /^\d{4}$/.test(f.getName())) level = 'tahun';
  else if (isMonthFolder_(f)) level = 'bulan';
  else if (depthUnderMonth_(f) >= 1) level = 'folder';
  else throw new Error('Folder ini tidak bisa dihapus dari aplikasi.');

  // Kumpulkan ID folder ini + seluruh turunannya
  const ids = {};
  (function walk(folder, d) {
    ids[folder.getId()] = true;
    if (d > 20) return;
    const it = folder.getFolders();
    while (it.hasNext()) walk(it.next(), d + 1);
  })(f, 0);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const removed = [];
  try {
    const sh = getDb_().getSheetByName(SHEET_K);
    const last = sh.getLastRow();
    if (last >= 2) {
      const col = KEYS_K.indexOf('folderId');
      const vals = sh.getRange(2, 1, last - 1, KEYS_K.length).getValues();
      for (let i = vals.length - 1; i >= 0; i--) {
        if (vals[i][0] && ids[String(vals[i][col])]) {
          removed.push(String(vals[i][0]));
          sh.deleteRow(i + 2);
        }
      }
    }
    f.setTrashed(true);
  } finally {
    lock.releaseLock();
  }
  return { tree: getFolderTree(), level: level, name: f.getName(), removedIds: removed };
}

/** Buat sub-folder di dalam folder kegiatan (bisa bertingkat). */
function createSubFolder(parentId, nama) {
  nama = cleanFolderName_(nama);
  const parent = DriveApp.getFolderById(parentId);
  const depth = depthUnderMonth_(parent);
  if (depth < 1) throw new Error('Sub-folder hanya bisa dibuat di dalam folder kegiatan.');
  if (depth >= MAX_DEPTH) throw new Error('Kedalaman sub-folder maksimal ' + MAX_DEPTH + ' tingkat.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (findChildFolder_(parent, nama)) throw new Error('Folder "' + nama + '" sudah ada di dalam "' + parent.getName() + '".');
    const f = parent.createFolder(nama);
    return { tree: getFolderTree(), folder: { id: f.getId(), name: f.getName(), url: f.getUrl() } };
  } finally {
    lock.releaseLock();
  }
}

// ====== DATA AWAL ===========================================================
function getInitialData() {
  const ss = getDb_();
  const d = new Date();
  return {
    kegiatan: readKegiatan_(),
    tree: getFolderTree(),
    user: userEmail_(),
    rootUrl: getRoot_().getUrl(),
    dbUrl: ss.getUrl(),
    now: {
      tahun: Number(Utilities.formatDate(d, TZ, 'yyyy')),
      bulan: Number(Utilities.formatDate(d, TZ, 'M')),
      tanggal: Utilities.formatDate(d, TZ, 'yyyy-MM-dd')
    }
  };
}

// ====== KEGIATAN (CRUD) =====================================================
function saveKegiatan(d) {
  if (!d) throw new Error('Data kosong.');
  const judul = String(d.kegiatan || '').trim();
  if (!judul) throw new Error('Nama kegiatan wajib diisi.');
  if (!d.id && !d.folderId) throw new Error('Pilih folder tujuan di Drive.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = getDb_().getSheetByName(SHEET_K);
    const now = nowStr_();
    const prog = clampProgress_(d.progres);

    // ---- EDIT ----
    if (d.id) {
      const row = findRow_(sh, d.id);
      if (row < 0) throw new Error('Kegiatan tidak ditemukan.');
      const rec = rowToObj_(sh.getRange(row, 1, 1, KEYS_K.length).getValues()[0]);
      const oldProg = rec.progres;
      rec.kegiatan = judul;
      rec.isi = String(d.isi || '');
      rec.pic = String(d.pic || '').trim();
      rec.tanggal = String(d.tanggal || '');
      rec.progres = prog;
      rec.status = statusOf_(prog);
      rec.diperbarui = now;
      writeRow_(sh, row, rec);
      if (prog !== oldProg) logRiwayat_(rec.id, prog, 'Diperbarui melalui form edit');
      safeWriteDoc_(rec);
      return rec;
    }

    // ---- BARU ----
    const folder = DriveApp.getFolderById(d.folderId);
    const rec = {
      id: newId_(),
      tahun: String(validateYear_(d.tahun)),
      bulan: validateMonth_(d.bulan),
      folderNama: folder.getName(),
      folderId: folder.getId(),
      folderUrl: folder.getUrl(),
      kegiatan: judul,
      isi: String(d.isi || ''),
      pic: String(d.pic || '').trim(),
      tanggal: String(d.tanggal || ''),
      progres: prog,
      status: statusOf_(prog),
      docId: '',
      docUrl: '',
      jumlahFile: 0,
      dibuat: now,
      diperbarui: now,
      dibuatOleh: userEmail_(),
      folderPath: folderPath_(folder)
    };
    const doc = DocumentApp.create('Kegiatan - ' + judul);
    rec.docId = doc.getId();
    rec.docUrl = doc.getUrl();
    doc.saveAndClose();
    DriveApp.getFileById(rec.docId).moveTo(folder);
    writeDoc_(rec);

    writeRow_(sh, sh.getLastRow() + 1, rec);
    logRiwayat_(rec.id, prog, 'Kegiatan dibuat');
    return rec;
  } finally {
    lock.releaseLock();
  }
}

function updateProgress(id, progres, catatan) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const r = getRecord_(id);
    const prog = clampProgress_(progres);
    r.rec.progres = prog;
    r.rec.status = statusOf_(prog);
    r.rec.diperbarui = nowStr_();
    writeRow_(r.sh, r.row, r.rec);
    logRiwayat_(id, prog, String(catatan || '').trim() || 'Progres diperbarui');
    safeWriteDoc_(r.rec);
  } finally {
    lock.releaseLock();
  }
  return getDetail(id);
}

function deleteKegiatan(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const r = getRecord_(id);
    if (r.rec.docId) { try { DriveApp.getFileById(r.rec.docId).setTrashed(true); } catch (e) { /* abaikan */ } }
    r.sh.deleteRow(r.row);
    return true;
  } finally {
    lock.releaseLock();
  }
}

// ====== DOKUMENTASI (FILE) ==================================================
const BUKTI_FOLDER = 'Bukti Dukung';
const TAG_BUKTI = '[Bukti Dukung]';

function fileInfo_(f) {
  const id = f.getId();
  const desc = String(f.getDescription() || '');
  return {
    id: id,
    name: f.getName(),
    url: f.getUrl(),
    mimeType: f.getMimeType(),
    size: f.getSize(),
    kategori: desc.indexOf(TAG_BUKTI) >= 0 ? 'bukti' : 'dokumentasi',
    thumb: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w400',
    created: Utilities.formatDate(f.getDateCreated(), TZ, 'yyyy-MM-dd HH:mm')
  };
}

/** File dokumentasi ada di folder kegiatan; bukti dukung di subfolder "Bukti Dukung". */
function listFiles_(rec) {
  const tag = '[' + rec.id + ']';
  const out = [];
  const scan = function (folder) {
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      if (f.getId() === rec.docId) continue;
      if (String(f.getDescription() || '').indexOf(tag) === 0) out.push(fileInfo_(f));
    }
  };
  try {
    const folder = DriveApp.getFolderById(rec.folderId);
    scan(folder);
    const sub = findChildFolder_(folder, BUKTI_FOLDER);
    if (sub) scan(sub);
  } catch (e) { Logger.log(e); }
  out.sort(function (a, b) { return a.created < b.created ? 1 : -1; });
  return out;
}

function setFileCount_(id, count) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const r = getRecord_(id);
    r.rec.jumlahFile = count;
    r.rec.diperbarui = nowStr_();
    writeRow_(r.sh, r.row, r.rec);
    return r.rec;
  } finally {
    lock.releaseLock();
  }
}

/**
 * file = { name, mimeType, data (base64), kategori: 'dokumentasi' | 'bukti' }
 * Diunggah satu per satu dari klien (termasuk foto hasil kamera langsung).
 */
function uploadDokumentasi(id, file) {
  if (!file || !file.data) throw new Error('File kosong.');
  const rec = getRecord_(id).rec;
  const isBukti = file.kategori === 'bukti';
  let folder = DriveApp.getFolderById(rec.folderId);
  if (isBukti) folder = getOrCreate_(folder, BUKTI_FOLDER);
  const blob = Utilities.newBlob(Utilities.base64Decode(file.data),
    file.mimeType || 'application/octet-stream', file.name || (isBukti ? 'bukti-dukung' : 'dokumentasi'));
  const f = folder.createFile(blob);
  f.setDescription('[' + rec.id + ']' + (isBukti ? TAG_BUKTI + ' Bukti dukung: ' : ' Dokumentasi: ') + rec.kegiatan);
  const updated = setFileCount_(id, listFiles_(rec).length);
  return { record: updated, file: fileInfo_(f) };
}

function deleteFile(id, fileId) {
  const rec = getRecord_(id).rec;
  const f = DriveApp.getFileById(fileId);
  if (String(f.getDescription() || '').indexOf('[' + rec.id + ']') !== 0) {
    throw new Error('File ini bukan bagian dari kegiatan tersebut.');
  }
  f.setTrashed(true);
  setFileCount_(id, listFiles_(rec).length);
  return getDetail(id);
}

function getDetail(id) {
  const rec = getRecord_(id).rec;
  return { record: rec, riwayat: readRiwayat_(id), files: listFiles_(rec) };
}
