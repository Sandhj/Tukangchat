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
    typingDelay: [2000, 7000],
    reconnectDelay: 8000,
    connectionCheckInterval: 3000
};

/* =========================
   LOOPING CONFIG
========================= */
let isLooping = false;
let loopTimeout = null;
let consecutiveFails = 0;   // <--- Penambahan untuk deteksi gagal 2x

const LOOP_CONFIG = {
    defaultDurationMinutes: 30,
    minInterval: 6000,
    maxInterval: 22000
};

/* =========================
   GLOBAL
========================= */
let activeSockets = new Map();
let successCount = 0, totalSent = 0;

const SESSIONS_DIR = './sessions';

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
    "Halo kak 😊", "Hai kak 🙏", "Halo kak ✨", "Hai kak 😄", 
    "Halo kak, apa kabar hari ini? 😊", "Hai kak, semoga harinya lancar ya 🙏",
    "Lagi apa nih? 😊", "Semoga harinya lancar ya 🙌", 
    "Kangen chat sama kamu 😁", "Gimana kabarnya? 😊",
    "Halo kak! Seneng banget kamu chat lagi 😊", "Hai kak 😄 Gimana hari ini?",
    "Wah halo! Lama ga chat ya, kangen loh 😊", "Hai kak 🙌 Semangat terus ya hari ini!",
    "Kangen juga chat sama kamu loh 😘", "Wah kangen chat sama aku ya? Aku lebih kangen tau 😂"
];

function randomMessage() { 
    return MESSAGES[Math.floor(Math.random() * MESSAGES.length)]; 
}

function randomDelay(min, max) { 
    return Math.floor(Math.random() * (max - min + 1)) + min; 
}

/* =========================
   DEVICE MANAGEMENT
========================= */
function getDevices() {
    return fs.readdirSync(SESSIONS_DIR).filter(f => 
        fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory()
    );
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
    activeSockets.clear(); // Pastikan bersih sebelum load ulang
    for (const dev of devices) {
        await startDevice(dev);
        await delay(600);
    }
    console.log(color.green + `✅ Semua device telah direfresh (${devices.length} device)\n` + color.reset);
}

/* =========================
   FITUR INTERAKSI ANTAR DEVICE (UPDATED)
========================= */
async function startDeviceInteractionLoop() {
    let onlineDevices = Array.from(activeSockets.keys());

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
    consecutiveFails = 0;   // Reset counter
    let senderIndex = 0;

    const interactionInterval = setInterval(async () => {
        if (!isLooping || Date.now() >= endTime) {
            clearInterval(interactionInterval);
            stopDeviceInteraction();
            return;
        }

        const senderName = onlineDevices[senderIndex];
        const sock = activeSockets.get(senderName);
        if (!sock) {
            consecutiveFails++;
            checkFailRestart();
            senderIndex = (senderIndex + 1) % onlineDevices.length;
            return;
        }

        // Pilih receiver random (bukan diri sendiri)
        let receiverIndex = senderIndex;
        while (receiverIndex === senderIndex) {
            receiverIndex = Math.floor(Math.random() * onlineDevices.length);
        }
        const receiverName = onlineDevices[receiverIndex];

        try {
            const senderJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const receiverJid = activeSockets.get(receiverName)?.user?.id?.split(':')[0] + '@s.whatsapp.net';

            if (!receiverJid) {
                consecutiveFails++;
                checkFailRestart();
                senderIndex = (senderIndex + 1) % onlineDevices.length;
                return;
            }

            const message = randomMessage();

            console.log(color.white + `[\( {senderName}] → [ \){receiverName}] : ${message}` + color.reset);

            await sock.sendPresenceUpdate('composing', receiverJid);
            await delay(randomDelay(...CONFIG.typingDelay));

            await sock.sendMessage(receiverJid, { text: message });

            console.log(color.green + `   ✅ Berhasil dari ${senderName} ke ${receiverName}\n` + color.reset);
            successCount++;
            totalSent++;
            consecutiveFails = 0;   // Reset jika berhasil

        } catch (e) {
            console.log(color.red + `   ❌ Gagal dari ${senderName} ke ${receiverName}\n` + color.reset);
            consecutiveFails++;
            checkFailRestart();
        }

        senderIndex = (senderIndex + 1) % onlineDevices.length;

    }, randomDelay(LOOP_CONFIG.minInterval, LOOP_CONFIG.maxInterval));

    loopTimeout = setTimeout(() => {
        if (isLooping) stopDeviceInteraction();
    }, durationMin * 60 * 1000);
}

// Fungsi baru: Cek jika gagal 2x berturut-turut
function checkFailRestart() {
    if (consecutiveFails >= 2) {
        console.log(color.red + `\n⚠️ Gagal mengirim 2x berturut-turut! Melakukan restart semua device...\n` + color.reset);
        restartAllDevicesAndContinue();
        consecutiveFails = 0;
    }
}

async function restartAllDevicesAndContinue() {
    if (!isLooping) return;

    console.log(color.yellow + "🔄 Restarting semua device...\n" + color.reset);
    
    activeSockets.clear();
    await loadAllDevices();

    // Tunggu sebentar agar device stabil
    await delay(3000);

    console.log(color.green + "✅ Restart selesai. Melanjutkan interaksi...\n" + color.reset);
}

function stopDeviceInteraction() {
    if (!isLooping) return;
    isLooping = false;
    if (loopTimeout) clearTimeout(loopTimeout);
    consecutiveFails = 0;

    console.log(color.green + `\n\n🎉 Interaksi antar device selesai!` + color.reset);
    console.log(color.green + `Total pesan yang saling dikirim: ${totalSent}\n` + color.reset);

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

    const onlineCount = Array.from(activeSockets.keys()).length;
    console.log(color.cyan + `\nOnline: ${onlineCount} device\n` + color.reset);

    console.log(color.cyan + `
════════════════════════════════════════════════════════════
1. Tambahkan Device Baru
2. List Device
3. Refresh All Devices
4. 🔥 INTERAKSI ANTAR DEVICE (Saling Chat seperti Manusia)
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
            console.log(color.yellow + "\n🔄 Refreshing semua device...\n" + color.reset);
            await loadAllDevices();
            await delay(1200);
            showMainMenu();
            break;
        case '4':
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
    console.log(color.green + "🚀 Multi Session Bot - Interaksi Antar Device\n" + color.reset);
    await loadAllDevices();
    setTimeout(showMainMenu, 1500);
})();
