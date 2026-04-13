console.clear();

/* =========================
   🔐 CONFIG LOGIN
========================= */
const LOGIN_KEY = "mr01y";
const BOT_NAME = "BOT WARMER";
const DEVELOPER = "@Mr.01y";

/* =========================
   🎨 COLOR
========================= */
const color = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    bold: "\x1b[1m"
};

/* =========================
   🔑 VALIDASI KEY
========================= */
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (text) => new Promise(resolve => rl.question(text, resolve));

async function validateKey() {
    console.clear();
    console.log(color.cyan + "╔══════════════════════════════════════╗");
    console.log(`║        ${BOT_NAME.padEnd(26)}║`);
    console.log("╠══════════════════════════════════════╣");
    console.log(`║ Developer : ${DEVELOPER.padEnd(18)}║`);
    console.log("╚══════════════════════════════════════╝" + color.reset);
    

    console.log(color.green + "\n✅ Login berhasil!\n" + color.reset);
}

/* =========================
   HAPUS LOG SAMPAH
========================= */
console.debug = () => {};
console.info = () => {};
console.warn = () => {};

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
    const str = chunk.toString();

    if (
        str.includes('Closing session') ||
        str.includes('SessionEntry') ||
        str.includes('chainKey') ||
        str.includes('Buffer') ||
        str.includes('preKey') ||
        str.includes('ephemeral') ||
        str.includes('ratchet')
    ) return;

    return originalStdoutWrite(chunk, encoding, callback);
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

/* =========================
   UTIL
========================= */
const delay = (ms) => new Promise(res => setTimeout(res, ms));

/* =========================
   CONFIG
========================= */
const CONFIG = {
    minDelay: 5000,
    maxDelay: 12000,
    batchDelay: 60000,
    typingDelay: [2000, 5000],
    retry: 3
};

/* =========================
   UI LOG + STATS
========================= */
let successCount = 0;
let failCount = 0;
let totalSent = 0;

function logHeader(title) {
    console.log(color.cyan + '\n╔══════════════════════════════════════╗');
    console.log(`║ ${title.padEnd(36)}║`);
    console.log('╚══════════════════════════════════════╝\n' + color.reset);
}

function logStats() {
    console.log(
        color.yellow +
        `📊 Sukses: ${successCount} | ❌ Gagal: ${failCount} | 📤 Total: ${totalSent}` +
        color.reset + "\n"
    );
}

function logSuccess(jid) {
    successCount++;
    totalSent++;
    console.log(color.green + `✅ ${jid.replace('@s.whatsapp.net','')} → terkirim` + color.reset);
    logStats();
}

function logError(jid) {
    failCount++;
    totalSent++;
    console.log(color.red + `❌ ${jid.replace('@s.whatsapp.net','')} → gagal` + color.reset);
    logStats();
}

function logDelay(ms) {
    console.log(color.cyan + `⏳ Delay: ${(ms / 1000).toFixed(1)} detik` + color.reset + "\n");
}

/* =========================
   RANDOM PESAN
========================= */
const MESSAGES = [
    "Halo kak 😊",
    "Hai kak 🙏",
    "Halo kak ✨",
    "Hai kak 😄",
    "Halo kak 💬",
    "Halo kak 👋",
    "Hai, lagi online?",
    "Permisi kak 😊",
    "Halo kak, apa kabar hari ini? 😊",
    "Hai kak, semoga harinya lancar ya 🙏",
    "Halo, lagi sibuk atau santai nih?",
    "Hai kak, sehat selalu ya 💪",
    "Halo kak, kayaknya kita pernah chat ya sebelumnya 😄",
    "Hai kak, ini nomor baru saya ya 🙏",
    "Halo, ini masih nomor kakak yang aktif kan?",
    "Hai kak, saya simpan nomor ini ya",
    "Halo kak, lagi hujan di sini 🌧️ di sana gimana?",
    "Hai kak, semoga harinya menyenangkan ya ✨",
    "Halo, lagi ngapain nih kak? 😄",
    "Hai kak, jangan lupa istirahat ya",
    "Halo kak, izin menyapa ya 😊",
    "Hai kak, semoga tidak mengganggu 🙏",
    "Halo kak, boleh kenalan sebentar?",
    "Hai kak, saya mau tanya sedikit boleh ya",
    "Halo, saya mau tanya",
    "Hai kak, semoga sehat ya 🙏",
    "Halo kak, boleh ngobrol bentar?"
];

function randomMessage() {
    return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* =========================
   RANDOM SHUFFLE TARGET
========================= */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/* =========================
   TARGET
========================= */
const HISTORY_FILE = './nomor_wa.txt';

function loadTargets() {
    if (!fs.existsSync(HISTORY_FILE)) return [];

    return fs.readFileSync(HISTORY_FILE, 'utf-8')
        .split('\n')
        .map(x => x.trim())
        .filter(x => x.length > 5)
        .map(x => {
            if (x.includes('@s.whatsapp.net')) return x;

            let nomor = x.replace(/[^0-9]/g, '');

            if (nomor.startsWith('0')) {
                nomor = '62' + nomor.slice(1);
            }

            return nomor + '@s.whatsapp.net';
        });
}

/* =========================
   PILIH + RANDOM TARGET
========================= */
async function selectTargets() {
    let allTargets = loadTargets();

    if (allTargets.length === 0) {
        console.log(color.red + '⚠️ File nomor kosong!' + color.reset);
        process.exit();
    }

    allTargets = shuffleArray(allTargets);

    console.log(color.cyan + `\n📂 Total nomor tersedia: ${allTargets.length}` + color.reset);

    const input = await question("📥 Mau kirim ke berapa nomor? (kosong = semua): ");

    let jumlah = parseInt(input);

    if (!input || isNaN(jumlah) || jumlah <= 0 || jumlah > allTargets.length) {
        console.log(color.yellow + "⚠️ Menggunakan semua nomor (acak)\n" + color.reset);
        return allTargets;
    }

    console.log(color.green + `✅ Menggunakan ${jumlah} nomor (acak)\n` + color.reset);

    return allTargets.slice(0, jumlah);
}

/* =========================
   MENU LANJUT / BERHENTI
========================= */
async function askNextAction() {
    console.log(color.cyan + "\n══════════════════════════════" + color.reset);
    const input = await question("👉 Lanjut batch berikutnya? (y/n): ");

    if (input.toLowerCase() === 'n') {
        console.log(color.red + "\n🛑 Bot dihentikan oleh user\n" + color.reset);
        process.exit();
    }

    console.log(color.green + "\n▶️ Lanjut ke batch berikutnya...\n" + color.reset);
}

/* =========================
   SEND HUMAN LIKE
========================= */
async function sendHuman(sock, jid) {
    for (let i = 0; i < CONFIG.retry; i++) {
        try {
            await sock.sendPresenceUpdate('composing', jid);
            await delay(randomDelay(...CONFIG.typingDelay));

            await sock.sendMessage(jid, {
                text: randomMessage()
            });

            await sock.sendPresenceUpdate('paused', jid);

            logSuccess(jid);
            return true;

        } catch {
            await delay(2000);
        }
    }

    logError(jid);
    return false;
}

/* =========================
   START BOT
========================= */
let isStarting = false;

async function startBot() {
    if (isStarting) return;
    isStarting = true;

    const { state, saveCreds } = await useMultiFileAuthState('./session');
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
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            isStarting = false;

            const reason = lastDisconnect?.error?.output?.statusCode;

            console.log(color.red + '❌ Putus: ' + reason + color.reset);

            if (reason !== DisconnectReason.loggedOut) {
                console.log(color.yellow + '🔄 Reconnect 5 detik...\n' + color.reset);
                setTimeout(startBot, 5000);
            } else {
                console.log(color.red + '❌ Harus login ulang!' + color.reset);
            }
        }

        if (connection === 'open') {
            console.clear();
            logHeader(`🔥 ${BOT_NAME} ONLINE 🚀`);
            startWarming(sock);
        }
    });

    if (!sock.authState.creds.registered) {
        const nomor = await question('Nomor (628xxx): ');
        await delay(3000);

        try {
            const code = await sock.requestPairingCode(nomor);
            console.log(color.cyan + '\n🔑 Pairing Code: ' + code + color.reset);
        } catch {
            console.log(color.red + '❌ Gagal ambil pairing code' + color.reset);
        }
    }
}

/* =========================
   MAIN LOOP
========================= */
async function startWarming(sock) {
    const targets = await selectTargets();

    if (targets.length === 0) {
        console.log(color.red + '⚠️ Target kosong' + color.reset);
        return;
    }

    logHeader(`📊 Total target: ${targets.length}`);

    while (true) {
        for (let i = 0; i < targets.length; i++) {
            const jid = targets[i];

            console.log(color.white + `📍 Progress: ${i + 1}/${targets.length}` + color.reset);

            await sendHuman(sock, jid);

            const d = randomDelay(CONFIG.minDelay, CONFIG.maxDelay);
            logDelay(d);
            await delay(d);
        }

        console.log(color.yellow + '😴 Batch selesai, cooldown...\n' + color.reset);
        await delay(CONFIG.batchDelay);

        await askNextAction();
    }
}

/* =========================
   RUN
========================= */
(async () => {
    await validateKey();
    startBot();
})();
