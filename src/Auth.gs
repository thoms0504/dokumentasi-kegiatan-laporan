/**
 * ============================================================================
 *  AUTH.gs — Login dengan email + kode OTP yang dikirim ke email
 * ----------------------------------------------------------------------------
 *  • Hanya email di ALLOWED_EMAILS yang bisa meminta OTP & masuk.
 *  • Kode OTP 6 digit, berlaku OTP_TTL_MIN menit, maks. OTP_MAX_TRY percobaan,
 *    kirim ulang paling cepat tiap OTP_RESEND_SEC detik.
 *  • Setelah OTP benar, server membuat token sesi (disimpan sebagai hash di
 *    Script Properties). Token dikirim di setiap panggilan lewat rpc().
 *  • SEMUA fungsi data dipanggil lewat rpc() → tanpa sesi valid, tidak ada data
 *    yang bisa dibaca/diubah, walau seseorang mengetahui URL web app.
 *  • Hapus email dari ALLOWED_EMAILS = semua sesinya langsung tidak berlaku.
 * ============================================================================
 */

// ====== KONFIGURASI LOGIN ===================================================
const ALLOWED_EMAILS = ['sibueathomson@gmail.com']; // tambah email lain bila perlu
const OTP_TTL_MIN = 10;          // masa berlaku kode OTP (menit)
const OTP_RESEND_SEC = 60;       // jeda minimal kirim ulang (detik)
const OTP_MAX_TRY = 5;           // maks. salah ketik sebelum kode hangus
const SESSION_SHORT_HOURS = 12;  // sesi tanpa "Ingat saya"
const SESSION_LONG_DAYS = 30;    // sesi dengan "Ingat saya"

let CURRENT_USER_ = ''; // email pengguna yang sedang login (diisi oleh rpc)

// ====== UTIL ================================================================
function normEmail_(e) { return String(e || '').trim().toLowerCase(); }
function isAllowed_(e) { return ALLOWED_EMAILS.map(normEmail_).indexOf(normEmail_(e)) >= 0; }
function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function maskEmail_(e) {
  const p = String(e).split('@');
  if (p.length !== 2) return e;
  const n = p[0];
  return (n.length <= 2 ? n.charAt(0) + '*' : n.slice(0, 2) + '*'.repeat(Math.max(1, n.length - 3)) + n.slice(-1)) + '@' + p[1];
}
function authErr_(msg) { return new Error('AUTH: ' + msg); }

// ====== OTP =================================================================
/** Langkah 1: kirim kode OTP ke email (dipanggil langsung dari halaman login). */
function kirimOtp(email) {
  email = normEmail_(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Format email tidak valid.');
  if (!isAllowed_(email)) throw new Error('Email ini tidak terdaftar sebagai pengguna aplikasi.');

  const cache = CacheService.getScriptCache();
  const key = sha256_(email);
  const wait = Number(cache.get('otpw_' + key) || 0);
  if (wait > Date.now()) {
    throw new Error('Tunggu ' + Math.ceil((wait - Date.now()) / 1000) + ' detik sebelum meminta kode baru.');
  }

  const code = String(parseInt(sha256_(Utilities.getUuid() + Date.now() + Math.random()).slice(0, 12), 16) % 1000000);
  const otp = ('000000' + code).slice(-6);
  const salt = Utilities.getUuid();
  const exp = Date.now() + OTP_TTL_MIN * 60000;
  cache.put('otp_' + key, JSON.stringify({ h: sha256_(salt + otp), s: salt, n: 0, x: exp }), OTP_TTL_MIN * 60);
  cache.put('otpw_' + key, String(Date.now() + OTP_RESEND_SEC * 1000), OTP_RESEND_SEC);

  const waktu = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm') + ' WIB';
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:460px;margin:0 auto;padding:24px;color:#0f172a">' +
    '<div style="font-size:13px;font-weight:bold;color:#2563eb;letter-spacing:1px">' + APP_NAME.toUpperCase() + '</div>' +
    '<h2 style="margin:8px 0 6px;font-size:20px">Kode masuk Anda</h2>' +
    '<p style="color:#475569;font-size:14px;margin:0 0 18px">Gunakan kode berikut untuk masuk ke aplikasi. Kode berlaku ' + OTP_TTL_MIN + ' menit.</p>' +
    '<div style="font-size:34px;font-weight:bold;letter-spacing:10px;text-align:center;background:#eff4ff;color:#1d4ed8;border-radius:12px;padding:16px 0">' + otp + '</div>' +
    '<p style="color:#64748b;font-size:12px;margin:18px 0 0">Diminta pada ' + waktu + '. Jika Anda tidak meminta kode ini, abaikan email ini — jangan berikan kode kepada siapa pun.</p>' +
    '</div>';
  MailApp.sendEmail({
    to: email,
    subject: otp + ' adalah kode OTP ' + APP_NAME,
    body: 'Kode OTP ' + APP_NAME + ': ' + otp + '\nBerlaku ' + OTP_TTL_MIN + ' menit. Jangan berikan kode ini kepada siapa pun.',
    htmlBody: html,
    name: APP_NAME
  });
  return { email: maskEmail_(email), ttl: OTP_TTL_MIN, resend: OTP_RESEND_SEC };
}

/** Langkah 2: cocokkan OTP → buat token sesi. */
function verifikasiOtp(email, kode, ingat) {
  email = normEmail_(email);
  kode = String(kode || '').replace(/\D/g, '');
  if (!isAllowed_(email)) throw new Error('Email ini tidak terdaftar sebagai pengguna aplikasi.');
  if (kode.length !== 6) throw new Error('Kode OTP harus 6 digit.');

  const cache = CacheService.getScriptCache();
  const k = 'otp_' + sha256_(email);
  const raw = cache.get(k);
  if (!raw) throw new Error('Kode OTP sudah kedaluwarsa atau belum diminta. Silakan minta kode baru.');
  const o = JSON.parse(raw);
  if (sha256_(o.s + kode) !== o.h) {
    o.n++;
    const sisa = OTP_MAX_TRY - o.n;
    if (sisa <= 0) { cache.remove(k); throw new Error('Terlalu banyak percobaan salah. Silakan minta kode baru.'); }
    cache.put(k, JSON.stringify(o), Math.max(1, Math.floor((o.x - Date.now()) / 1000)));
    throw new Error('Kode OTP salah. Sisa percobaan: ' + sisa + '.');
  }
  cache.remove(k);

  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const exp = Date.now() + (ingat ? SESSION_LONG_DAYS * 86400000 : SESSION_SHORT_HOURS * 3600000);
  PropertiesService.getScriptProperties().setProperty('ses_' + sha256_(token), JSON.stringify({ e: email, x: exp }));
  bersihkanSesi_();
  return { token: token, email: email, exp: exp };
}

/** Keluar: token dihapus dari server. */
function keluar(token) {
  if (!token) return true;
  const k = 'ses_' + sha256_(token);
  PropertiesService.getScriptProperties().deleteProperty(k);
  CacheService.getScriptCache().remove(k);
  return true;
}

/** Validasi token sesi → email pengguna. Melempar "AUTH: …" bila tidak valid. */
function cekSesi_(token) {
  if (!token) throw authErr_('Silakan masuk terlebih dahulu.');
  const k = 'ses_' + sha256_(token);
  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();
  const raw = cache.get(k) || props.getProperty(k);
  if (!raw) throw authErr_('Sesi tidak ditemukan. Silakan masuk kembali.');
  const s = JSON.parse(raw);
  if (!s.x || s.x < Date.now() || !isAllowed_(s.e)) {
    props.deleteProperty(k); cache.remove(k);
    throw authErr_('Sesi Anda telah berakhir. Silakan masuk kembali.');
  }
  cache.put(k, raw, 600);
  return s.e;
}

/** Hapus sesi yang sudah kedaluwarsa (dipanggil saat login). */
function bersihkanSesi_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const all = props.getProperties(), now = Date.now();
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('ses_') !== 0) return;
      try { const s = JSON.parse(all[k]); if (!s.x || s.x < now || !isAllowed_(s.e)) props.deleteProperty(k); }
      catch (e) { props.deleteProperty(k); }
    });
  } catch (e) { Logger.log(e); }
}

/** Jalankan dari editor bila ingin mengeluarkan SEMUA perangkat yang sedang login. */
function keluarkanSemuaSesi() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(function (k) { if (k.indexOf('ses_') === 0) props.deleteProperty(k); });
  Logger.log('Semua sesi login telah dihapus.');
}

// ====== PINTU MASUK API (semua panggilan data dari klien) ===================
function apiMap_() {
  return {
    getInitialData: getInitialData_,
    createYear: createYear_,
    createMonth: createMonth_,
    createUserFolder: createUserFolder_,
    createSubFolder: createSubFolder_,
    deleteFolder: deleteFolder_,
    saveKegiatan: saveKegiatan_,
    updateProgress: updateProgress_,
    deleteKegiatan: deleteKegiatan_,
    uploadDokumentasi: uploadDokumentasi_,
    deleteFile: deleteFile_,
    getDetail: getDetail_,
    salinLaporan: salinLaporan_,
    pindahLaporan: pindahLaporan_,
    buatLaporanPdf: buatLaporanPdf_,
    tambahFotoLaporan: tambahFotoLaporan_,
    hapusFotoLaporan: hapusFotoLaporan_
  };
}

/** Semua fungsi data dipanggil klien lewat rpc(token, namaFungsi, [argumen]). */
function rpc(token, fn, args) {
  CURRENT_USER_ = cekSesi_(token);
  const map = apiMap_();
  if (!Object.prototype.hasOwnProperty.call(map, fn)) throw new Error('Fungsi tidak dikenal: ' + fn);
  return map[fn].apply(null, Array.isArray(args) ? args : []);
}
