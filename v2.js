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
    maxDelay: 15000,
    batchDelay: 60000,
    typingDelay: [2000, 7000],
    retry: 3,
    reconnectDelay: 8000,
    connectionCheckInterval: 3000
};

/* =========================
   LOOPING CONFIG (Interaksi Antar Device)
========================= */
let isLooping = false;
let loopTimeout = null;

const LOOP_CONFIG = {
    defaultDurationMinutes: 30,
    minInterval: 6000,
    maxInterval: 22000
};

/* =========================
   GLOBAL
========================= */
let activeSockets = new Map();
let successCount = 0, failCount = 0, totalSent = 0;

const SESSIONS_DIR = './sessions';
const HISTORY_FILE = './nomor_wa.txt';

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

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
    "Halo bro/sis 😎",
    "Hai gais! Apa kabar nih? 🔥",
    "Eh lo lagi apa? Santuy aja kali 😌",
    "Lama ga chat, kangen jugaa 😂",
    "Halo! Gimana hari ini, slay atau chaos? ✨",
    "Pagi bro, udah bangun belum? 🌅",
    "Siang gais ☀️ Lagi makan apa nih?",
    "Malem-malem masih on? Cerita dong 🌙",
    "Woi, kabar lo gimana? No cap, aku penasaran 😂",
    "Lagi gabut nih, lo lagi apa? Spill yuk 📢",
    "Halo! Seneng banget lo chat lagi, vibesnya enak 🫶",
    "Anw, lo baik-baik aja kan? Semangat terus ya 💪",
    "Eh lama ga ketemu chat, lo masih hidup kan? 😆",
    "Hai! Hari ini mantul atau biasa aja? Ceritain",
    "Gimana kabarnya bro? Aku lagi santuy nih, lo?",
    "Wah akhirnya chat juga, kira lo ilang di grup aja 😂",
    "Lagi apa nih yang bikin lo kepikiran chat aku? 👀",
    "Kangen ngobrol receh sama lo tau 😭",
    "Halo gais! Semangat hari ini, jangan lupa hydrate 💧",
    "Siang! Lagi sibuk apa? Aku baru selesai gabut",
    "Malem, cerita dong hari ini ada yang epic ga? 🔥",
    "Bro, gue kangen chat sama lo, serius 😂",
    "Eh lo lagi mikirin gue juga ga? Telepati kali ini 😏",
    "Hari ini biasa aja sih, tapi chat lo bikin lebih asik 🫡",
    "Yaudah spill aja, lagi apa? Gue dengerin kok 😌",
    "Makasih ya udah chat, bikin mood naik nih ❤️",
    "Pagi! Sarapan apa hari ini? Aku lagi ngopi dulu ☕",
    "Lagi santai ga? Mau curhat atau ngobrol random? Yuk",
    "Woi kangen banget, kapan-kapan nongkrong yuk irl 😆",
    "Hari ini lumayan, lo gimana? Jangan lupa istirahat ya",
    "Eh, cerita dong yang seru hari ini, gue mau denger!",
    "Santuy aja bro, gue juga lagi chill nih 🛋️",
    "Halo! Lo baik kan? Kalau ga, cerita aja sama gue 😊",
    "Lama ga chat, gue kira lo sibuk jadi seleb 😂",
    "Gimana hari ini? Ada yang bikin lo ketawa ga?",
    "Aku lagi mikirin lo tadi, eh lo chat duluan. Keren!",
    "No cap, chat lo selalu bikin hari gue lebih baik 🫶",
    "Yuk cerita, lagi ada drama atau all good aja? 👀",
    "Halo gais! Semangat terus, jangan sampe burnout ya 🔥",
    "Eh lo lagi apa? Gue baru aja scroll TikTok sampe lupa waktu 😂"
];

function randomMessage() { 
    return MESSAGES[Math.floor(Math.random() * MESSAGES.length)]; 
}

function randomDelay(min, max) { 
    return Math.floor(Math.random() * (max - min + 1)) + min; 
}

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
                sock.end();
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
    if (!name) return showMainMenu();

    const sessionPath = path.join(SESSIONS_DIR, name);
    if (fs.existsSync(sessionPath)) {
        console.log(color.red + "❌ Device sudah ada!" + color.reset);
        await delay(1500);
        return showMainMenu();
    }

    console.log(color.yellow + `\nMembuat device: ${name}...\n` + color.reset);

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Chrome'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log(color.green + `\n✅ Device "${name}" BERHASIL TERHUBUNG!\n` + color.reset);
            activeSockets.set(name, sock);
            setTimeout(showMainMenu, 2000);
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) {
                console.log(color.yellow + `🔄 Reconnect ${name}...\n` + color.reset);
                setTimeout(() => startDevice(name), CONFIG.reconnectDelay);
            } else {
                activeSockets.delete(name);
            }
        }
    });

    if (!sock.authState.creds.registered) {
        const phone = await question(color.cyan + "Nomor WhatsApp (628xxx): " + color.reset);
        try {
            const code = await sock.requestPairingCode(phone);
            console.log(color.green + `\n🔑 Pairing Code: ${code}` + color.reset);
            console.log(color.yellow + "→ Buka WA → Linked Devices → Link a Device → Masukkan kode\n" + color.reset);
            console.log(color.cyan + "Menunggu koneksi... (10-30 detik)\n" + color.reset);

            let attempts = 0;
            const maxAttempts = 40;
            const checkInterval = setInterval(() => {
                attempts++;
                if (sock.user || (sock.authState?.creds?.registered && activeSockets.has(name))) {
                    clearInterval(checkInterval);
                    console.log(color.green + `\n✅ Device "${name}" terdeteksi ONLINE!\n` + color.reset);
                    activeSockets.set(name, sock);
                    setTimeout(showMainMenu, 1500);
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.log(color.yellow + "\n⚠️ Waktu tunggu habis.\n" + color.reset);
                    showMainMenu();
                }
            }, CONFIG.connectionCheckInterval);

        } catch (e) {
            console.log(color.red + "❌ Gagal mendapatkan pairing code." + color.reset);
            showMainMenu();
        }
    } else {
        activeSockets.set(name, sock);
        console.log(color.green + `✅ ${name} sudah terdaftar, mencoba koneksi...` + color.reset);
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
   FITUR BARU: INTERAKSI ANTAR DEVICE
========================= */
async function startDeviceInteractionLoop() {
    const onlineDevices = Array.from(activeSockets.keys());

    if (onlineDevices.length < 2) {
        console.log(color.red + "\n❌ Fitur ini memerlukan minimal 2 device yang ONLINE!\n" + color.reset);
        await delay(2000);
        return showMainMenu();
    }

    clearAndShowHeader("INTERAKSI ANTAR DEVICE - MODE MANUSIA");

    console.log(color.green + `✅ Mode Saling Chat Antar Device Aktif` + color.reset);
    console.log(color.cyan + `   Device Online : ${onlineDevices.length} buah\n` + color.reset);

    const durationMin = parseInt(await question(color.yellow + `Masukkan durasi looping (dalam menit): ` + color.reset)) || LOOP_CONFIG.defaultDurationMinutes;
    const endTime = Date.now() + (durationMin * 60 * 1000);

    console.log(color.magenta + `\n🚀 Looping interaksi dimulai! Akan berhenti pada: ${new Date(endTime).toLocaleTimeString()}\n` + color.reset);

    isLooping = true;
    let senderIndex = 0;

    const interactionInterval = setInterval(async () => {
        if (!isLooping || Date.now() >= endTime) {
            clearInterval(interactionInterval);
            stopDeviceInteraction();
            return;
        }

        const senderName = onlineDevices[senderIndex];
        const sock = activeSockets.get(senderName);

        let receiverIndex = senderIndex;
        while (receiverIndex === senderIndex) {
            receiverIndex = Math.floor(Math.random() * onlineDevices.length);
        }
        const receiverName = onlineDevices[receiverIndex];

        try {
            const senderJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const receiverJid = activeSockets.get(receiverName).user.id.split(':')[0] + '@s.whatsapp.net';

            const message = randomMessage();

            console.log(color.white + `[\( {senderName}] → [ \){receiverName}] : ${message}` + color.reset);

            await sock.sendPresenceUpdate('composing', receiverJid);
            await delay(randomDelay(...CONFIG.typingDelay));

            await sock.sendMessage(receiverJid, { text: message });

            console.log(color.green + `   ✅ Berhasil dari ${senderName} ke ${receiverName}\n` + color.reset);
            successCount++;
            totalSent++;

        } catch (e) {
            console.log(color.red + `   ❌ Gagal dari ${senderName} ke ${receiverName}\n` + color.reset);
            failCount++;
        }

        senderIndex = (senderIndex + 1) % onlineDevices.length;

    }, randomDelay(LOOP_CONFIG.minInterval, LOOP_CONFIG.maxInterval));

    loopTimeout = setTimeout(() => {
        if (isLooping) stopDeviceInteraction();
    }, durationMin * 60 * 1000);

    setInterval(() => {
        if (isLooping) {
            const remaining = Math.ceil((endTime - Date.now()) / 60000);
            console.log(color.yellow + `⏳ Sisa waktu: ${remaining} menit | Total pesan terkirim: ${totalSent}` + color.reset);
        }
    }, 20000);
}

function stopDeviceInteraction() {
    if (!isLooping) return;
    isLooping = false;
    if (loopTimeout) clearTimeout(loopTimeout);

    console.log(color.green + `\n\n🎉 Interaksi antar device selesai!` + color.reset);
    console.log(color.green + `Total pesan yang saling dikirim: ${totalSent}\n` + color.reset);

    console.log(color.yellow + "🔄 Refreshing semua device...\n" + color.reset);
    activeSockets.clear();
    loadAllDevices().then(() => setTimeout(showMainMenu, 2500));
}

/* =========================
   MAIN MENU (Sudah diedit - menu 2,4,5,6 dihapus)
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

    const onlineCount = Array.from(activeSockets.keys()).length;
    console.log(color.cyan + `\nOnline: ${onlineCount} device\n` + color.reset);

    console.log(color.cyan + `
════════════════════════════════════════════════════════════
1. Tambahkan Device Baru
3. Hapus Device
7. Reset Semua Sessions
8. Refresh All Devices
9. 🔥 INTERAKSI ANTAR DEVICE (Saling Chat seperti Manusia)
0. Keluar
` + color.reset);

    const choice = await question(color.bold + "Pilih menu → " + color.reset);

    switch (choice.trim()) {
        case '1': await createNewDevice(); break;
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
        case '9':
            await startDeviceInteractionLoop();
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
    console.log(color.green + "🚀 Multi Session Bot Warming + Interaksi Antar Device\n" + color.reset);
    await loadAllDevices();
    setTimeout(showMainMenu, 1500);
})();
