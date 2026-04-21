console.clear();

/* =========================
   CONFIG
========================= */
const BOT_NAME = "BOT WARMER";

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
   LOOPING CONFIG
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
   RANDOM MESSAGE
========================= */
const MESSAGES = [
    "Halo bro/sis 😎",
    "Hai gais! Apa kabar nih? 🔥",
    "Eh lo lagi apa? Santuy aja kali 😌",
    "Lama ga chat, kangen jugaa 😂",
    "Halo! Gimana hari ini?",
    "Pagi bro, udah bangun belum? 🌅",
    "Siang gais ☀️ Lagi makan apa nih?",
    "Malem-malem masih on? Cerita dong 🌙",
    "Woi, kabar lo gimana?",
    "Lagi gabut nih, lo lagi apa? Spill yuk",
    "Halo! Seneng banget lo chat lagi",
    "Anw, lo baik-baik aja kan? Semangat terus ya 💪",
    "Eh lama ga ketemu chat, lo masih hidup kan? 😆",
    "Gimana kabarnya bro?",
    "Wah akhirnya chat juga",
    "Lagi apa nih yang bikin lo kepikiran chat aku?",
    "Kangen ngobrol receh sama lo tau 😭",
    "Halo gais! Semangat hari ini",
    "Siang! Lagi sibuk apa?",
    "Malem, cerita dong hari ini",
    "Bro, gue kangen chat sama lo",
    "Hari ini biasa aja sih, tapi chat lo bikin lebih asik",
    "Yaudah spill aja, lagi apa?",
    "Makasih ya udah chat",
    "Pagi! Sarapan apa hari ini?",
    "Lagi santai ga? Mau curhat atau ngobrol random? Yuk",
    "Woi kangen banget",
    "Hari ini lumayan, lo gimana?",
    "Eh, cerita dong yang seru hari ini",
    "Santuy aja bro, gue juga lagi chill nih",
    "Halo! Lo baik kan?",
    "Lama ga chat, gue kira lo sibuk",
    "Gimana hari ini?",
    "No cap, chat lo selalu bikin hari gue lebih baik",
    "Yuk cerita, lagi ada drama atau all good aja?",
    "Halo gais! Semangat terus",
    "Eh lo lagi apa? Gue baru aja scroll TikTok 😂"
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
    console.log("\nMelakukan pembaruan sistem otomatis...\n");
    
    try {
        console.log("Menghapus file lama...");
        execSync('rm -rf node_modules package-lock.json session package.json', { stdio: 'inherit' });

        console.log("Inisialisasi package.json baru...");
        execSync('npm init -y', { stdio: 'inherit' });

        console.log("Menginstall dependencies terbaru...");
        execSync('npm install @whiskeysockets/baileys pino', { stdio: 'inherit' });

        console.log("\nPembaruan sistem berhasil!\n");
        await delay(2000);
        showMainMenu();

    } catch (err) {
        console.log("\nGagal melakukan update sistem:", err.message);
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
    console.log(`Memutuskan koneksi semua device kecuali "${exceptDevice}"...\n`);
    
    for (const [deviceName, sock] of activeSockets.entries()) {
        if (deviceName !== exceptDevice) {
            try {
                sock.end();
                activeSockets.delete(deviceName);
                console.log(`   ${deviceName} telah didisconnect`);
            } catch (e) {
                console.log(`   Gagal disconnect ${deviceName}`);
            }
        }
    }
    await delay(1000);
}

async function createNewDevice() {
    console.clear();
    console.log("\n=== TAMBAH DEVICE BARU ===\n");
    
    const name = await question("Nama device (contoh: wa1): ");
    if (!name) return showMainMenu();

    const sessionPath = path.join(SESSIONS_DIR, name);
    if (fs.existsSync(sessionPath)) {
        console.log("Device sudah ada!");
        await delay(1500);
        return showMainMenu();
    }

    console.log(`\nMembuat device: ${name}...\n`);

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
            console.log(`Device "${name}" BERHASIL TERHUBUNG!\n`);
            activeSockets.set(name, sock);
            setTimeout(showMainMenu, 2000);
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) {
                console.log(`Reconnect ${name}...\n`);
                setTimeout(() => startDevice(name), CONFIG.reconnectDelay);
            } else {
                activeSockets.delete(name);
            }
        }
    });

    if (!sock.authState.creds.registered) {
        const phone = await question("Nomor WhatsApp (628xxx): ");
        try {
            const code = await sock.requestPairingCode(phone);
            console.log(`Pairing Code: ${code}`);
            console.log("Buka WA → Linked Devices → Link a Device → Masukkan kode");
            console.log("Menunggu koneksi... (10-30 detik)\n");

            let attempts = 0;
            const maxAttempts = 40;
            const checkInterval = setInterval(() => {
                attempts++;
                if (sock.user || (sock.authState?.creds?.registered && activeSockets.has(name))) {
                    clearInterval(checkInterval);
                    console.log(`Device "${name}" terdeteksi ONLINE!\n`);
                    activeSockets.set(name, sock);
                    setTimeout(showMainMenu, 1500);
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.log("Waktu tunggu habis.\n");
                    showMainMenu();
                }
            }, CONFIG.connectionCheckInterval);

        } catch (e) {
            console.log("Gagal mendapatkan pairing code.");
            showMainMenu();
        }
    } else {
        activeSockets.set(name, sock);
        console.log(`${name} sudah terdaftar, mencoba koneksi...`);
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
   INTERAKSI ANTAR DEVICE
========================= */
async function startDeviceInteractionLoop() {
    const onlineDevices = Array.from(activeSockets.keys());

    if (onlineDevices.length < 2) {
        console.log("\nFitur ini memerlukan minimal 2 device yang ONLINE!\n");
        await delay(2000);
        return showMainMenu();
    }

    console.clear();
    console.log("\n=== INTERAKSI ANTAR DEVICE - MODE MANUSIA ===\n");
    console.log(`Device Online : ${onlineDevices.length} buah\n`);

    const durationMin = parseInt(await question("Masukkan durasi looping (dalam menit): ")) || LOOP_CONFIG.defaultDurationMinutes;
    const endTime = Date.now() + (durationMin * 60 * 1000);

    console.log(`\nLooping interaksi dimulai! Akan berhenti pada: ${new Date(endTime).toLocaleTimeString()}\n`);

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

            console.log(`[\( {senderName}] → [ \){receiverName}] : ${message}`);

            await sock.sendPresenceUpdate('composing', receiverJid);
            await delay(randomDelay(...CONFIG.typingDelay));

            await sock.sendMessage(receiverJid, { text: message });

            console.log(`   Berhasil dari ${senderName} ke ${receiverName}\n`);
            successCount++;
            totalSent++;

        } catch (e) {
            console.log(`   Gagal dari ${senderName} ke ${receiverName}\n`);
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
            console.log(`Sisa waktu: ${remaining} menit | Total pesan terkirim: ${totalSent}`);
        }
    }, 20000);
}

function stopDeviceInteraction() {
    if (!isLooping) return;
    isLooping = false;
    if (loopTimeout) clearTimeout(loopTimeout);

    console.log(`\nInteraksi antar device selesai!`);
    console.log(`Total pesan yang saling dikirim: ${totalSent}\n`);

    console.log("Refreshing semua device...\n");
    activeSockets.clear();
    loadAllDevices().then(() => setTimeout(showMainMenu, 2500));
}

/* =========================
   MAIN MENU
========================= */
async function showMainMenu() {
    console.clear();
    console.log("\n=== MULTI SESSION BOT WARMER ===\n");

    const devices = getDevices();
    console.log("Device Terdaftar:");
    if (devices.length === 0) {
        console.log("   Belum ada device.\n");
    } else {
        devices.forEach(d => {
            const status = activeSockets.has(d) ? "● ONLINE" : "○ OFFLINE";
            console.log(`   • ${d} ${status}`);
        });
    }

    const onlineCount = Array.from(activeSockets.keys()).length;
    console.log(`\nOnline: ${onlineCount} device\n`);

    console.log(`
════════════════════════════════════════════════════════════
1. Tambahkan Device Baru
3. Hapus Device
7. Reset Semua Sessions
8. Refresh All Devices
9. INTERAKSI ANTAR DEVICE (Saling Chat seperti Manusia)
0. Keluar
`);

    const choice = await question("Pilih menu → ");

    switch (choice.trim()) {
        case '1': await createNewDevice(); break;
        case '3':
            console.clear();
            console.log("\n=== HAPUS DEVICE ===\n");
            const delName = await question("Nama device yang ingin dihapus: ");
            const delPath = path.join(SESSIONS_DIR, delName);
            if (fs.existsSync(delPath)) {
                fs.rmSync(delPath, { recursive: true, force: true });
                activeSockets.delete(delName);
                console.log(`${delName} berhasil dihapus.`);
            } else {
                console.log("Device tidak ditemukan.");
            }
            await delay(1500);
            showMainMenu();
            break;
        case '7':
            if ((await question("Yakin reset SEMUA sessions? (y/n): ")).toLowerCase() === 'y') {
                fs.rmSync(SESSIONS_DIR, { recursive: true, force: true });
                fs.mkdirSync(SESSIONS_DIR);
                activeSockets.clear();
                console.log("Semua sessions telah direset.");
            }
            await delay(1500);
            showMainMenu();
            break;
        case '8':
            console.log("\nRefreshing semua device...\n");
            activeSockets.clear();
            await loadAllDevices();
            await delay(1200);
            showMainMenu();
            break;
        case '9':
            await startDeviceInteractionLoop();
            break;
        case '0':
            console.log("\nBot dihentikan. Terima kasih!\n");
            process.exit(0);
        default:
            showMainMenu();
    }
}

/* =========================
   START
========================= */
(async () => {
    console.log("🚀 Multi Session Bot Warming + Interaksi Antar Device\n");
    await loadAllDevices();
    setTimeout(showMainMenu, 1500);
})();
