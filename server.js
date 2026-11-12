const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const sessions = {}; 
const whitelist = {}; 

// CONFIGURAÇÃO: 48 Horas em milissegundos
const KEY_DURATION_48H = 48 * 60 * 60 * 1000; 

// Rota para o UptimeRobot
app.get('/ping', (req, res) => res.send('Render 48h Online'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/status', (req, res) => {
    const { id } = req.query;
    if (!sessions[id]) sessions[id] = { step: 0, clickTime: 0 };
    res.json(sessions[id]);
});

// Marca o tempo de ida para a missão
app.get('/api/start', (req, res) => {
    const { id } = req.query;
    if (sessions[id]) sessions[id].clickTime = Date.now();
    res.json({ success: true });
});

// Verifica a volta do Linkvertise (Anti-Bypass de 15s)
app.get('/api/verify_mission', (req, res) => {
    const { id, mission } = req.query;
    const session = sessions[id];
    const m = parseInt(mission);

    if (!session) return res.json({ error: "Sessão inválida!" });
    if (session.step !== m - 1) return res.json({ error: "Você pulou uma missão ou tentou burlar!" });
    
    // Bloqueia se voltar rápido demais (menos de 15s)
    if (Date.now() - session.clickTime < 15000) return res.json({ error: "bypass_detected" });

    session.step = m; // Avança o progresso (1, 2 ou 3)
    res.json({ success: true });
});

// --- BUSCA AVATAR ROBLOX ---
app.get('/api/roblox_info', async (req, res) => {
    const { query, type } = req.query; 
    try {
        let userId = query;
        let username = query;

        if (type === 'username') {
            // Usando RoProxy para evitar o bloqueio do Cloudflare no Render
            const idRes = await fetch('https://users.roproxy.com/v1/usernames/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ usernames: [query], excludeBannedUsers: false })
            });
            const idData = await idRes.json();
            if (!idData.data || idData.data.length === 0) return res.json({ error: "Usuário não encontrado no Roblox!" });
            userId = idData.data[0].id;
            username = idData.data[0].name;
        } else {
            const nameRes = await fetch(`https://users.roproxy.com/v1/users/${userId}`);
            if (!nameRes.ok) return res.json({ error: "ID inválido!" });
            const nameData = await nameRes.json();
            username = nameData.name;
        }

        const avatarRes = await fetch(`https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
        const avatarData = await avatarRes.json();
        const avatarUrl = avatarData.data[0].imageUrl;

        res.json({ success: true, id: userId, username: username, avatar: avatarUrl });
    } catch (err) {
        console.error(err);
        res.json({ error: "Erro na API. Tente buscar pelo ID numérico!" });
    }
});

// --- WHITELIST (48 HORAS) ---
app.get('/api/whitelist_add', (req, res) => {
    const { id, session_id } = req.query;
    // Exige que o step seja 3 (todas as missões concluídas)
    if (!sessions[session_id] || sessions[session_id].step < 3) {
        return res.json({ error: "Você não concluiu todas as 3 missões." });
    }
    
    whitelist[id] = Date.now() + KEY_DURATION_48H;
    res.json({ success: true });
});

app.get('/api/check_whitelist', (req, res) => {
    const { id } = req.query;
    const expireTime = whitelist[id];
    
    if (expireTime && Date.now() < expireTime) {
        return res.json({ valid: true });
    }
    if (expireTime) delete whitelist[id];
    res.json({ valid: false, error: "Acesso expirado ou não encontrado." });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor 48h rodando na porta ${PORT}`));
