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

/* =========================
   TAMBAH DEVICE BARU - MULTI (Max 10 Sekaligus)
========================= */
async function createNewDevice() {
    clearAndShowHeader("TAMBAH DEVICE BARU (MULTI - MAX 10)");

    console.log(color.yellow + "Masukkan hingga 10 nomor WhatsApp (628xx...)\nKetik 'selesai' untuk langsung proses yang sudah dimasukkan.\n" + color.reset);

    let numbers = [];
    let deviceNames = [];

    async function askNumber() {
        if (numbers.length >= 10) {
            console.log(color.yellow + "\n✅ Sudah mencapai maksimal 10 nomor.\n" + color.reset);
            return processMultiDevices(numbers);
        }

        const input = await question(color.cyan + `Nomor ${numbers.length + 1}/10 (628xxx atau 'selesai'): ` + color.reset);

        if (!input || input.toLowerCase() === 'selesai') {
            if (numbers.length === 0) {
                console.log(color.red + "❌ Tidak ada nomor yang dimasukkan.\n" + color.reset);
                await delay(1500);
                return showMainMenu();
            }
            return processMultiDevices(numbers);
        }

        let cleanNum = input.replace(/[^0-9]/g, '');
        if (cleanNum.startsWith('0')) cleanNum = '62' + cleanNum.slice(1);
        if (!cleanNum.startsWith('62')) cleanNum = '62' + cleanNum;

        if (cleanNum.length < 10) {
            console.log(color.red + "❌ Nomor tidak valid!\n" + color.reset);
            return askNumber();
        }

        const jid = cleanNum + '@s.whatsapp.net';
        if (numbers.includes(jid)) {
            console.log(color.yellow + "⚠️ Nomor ini sudah dimasukkan.\n" + color.reset);
            return askNumber();
        }

        numbers.push(jid);

        // Buat nama device otomatis: wa1, wa2, wa3, ...
        const deviceName = `wa${String(numbers.length).padStart(2, '0')}`;
        deviceNames.push(deviceName);

        console.log(color.green + `   ✓ ${cleanNum} → Device: ${deviceName}` + color.reset);
        askNumber();
    }

    await askNumber();
}

// Fungsi utama untuk memproses multiple devices
async function processMultiDevices(numbers) {
    console.log(color.magenta + `\n🚀 Memproses ${numbers.length} device sekaligus...\n` + color.reset);

    const pairingData = [];

    for (let i = 0; i < numbers.length; i++) {
        const phone = numbers[i].replace('@s.whatsapp.net', '');
        const deviceName = `wa${String(i + 1).padStart(2, '0')}`;

        const sessionPath = path.join(SESSIONS_DIR, deviceName);

        if (fs.existsSync(sessionPath)) {
            console.log(color.yellow + `⚠️ Device ${deviceName} sudah ada, dilewati.` + color.reset);
            continue;
        }

        console.log(color.cyan + `📱 Membuat device: ${deviceName} untuk ${phone}...` + color.reset);

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

        try {
            if (!sock.authState.creds.registered) {
                const code = await sock.requestPairingCode(phone);
                pairingData.push({
                    index: i + 1,
                    phone: phone,
                    code: code,
                    deviceName: deviceName,
                    sock: sock,
                    status: 'Menunggu'
                });

                console.log(color.white + `   ${i + 1}. ${phone} → Kode: ${code} \( {color.yellow}(Menunggu) \){color.reset}` + color.reset);
            }
        } catch (err) {
            console.log(color.red + `   ❌ Gagal mendapatkan kode untuk ${phone}: ${err.message}` + color.reset);
        }

        await delay(800); // Jeda kecil agar tidak terlalu cepat
    }

    if (pairingData.length === 0) {
        console.log(color.red + "\n❌ Tidak ada device yang berhasil dibuat.\n" + color.reset);
        await delay(2000);
        return showMainMenu();
    }

    console.log(color.green + `\n✅ Semua kode pairing telah dibuat! Silakan masukkan di WhatsApp masing-masing.\n` + color.reset);
    console.log(color.cyan + "Menunggu koneksi dari semua device...\n" + color.reset);

    // Monitor semua device secara paralel
    let completed = 0;
    const total = pairingData.length;

    const checkIntervals = pairingData.map(data => {
        return setInterval(() => {
            const sock = data.sock;
            if (sock?.user || (sock?.authState?.creds?.registered && activeSockets.has(data.deviceName))) {
                clearInterval(checkIntervals[pairingData.indexOf(data)]);
                data.status = 'Online';
                completed++;

                console.log(color.green + `   ${data.index}. ${data.phone} → ${data.code} \( {color.green}(Online) ✅ \){color.reset}` + color.reset);

                activeSockets.set(data.deviceName, sock);

                if (completed === total) {
                    console.log(color.green + `\n🎉 Semua device berhasil terhubung!\n` + color.reset);
                    setTimeout(showMainMenu, 2000);
                }
            }
        }, CONFIG.connectionCheckInterval);
    });

    // Timeout keseluruhan (maksimal 2 menit)
    setTimeout(() => {
        let stillWaiting = pairingData.filter(d => d.status === 'Menunggu');
        if (stillWaiting.length > 0) {
            console.log(color.yellow + `\n⚠️ Waktu tunggu habis. ${stillWaiting.length} device masih menunggu.\n` + color.reset);
        }
        console.log(color.cyan + "\nTekan Enter untuk kembali ke menu utama..." + color.reset);
        question("").then(() => showMainMenu());
    }, 120000); // 2 menit
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
   WARMING KE NOMOR EKSTERNAL
========================= */
async function startWarming(deviceName) {
    const sock = activeSockets.get(deviceName);
    if (!sock) {
        console.log(color.red + `\n❌ Device ${deviceName} tidak online!\n` + color.reset);
        await delay(1500);
        return showMainMenu();
    }

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
   FITUR BARU: INTERAKSI ANTAR DEVICE (Menu 9)
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
3. Hapus Device
4. Status Device Terhubung
5. Mulai Warming (Pilih Device)
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
