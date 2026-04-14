console.clear();

/* =========================
   CONFIG
========================= */
const BOT_NAME = "BOT WARMER";
const DEVELOPER = "@Mr.01y";
/*Mod By San*/

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
    typingDelay: [2000, 7000],
    reconnectDelay: 8000,
    connectionCheckInterval: 3000
};

/* =========================
   LOOPING CONFIG (Fitur Terbaru)
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
/*const MESSAGES = [
    "Halo kak 😊", "Hai kak 🙏", "Apa kabar hari ini? ✨", "Hai kak 😄",
    "Lagi apa nih? 😊", "Semoga harinya lancar ya 🙌", "Pagi kak 🌅",
    "Siang kak ☀️", "Malam kak 🌙", "Kangen chat sama kamu 😁",
    "Gimana kabarnya? 😊", "Lama ga chat nih 😂"
];*/

const MESSAGES = [
    "Halo kak 😊", 
    "Hai kak 🙏", 
    "Apa kabar hari ini? ✨", 
    "Hai kak 😄",
    "Lagi apa nih? 😊", 
    "Semoga harinya lancar ya 🙌", 
    "Pagi kak 🌅",
    "Siang kak ☀️", 
    "Malam kak 🌙", 
    "Kangen chat sama kamu 😁",
    "Gimana kabarnya? 😊", 
    "Lama ga chat nih 😂",
    "Halo kak! Seneng banget kamu chat lagi 😊",
    "Hai kak 😄 Gimana hari ini?",
    "Apa kabar kak? Aku baik nih, kamu gimana? ✨",
    "Wah halo! Lama ga chat ya, kangen loh 😊",
    "Hai kak 🙌 Semangat terus ya hari ini!",
    "Halo kak 😊 Lagi apa nih yang bikin kangen chat?",
    "Kangen juga chat sama kamu loh 😘",
    "Hai kak! Baru aja kepikiran kamu, eh kamu chat duluan",
    "Wah kangen chat sama aku ya? Aku lebih kangen tau 😂",
    "Halo kak 🌞 Gimana kabarnya hari ini?",
    "Siang kak ☀️ Cerita dong, lagi apa?",
    "Malam kak 🌙 Chat dari kamu bikin hari aku cerah",
    "Halo! Aku baik, tambah baik kalau chat sama kakak 😊",
    "Lama ga chat nih, aku kira kakak lupa sama aku 😢",
    "Halo kak 😄 Seneng dapet chat dari kamu",
    "Apa kabar? Semoga hari ini lebih baik dari kemarin ya 🙏",
    "Halo kak! Lagi santai atau sibuk nih?",
    "Aku baik kak, makasih! Kamu sendiri gimana kabarnya? 😊",
    "Lagi santai nih, kamu lagi apa kak? Cerita dong 😄",
    "Kangen juga banget sama kamu 😘",
    "Aku kangen loh, makanya langsung chat 😂",
    "Hari ini lumayan kak, kamu gimana? Semangat ya! ✨",
    "Wah seneng banget! Aku juga kangen chat sama kakak ❤️",
    "Baik kak, makasih doanya! Kamu semoga lancar juga ya 🙌",
    "Pagi kak! 🌅 Aku baru bangun nih, kakak udah sarapan belum?",
    "Siang kak ☀️ Lagi makan siang belum? Aku baru aja selesai",
    "Malam kak 🌙 Lagi apa nih malam-malam? Cerita yuk",
    "Haha engga lupa kok, malah sering kepikiran kamu 😊",
    "Aku lagi mikirin kamu juga tadi, telepati dong kita 😄",
    "Cerita dong kak, hari ini ada hal seru ga? Aku mau denger 😊",
    "Makasih kak 😊 Kamu juga semangat ya hari ini!",
    "Wah seru dong! Ceritain lebih detail yuk",
    "Aku juga kangen banget, kapan-kapan ketemu yuk 😁",
    "Hari ini biasa aja sih, tapi jadi lebih baik setelah chat sama kamu ❤️"
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

/* =========================
   DEVICE MANAGEMENT
========================= */
function getDevices() {
    return fs.readdirSync(SESSIONS_DIR).filter(f => 
        fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory()
    );
}


                    setTimeout(showMainMenu, 1500);
                } else if (attempts >= 40) {
                    clearInterval(checkInterval);
                    showMainMenu();
                }
            }, CONFIG.connectionCheckInterval);
        } catch (e) {
            console.log(color.red + "❌ Gagal mendapatkan pairing code." + color.reset);
            showMainMenu();
        }
    } else {
        activeSockets.set(name, sock);
        setTimeout(showMainMenu, 1500);
    }
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
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') activeSockets.set(deviceName, sock);
        if (update.connection === 'close') activeSockets.delete(deviceName);
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
   WARMING KE NOMOR EKSTERNAL (Fitur Lama)
========================= */
async function startWarming(deviceName) {
    const sock = activeSockets.get(deviceName);
    if (!sock) {
        console.log(color.red + `\n❌ Device ${deviceName} tidak online!\n` + color.reset);
        await delay(1500);
        return showMainMenu();
    }

    await disconnectAllExcept(deviceName); // Disconnect device lain

    let targets = loadTargets();
    if (targets.length === 0) {
        console.log(color.red + "\n❌ File nomor_wa.txt kosong!\n" + color.reset);
        await delay(1500);
        return showMainMenu();
    }

    targets = [...targets].sort(() => Math.random() - 0.5);
    clearAndShowHeader(`WARMING → \( {deviceName} ( \){targets.length} target)`);

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

    console.log(color.green + `\n🎉 Warming selesai untuk ${deviceName}!\n` + color.reset);
    activeSockets.clear();
    await loadAllDevices();
    await delay(2000);
    showMainMenu();
}

async function disconnectAllExcept(exceptDevice) {
    for (const [name, sock] of activeSockets.entries()) {
        if (name !== exceptDevice) {
            try { sock.end(); activeSockets.delete(name); } catch (e) {}
        }
    }
}

/* =========================
   FITUR TERBARU: INTERAKSI ANTAR DEVICE
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

        // Pilih receiver secara random (bukan diri sendiri)
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

    // Status sisa waktu
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
   MAIN MENU
========================= */
async function showMainMenu() {
    clearAndShowHeader();

    const devices = getDevices();
    const onlineCount = Array.from(activeSockets.keys()).length;

    console.log(color.cyan + "📱 Device Terdaftar:" + color.reset);
    devices.forEach(d => console.log(`   • ${d} ${deviceStatus(d)}`));

    console.log(color.cyan + `\nOnline: ${onlineCount} device\n` + color.reset);

    console.log(color.cyan + `
════════════════════════════════════════════════════════════
1. Tambahkan Device Baru
2. List Device
3. Hapus Device
4. Status Device Terhubung
5. Mulai Warming (ke Nomor Eksternal)
6. Replace Nomor Target
7. Reset Semua Sessions
8. Refresh All Devices
9. 🔥 INTERAKSI ANTAR DEVICE (Saling Chat seperti Manusia)
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
                console.log(color.red + "\n❌ Device tidak online!" + color.reset);
                await delay(1500);
                showMainMenu();
            }
            break;
        case '6':
            clearAndShowHeader("REPLACE TARGET");
            console.log(color.yellow + "Masukkan nomor baru (satu per baris). Ketik 'selesai' untuk selesai:\n" + color.reset);
            let numbers = [];
            async function ask() {
                const input = await question(color.cyan + "> " + color.reset);
                if (!input || input.toLowerCase() === 'selesai') {
                    fs.writeFileSync(HISTORY_FILE, numbers.join('\n'));
                    console.log(color.green + `\n✅ Berhasil menyimpan ${numbers.length} nomor.\n` + color.reset);
                    await delay(1000);
                    showMainMenu();
                } else {
                    numbers.push(input.trim());
                    ask();
                }
            }
            ask();
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
    console.log(color.green + "🚀 Multi Session Bot Warming dengan Fitur Interaksi Antar Device\n" + color.reset);
    await loadAllDevices();
    setTimeout(showMainMenu, 1500);
})();
