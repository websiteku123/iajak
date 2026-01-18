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
const express = require("express");
const app = express();
const path = require("path");

const ownerNumber = "6285883881264"; // Nomor Tujuan
const botNumber = "6283119396819"; // Nomor Bot Utama
const tokenKey = "ryn";

app.use(express.json());
app.use(express.static("."));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Fitur Pairing Code
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            let code = await sock.requestPairingCode(botNumber);
            console.log(`\n╭────────────────╼\n╎ YOUR PAIRING CODE : ${code}\n╰────────────────╼\n`);
        }, 3000);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        } else if (connection === "open") {
            console.log("Bot Berhasil Terhubung!");
            sock.sendMessage(jidNormalizedUser(sock.user.id), { text: "bot aktif" });
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // Endpoint API untuk menerima data dari HTML
    app.post("/senddata", async (req, res) => {
        const { link, react, token, time } = req.body;

        if (token !== tokenKey) return res.status(403).json({ error: "Token Salah" });

        const message = `𝐇𝐈 𝐀𝐃𝐌𝐈𝐍 𝐓𝐇𝐄𝐑𝐄'𝐒 𝐍𝐄𝐖 𝐂𝐇 𝐃𝐀𝐓𝐀 𝐇𝐄𝐑𝐄🪀\n\nʟɪɴᴋ ᴄʜ : ${link}\nʀᴇᴀᴄᴛ ᴇᴍᴏᴊɪ : ${react}\nᴋᴇᴍʙᴀʟɪ ᴀᴋᴛɪꜰ : 10 Menit\nᴡᴀᴋᴛᴜ : ${time}`;

        try {
            await sock.sendMessage(ownerNumber + "@s.whatsapp.net", { text: message });
            res.json({ status: "success" });
        } catch (err) {
            res.status(500).json({ error: "Gagal kirim chat" });
        }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startBot();
});
