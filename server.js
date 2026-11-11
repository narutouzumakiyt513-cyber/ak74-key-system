const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Bancos de dados em memória
const sessions = {}; // Controla em qual missão o usuário está e o anti-bypass
const activeKeys = {}; // Guarda as chaves geradas e a data de expiração (48h)

// Entrega a página HTML (O Site)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Passo 1: Marca o tempo inicial para evitar Bypass
app.get('/api/start', (req, res) => {
    const { id } = req.query;
    if (!sessions[id]) sessions[id] = { step: 0 };
    
    sessions[id].lastClick = Date.now(); // Salva o exato milissegundo do clique
    res.json({ success: true });
});

// Passo 2: Valida se ele voltou do Linkvertise com a missão feita
app.get('/api/verify_mission', (req, res) => {
    const { id, mission } = req.query;
    const session = sessions[id];

    if (!session) return res.json({ error: "Sessão inválida. Atualize a página." });

    // ANTI-BYPASS: Verifica se passou pelo menos 15 segundos desde o clique
    const timePassed = Date.now() - (session.lastClick || 0);
    if (timePassed < 15000) { 
        return res.json({ error: "Você foi rápido demais! Pare de usar Bypassers e veja os anúncios corretamente." });
    }

    // Avança as missões
    if (mission == 1 && session.step == 0) session.step = 1;
    if (mission == 2 && session.step == 1) session.step = 2;
    if (mission == 3 && session.step == 2) {
        session.step = 3;
        
        // Gera a Chave de 48h Criptografada (Ex: AK74-8A2F9B)
        const newKey = "AK74-" + crypto.randomBytes(3).toString('hex').toUpperCase();
        session.key = newKey;
        
        // Salva a chave para deletar em exatas 48 horas
        activeKeys[newKey] = Date.now() + (48 * 60 * 60 * 1000);
    }
    
    res.json({ success: true });
});

// Passo 3: Mostra o status atual para o site se atualizar sozinho
app.get('/api/status', (req, res) => {
    const { id } = req.query;
    const session = sessions[id] || { step: 0 };
    res.json(session);
});

// Passo 4: Onde o Script do Roblox bate para checar a chave
app.get('/api/check_key', (req, res) => {
    const { key } = req.query;
    const expireTime = activeKeys[key];

    if (expireTime) {
        if (Date.now() > expireTime) {
            delete activeKeys[key]; // Deleta a chave instantaneamente se passou de 48h
            return res.json({ valid: false, message: "Chave Expirada. Gere outra no site." });
        }
        return res.json({ valid: true, message: "Acesso Liberado!" });
    }
    return res.json({ valid: false, message: "Chave Inválida." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Ak-74 Hub rodando na porta ${PORT}`));
