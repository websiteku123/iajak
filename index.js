const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const readline = require("readline");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(text, (answer) => {
        rl.close();
        resolve(answer);
    }));
};

let sock;
const ownerTarget = "6285883881264@s.whatsapp.net";
const botNumber = "6283119396819"; // Nomor bot Anda

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        keepAliveIntervalMs: 30000,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // Fitur Pairing Code
    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('Masukan nomor untuk send notifikasi ke owner: ');
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`KODE PAIRING ANDA: ${code}`);
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("BOT TERHUBUNG!");
            // Kirim pesan aktif ke nomor bot sendiri
            await sock.sendMessage(jidNormalizedUser(sock.user.id), { text: "bot aktif" });
        }
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    // API Internal untuk menerima data dari HTML
    app.post("/receive-data", async (req, res) => {
        const { link, react, token } = req.body;
        
        // Cek token sesuai permintaan "ryn"
        if (token !== "ryn") return res.status(403).json({ status: false, msg: "Invalid Token" });

        const caption = `𝐇𝐈 𝐀𝐃𝐌𝐈𝐍 𝐓𝐇𝐄𝐑𝐄'𝐒 𝐍𝐄𝐖 ᴄʜ ᴅᴀᴛᴀ ʜᴇʀᴇ🪀\n\nʟɪɴᴋ ᴄʜ : ${link}\nʀᴇᴀᴄᴛ ᴇᴍᴏᴊɪ : ${react}\nᴋᴇᴍʙᴀʟɪ ᴀᴋᴛɪꜰ : 10 Menit\nᴡᴀᴋᴛᴜ : ${new Date().toLocaleString()}`;

        try {
            await sock.sendMessage(ownerTarget, { text: caption });
            res.json({ status: true });
        } catch (e) {
            res.status(500).json({ status: false });
        }
    });

    app.listen(3000, () => console.log("Server API Berjalan di Port 3000"));
}

startBot();
