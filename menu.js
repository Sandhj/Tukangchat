console.clear();

/* =========================
   CONFIG
========================= */
const BOT_NAME = "BOT WARMER";
const DEVELOPER = "@Mr.01y";

/* =========================
   COLOR
========================= */
const color = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    bold: "\x1b[1m",
    magenta: "\x1b[35m"
};

/* =========================
   IMPORT
========================= */
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise(resolve => rl.question(text, resolve));

/* =========================
   DISABLE LOG SAMPAH
========================= */
console.debug = console.info = console.warn = () => {};

/* =========================
   UTIL
========================= */
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const CONFIG = {
    minDelay: 5000,
    maxDelay: 12000,
    batchDelay: 60000,
    typingDelay: [2000, 5000],
    retry: 3,
    reconnectDelay: 8000,
    connectionCheckInterval: 3000
};

const SESSIONS_DIR = './sessions';
const HISTORY_FILE = './nomor_wa.txt';

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

/* =========================
   GLOBAL
========================= */
let activeSockets = new Map();
let successCount = 0, failCount = 0, totalSent = 0;

/* =========================
   UI HELPER
========================= */
function logHeader(title) {
    console.log(color.cyan + '\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║ ${title.padEnd(58)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n' + color.reset);
}

function deviceStatus(device) {
    return activeSockets.has(device) 
        ? color.green + "● ONLINE" + color.reset 
        : color.red + "○ OFFLINE" + color.reset;
}

function clearAndShowHeader(title = BOT_NAME) {
    console.clear();
    logHeader(title);
}

/* =========================
   RANDOM MESSAGE
========================= */
const MESSAGES = [
    "Halo kak 😊", "Hai kak 🙏", "Halo kak ✨", "Hai kak 😄", "Permisi kak 😊",
    "Halo kak, apa kabar hari ini? 😊", "Hai kak, semoga harinya lancar ya 🙏"
];

function randomMessage() { return MESSAGES[Math.floor(Math.random() * MESSAGES.length)]; }
function randomDelay(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/* =========================
   TARGET & UPDATE SYSTEM
========================= */
function loadTargets() {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    return fs.readFileSync(HISTORY_FILE, 'utf-8')
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean)
        .map(x => {
            if (x.includes('@s.whatsapp.net')) return x;
            let num = x.replace(/[^0-9]/g, '');
            if (num.startsWith('0')) num = '62' + num.slice(1);
            return num + '@s.whatsapp.net';
        });
}

async function updateSystem() {
    console.log(color.yellow + "\n🔄 Melakukan pembaruan sistem otomatis...\n" + color.reset);
    
    try {
        console.log(color.cyan + "Menghapus file lama..." + color.reset);
        execSync('rm -rf node_modules package-lock.json session package.json', { stdio: 'inherit' });

        console.log(color.cyan + "Inisialisasi package.json baru..." + color.reset);
        execSync('npm init -y', { stdio: 'inherit' });

        console.log(color.cyan + "Menginstall dependencies terbaru..." + color.reset);
        execSync('npm install @whiskeysockets/baileys pino', { stdio: 'inherit' });

        console.log(color.green + "\n✅ Pembaruan sistem berhasil!\n" + color.reset);
        await delay(2000);
        showMainMenu();

    } catch (err) {
        console.log(color.red + "\n❌ Gagal melakukan update sistem:\n" + err.message + color.reset);
        await delay(2000);
        showMainMenu();
    }
}

async function replaceTargets() {
    clearAndShowHeader("REPLACE TARGET");
    console.log(color.yellow + "Masukkan nomor baru (satu per baris). Ketik 'selesai' untuk selesai:\n" + color.reset);
    
    let numbers = [];
    
    async function ask() {
        const input = await question(color.cyan + "> " + color.reset);
        
        if (!input || input.toLowerCase() === 'selesai') {
            fs.writeFileSync(HISTORY_FILE, numbers.join('\n'));
            console.log(color.green + `\n✅ Berhasil menyimpan ${numbers.length} nomor target.\n` + color.reset);
            await updateSystem();
        } else {
            numbers.push(input.trim());
            ask();
        }
    }
    
    ask();
}

/* =========================
   DEVICE MANAGEMENT
========================= */
function getDevices() {
    return fs.readdirSync(SESSIONS_DIR).filter(f => 
        fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory()
    );
}

async function disconnectAllExcept(exceptDevice) {
    console.log(color.yellow + `🔌 Memutuskan koneksi semua device kecuali "${exceptDevice}"...\n` + color.reset);
    
    for (const [deviceName, sock] of activeSockets.entries()) {
        if (deviceName !== exceptDevice) {
            try {
                sock.end();           // Clean disconnect
                activeSockets.delete(deviceName);
                console.log(color.red + `   ❌ ${deviceName} telah didisconnect` + color.reset);
            } catch (e) {
                console.log(color.yellow + `   ⚠️ Gagal disconnect ${deviceName}` + color.reset);
            }
        }
    }
    await delay(1000);
}

async function createNewDevice() {
    clearAndShowHeader("TAMBAH DEVICE BARU");

    const name = await question(color.cyan + "Nama device (contoh: wa1): " + color.reset);
    if (!name || name.trim() === "") {
        return showMainMenu();
    }

    const sessionPath = path.join(SESSIONS_DIR, name);
    if (fs.existsSync(sessionPath)) {
        console.log(color.red + "❌ Device dengan nama itu sudah ada!" + color.reset);
        await delay(2000);
        return showMainMenu();
    }

    console.log(color.yellow + `\nMembuat device: ${name}...\n` + color.reset);

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),     // Paling stabil untuk pairing code
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
    });

    sock.ev.on('creds.update', saveCreds);

    // ====================== EVENT UTAMA ======================
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting') {
            console.log(color.yellow + "Menghubungkan ke WhatsApp..." + color.reset);
        }

        if (connection === 'open') {
            console.log(color.green + `\n✅ BERHASIL! Device "${name}" sudah terhubung.` + color.reset);
            console.log(color.green + `   Nomor: ${sock.user?.id.split(':')[0] || 'Tidak terbaca'}` + color.reset);
            activeSockets.set(name, sock);
            await delay(2000);
            showMainMenu();
            return;
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log(color.red + `\n❌ Device "${name}" logout dari WhatsApp.` + color.reset);
                activeSockets.delete(name);
            } else {
                console.log(color.yellow + `\n⚠️ Koneksi putus. Kode: ${reason || 'unknown'}` + color.reset);
            }
            showMainMenu();
        }
    });

    // ====================== PROSES PAIRING CODE ======================
    if (!sock.authState.creds.registered) {
        console.log(color.cyan + "\nMasukkan nomor WhatsApp yang akan dipakai sebagai device utama:" + color.reset);
        const phone = await question(color.cyan + "Nomor (628xxxxxxxxxx): " + color.reset);

        if (!phone || !/^\d{10,15}$/.test(phone)) {
            console.log(color.red + "❌ Nomor tidak valid! Gunakan format 628xxxxxxxxxx" + color.reset);
            await delay(2000);
            return showMainMenu();
        }

        try {
            console.log(color.yellow + "Meminta kode pairing..." + color.reset);
            await delay(2000);                    // Tunggu socket siap

            const code = await sock.requestPairingCode(phone);

            console.log('\n' + color.bold + color.green + `🔑 KODE PAIRING:  ${code}` + color.reset + '\n');
            console.log(color.white + "Cara menghubungkan:" + color.reset);
            console.log("   1. Buka WhatsApp di HP");
            console.log("   2. Pengaturan → Perangkat Tertaut → Hubungkan Perangkat");
            console.log("   3. Pilih 'Hubungkan dengan nomor telepon'");
            console.log("   4. Masukkan 8 digit kode di atas\n");

            // Deteksi otomatis apakah pairing berhasil
            let check = 0;
            const maxCheck = 40;   // maksimal \~2 menit

            const detector = setInterval(() => {
                check++;
                if (sock.user && sock.authState?.creds?.registered) {
                    clearInterval(detector);
                    console.log(color.green + `\n🎉 Pairing BERHASIL! Device "${name}" ONLINE.` + color.reset);
                    activeSockets.set(name, sock);
                    setTimeout(showMainMenu, 1500);
                } else if (check >= maxCheck) {
                    clearInterval(detector);
                    console.log(color.yellow + `\n⏰ Tidak terdeteksi koneksi. Silakan coba lagi jika belum masuk.` + color.reset);
                    showMainMenu();
                }
            }, 3000);

        } catch (err) {
            console.log(color.red + `\n❌ Gagal meminta kode pairing: ${err.message}` + color.reset);
            await delay(2000);
            showMainMenu();
        }
    } else {
        // Jika session sudah ada
        console.log(color.green + `✅ Device "${name}" sudah terdaftar, mencoba connect...` + color.reset);
        activeSockets.set(name, sock);
        setTimeout(showMainMenu, 1500);
    }
}

async function startDevice(deviceName) {
    const sessionPath = path.join(SESSIONS_DIR, deviceName);
    if (!fs.existsSync(sessionPath)) return;

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Chrome'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
            activeSockets.set(deviceName, sock);
        }
        if (update.connection === 'close') {
            activeSockets.delete(deviceName);
        }
    });

    return sock;
}

async function loadAllDevices() {
    const devices = getDevices();
    for (const dev of devices) {
        await startDevice(dev);
        await delay(600);
    }
}

/* =========================
   WARMING
========================= */
async function startWarming(deviceName) {
    const sock = activeSockets.get(deviceName);
    if (!sock) {
        console.log(color.red + `\n❌ Device ${deviceName} tidak online!\n` + color.reset);
        await delay(1500);
        return showMainMenu();
    }

    // === FITUR BARU: Disconnect device lain ===
    await disconnectAllExcept(deviceName);

    let targets = loadTargets();
    if (targets.length === 0) {
        console.log(color.red + "\n❌ nomor_wa.txt kosong!\n" + color.reset);
        await delay(1500);
        return showMainMenu();
    }

    targets = [...targets].sort(() => Math.random() - 0.5);

    clearAndShowHeader(`WARMING → \( {deviceName} ( \){targets.length} target)`);

    console.log(color.magenta + "╔════════════════════════════════════════════════════════════╗" + color.reset);
    console.log(color.magenta + "║                    SEDANG MELAKUKAN WARMING                ║" + color.reset);
    console.log(color.magenta + "╚════════════════════════════════════════════════════════════╝\n" + color.reset);

    for (let i = 0; i < targets.length; i++) {
        const jid = targets[i];
        const progress = Math.round(((i + 1) / targets.length) * 100);
        const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));

        console.log(color.white + `📍 Progress: \( {i + 1}/ \){targets.length} | ${bar} ${progress}%` + color.reset);
        console.log(color.cyan + `   Mengirim ke: ${jid.replace('@s.whatsapp.net', '')}` + color.reset);

        try {
            await sock.sendPresenceUpdate('composing', jid);
            await delay(randomDelay(...CONFIG.typingDelay));
            await sock.sendMessage(jid, { text: randomMessage() });
            console.log(color.green + `   ✅ Terkirim\n` + color.reset);
            successCount++; totalSent++;
        } catch (e) {
            console.log(color.red + `   ❌ Gagal\n` + color.reset);
            failCount++; totalSent++;
        }

        await delay(randomDelay(CONFIG.minDelay, CONFIG.maxDelay));
    }

    console.log(color.green + `\n🎉 Batch warming selesai untuk ${deviceName}!\n` + color.reset);
    console.log(color.yellow + "\n🔄 Refreshing semua device...\n" + color.reset);
    activeSockets.clear();
    await loadAllDevices();
    await delay(3000);
    showMainMenu();
}

/* =========================
   MAIN MENU
========================= */
async function showMainMenu() {
    clearAndShowHeader();

    const devices = getDevices();
    console.log(color.cyan + "📱 Device Terdaftar:" + color.reset);
    if (devices.length === 0) {
        console.log(color.yellow + "   Belum ada device.\n" + color.reset);
    } else {
        devices.forEach(d => console.log(`   • ${d} ${deviceStatus(d)}`));
    }

    console.log(color.cyan + `
════════════════════════════════════════════════════════════
1. Tambahkan Device Baru
2. List Device
3. Hapus Device
4. Status Device Terhubung
5. Mulai Warming (Pilih Device)
6. Replace Nomor Target
7. Reset Semua Sessions
8. Refresh All Devices

0. Keluar
` + color.reset);

    const choice = await question(color.bold + "Pilih menu → " + color.reset);

    switch (choice.trim()) {
        case '1': await createNewDevice(); break;
        case '2':
            clearAndShowHeader("LIST DEVICE");
            getDevices().forEach((d, i) => console.log(`   ${i+1}. ${d} ${deviceStatus(d)}`));
            await question("\nTekan Enter untuk kembali...");
            showMainMenu();
            break;
        case '3':
            clearAndShowHeader("HAPUS DEVICE");
            const delName = await question(color.cyan + "Nama device yang ingin dihapus: " + color.reset);
            const delPath = path.join(SESSIONS_DIR, delName);
            if (fs.existsSync(delPath)) {
                fs.rmSync(delPath, { recursive: true, force: true });
                activeSockets.delete(delName);
                console.log(color.green + `✅ ${delName} berhasil dihapus.` + color.reset);
            } else {
                console.log(color.red + "Device tidak ditemukan." + color.reset);
            }
            await delay(1500);
            showMainMenu();
            break;
        case '4':
            clearAndShowHeader("STATUS DEVICE");
            const connected = Array.from(activeSockets.keys());
            console.log(color.green + `Terhubung: ${connected.length} device\n` + color.reset);
            connected.forEach(d => console.log(`   ● ${d}`));
            await question("\nTekan Enter...");
            showMainMenu();
            break;
        case '5':
            clearAndShowHeader("PILIH DEVICE UNTUK WARMING");
            getDevices().forEach((d, i) => console.log(`   ${i+1}. ${d} ${deviceStatus(d)}`));
            const chosen = await question(color.cyan + "\nMasukkan nama device: " + color.reset);
            if (activeSockets.has(chosen)) {
                startWarming(chosen);
            } else {
                console.log(color.red + "\n❌ Device tidak online atau tidak ditemukan!" + color.reset);
                await delay(1500);
                showMainMenu();
            }
            break;
        case '6': await replaceTargets(); break;
        case '7':
            if ((await question(color.red + "Yakin reset SEMUA sessions? (y/n): " + color.reset)).toLowerCase() === 'y') {
                fs.rmSync(SESSIONS_DIR, { recursive: true, force: true });
                fs.mkdirSync(SESSIONS_DIR);
                activeSockets.clear();
                console.log(color.green + "Semua sessions telah direset." + color.reset);
            }
            await delay(1500);
            showMainMenu();
            break;
        case '8':
            console.log(color.yellow + "\n🔄 Refreshing semua device...\n" + color.reset);
            activeSockets.clear();
            await loadAllDevices();
            await delay(1200);
            showMainMenu();
            break;
        case '0':
            console.log(color.red + "\nBot dihentikan. Terima kasih!\n" + color.reset);
            process.exit(0);
        default:
            showMainMenu();
    }
}

/* =========================
   START
========================= */
(async () => {
    console.log(color.green + "🚀 Multi Session Bot Warming sedang dijalankan...\n" + color.reset);
    await loadAllDevices();
    setTimeout(showMainMenu, 1500);
})();
