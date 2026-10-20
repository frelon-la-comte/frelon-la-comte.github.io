async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkLogin() {
    const inputPass = document.getElementById('admin-pass').value;
    const errorMsg = document.getElementById('error-msg');
    
    const hashedInput = await sha256(inputPass);

    if (hashedInput === CONFIG.adminHash) {
        document.getElementById('login-panel').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        errorMsg.style.display = 'none';
        sessionStorage.setItem('isLoggedIn', 'true');
        // Initialise les sections dynamiques après connexion
        if (typeof initAdminPanel === 'function') initAdminPanel();
    } else {
        errorMsg.style.display = 'block';
    }
}

function logout() {
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = 'index.html';
}

// --- GESTION DU TOKEN ---
function saveToken() {
    const token = document.getElementById('github-token').value.trim();
    if (token) {
        localStorage.setItem('gh_token', token);
        updateTokenStatus(true);
    } else {
        localStorage.removeItem('gh_token');
        updateTokenStatus(false);
    }
}

function updateTokenStatus(present) {
    const el = document.getElementById('token-status');
    if (!el) return;
    if (present) {
        const token = localStorage.getItem('gh_token') || '';
        // Affiche uniquement les 4 derniers caractères pour confirmation visuelle
        const masked = token.length > 4 ? '••••••••' + token.slice(-4) : '••••';
        el.innerHTML =
            '<span style="color:#27ae60; font-weight:bold;">'
            + '<i class="fas fa-check-circle"></i> Clé enregistrée</span>'
            + ' <span style="color:#888; font-size:0.9em;">(' + masked + ')</span>';
    } else {
        el.innerHTML =
            '<span style="color:#e74c3c;">'
            + '<i class="fas fa-times-circle"></i> Aucune clé</span>';
    }
}

// --- GESTION LOCALSTORAGE ---
function getPendingData() {
    return JSON.parse(localStorage.getItem('pending_frelons') || "[]");
}

function addToLocal() {
    const date = document.getElementById('new-date').value;
    const lieu = document.getElementById('new-lieu').value;
    const nombre = parseInt(document.getElementById('new-nombre').value);

    if (!date || !lieu || !nombre) {
        alert("Veuillez remplir tous les champs");
        return;
    }

    const newItem = { date, lieu, nombre };
    const list = getPendingData();
    list.push(newItem);
    
    localStorage.setItem('pending_frelons', JSON.stringify(list));
    renderPendingList();
    
    document.getElementById('new-lieu').value = "";
    document.getElementById('new-nombre').value = "1";
}

function renderPendingList() {
    const list = getPendingData();
    const ul = document.getElementById('pending-list');
    ul.innerHTML = "";

    if (list.length === 0) {
        ul.innerHTML = "<li>Aucune donnée en attente.</li>";
        return;
    }

    list.forEach((item, index) => {
        ul.innerHTML += `<li>${item.date} - ${item.lieu} (${item.nombre}) <button onclick="deleteLocal(${index})" style="width:auto; padding:2px 5px; font-size:0.8em; background:red;">X</button></li>`;
    });
}

function deleteLocal(index) {
    const list = getPendingData();
    list.splice(index, 1);
    localStorage.setItem('pending_frelons', JSON.stringify(list));
    renderPendingList();
}

// --- UTILITAIRES BASE64 / UTF-8 ---
function utf8_to_b64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
}

function b64_to_utf8(str) {
    // GitHub insère des \n dans le base64 — il faut les retirer avant atob()
    return decodeURIComponent(escape(window.atob(str.replace(/\n/g, ''))));
}

async function getActiveCampaign(apiBase, headers) {
    const fallback = { year: new Date().getFullYear(), type: 'spring', dataFile: CONFIG.githubFilePath };
    try {
        const r = await fetch(apiBase + 'campaign.json', { headers });
        if (!r.ok) return fallback;
        const f = await r.json();
        const c = JSON.parse(b64_to_utf8(f.content));
        return {
            ...c,
            type: c.type || 'spring',
            dataFile: c.dataFile || CONFIG.githubFilePath
        };
    } catch (e) {
        return fallback;
    }
}

// --- SYNCHRONISATION GITHUB ---
async function syncToGithub() {
    const token = localStorage.getItem('gh_token');
    const status = document.getElementById('sync-status');
    const pendingData = getPendingData();

    if (!token) {
        alert("Erreur : Veuillez renseigner votre Token GitHub dans la configuration.");
        return;
    }
    if (pendingData.length === 0) {
        alert("Rien à envoyer !");
        return;
    }

    status.innerText = "⏳ Connexion à GitHub...";
    const btn = document.getElementById('btn-sync');
    btn.disabled = true;

    try {
        const apiBase = `https://api.github.com/repos/${CONFIG.githubUser}/${CONFIG.githubRepo}/contents/`;
        const hdrs = { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' };
        const camp = await getActiveCampaign(apiBase, hdrs);
        const apiUrl = apiBase + camp.dataFile;

        status.innerText = `⏳ Envoi vers ${camp.dataFile}...`;

        const response = await fetch(apiUrl, {
            headers: { 
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) throw new Error(`Impossible de lire ${camp.dataFile} (Vérifiez votre Token et le nom du repo)`);

        const fileData = await response.json();
        const currentSha = fileData.sha;
        let currentContent = JSON.parse(b64_to_utf8(fileData.content));
        const newContent = currentContent.concat(pendingData);

        const putBody = {
            message: `Mise à jour via Admin Panel : ${pendingData.length} ajouts`,
            content: utf8_to_b64(JSON.stringify(newContent, null, 2)),
            sha: currentSha
        };

        const updateResponse = await fetch(apiUrl, {
            method: 'PUT',
            headers: { 
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(putBody)
        });

        if (!updateResponse.ok) throw new Error("Erreur lors de l'écriture sur GitHub");

        status.innerHTML = `<span class='success'>✅ ${pendingData.length} ajout(s) envoyé(s) vers <strong>${camp.dataFile}</strong>. Le site sera à jour dans 1 ou 2 minutes.</span>`;
        localStorage.removeItem('pending_frelons');
        renderPendingList();

    } catch (error) {
        console.error(error);
        status.innerHTML = `<span class='error'>❌ Erreur : ${error.message}</span>`;
    } finally {
        btn.disabled = false;
    }
}

// --- ARCHIVAGE DE SAISON ---
async function archiveSeason() {
    const token = localStorage.getItem('gh_token');
    const status = document.getElementById('archive-status');

    if (!token) {
        alert("Erreur : Veuillez renseigner votre Token GitHub avant d'archiver.");
        return;
    }

    const apiBase = `https://api.github.com/repos/${CONFIG.githubUser}/${CONFIG.githubRepo}/contents/`;
    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    // Campagne active : détermine le type et le fichier de données
    const camp = await getActiveCampaign(apiBase, headers);
    const campType   = camp.type;
    const activeFile = camp.dataFile;
    const typeLabel  = campType === 'autumn' ? "d'automne" : 'de printemps';

    const yearInput = prompt(
        `Archiver la campagne ${typeLabel} (fichier ${activeFile}).\nEntrez l'année :`,
        camp.year
    );
    if (!yearInput) return;
    const year = parseInt(yearInput);
    if (isNaN(year)) { alert("Année invalide."); return; }

    // Printemps : nom historique conservé ; automne : suffixe pour ne rien écraser
    const archivePath = campType === 'autumn'
        ? `archives/${year}_automne.json`
        : `archives/${year}.json`;

    const confirmed = confirm(
        `⚠️ Vous êtes sur le point d'archiver la campagne ${typeLabel} ${year}.\n\n` +
        `Cela va :\n` +
        `  • Copier ${activeFile} → ${archivePath}\n` +
        `  • Mettre à jour l'index archives.json\n` +
        `  • Réinitialiser ${activeFile} à []\n` +
        `  • Passer campaign.json en statut "fermé"\n\n` +
        `Cette action est irréversible. Continuer ?`
    );
    if (!confirmed) return;

    status.innerText = "⏳ Archivage en cours...";
    const btn = document.getElementById('btn-archive');
    btn.disabled = true;

    try {
        // 1. Lire le fichier de données actif
        const dataResp = await fetch(apiBase + activeFile, { headers });
        if (!dataResp.ok) throw new Error(`Impossible de lire ${activeFile}`);
        const dataFile = await dataResp.json();
        const currentData = JSON.parse(b64_to_utf8(dataFile.content));
        const total = currentData.reduce((acc, item) => acc + item.nombre, 0);

        // Garde-fou : ne pas archiver un fichier vide par erreur
        if (currentData.length === 0 &&
            !confirm(`${activeFile} est vide. Archiver quand même une saison à 0 capture ?`)) {
            btn.disabled = false;
            status.innerText = '';
            return;
        }

        status.innerText = `⏳ Écriture de ${archivePath}... (${total} captures)`;

        // 2. Écrire l'archive
        let archiveSha = null;
        try {
            const existResp = await fetch(apiBase + archivePath, { headers });
            if (existResp.ok) {
                const existFile = await existResp.json();
                archiveSha = existFile.sha;
            }
        } catch(e) { /* Fichier n'existe pas encore, c'est normal */ }

        const archiveBody = {
            message: `Archive ${typeLabel} ${year} - ${total} captures`,
            content: utf8_to_b64(JSON.stringify(currentData, null, 2)),
            ...(archiveSha && { sha: archiveSha })
        };

        const archiveResp = await fetch(apiBase + archivePath, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(archiveBody)
        });
        if (!archiveResp.ok) throw new Error(`Erreur lors de l'écriture de ${archivePath}`);

        status.innerText = "⏳ Mise à jour de l'index des archives...";

        // 3. Index archives.json (avec le type)
        let archivesIndex = [];
        let archivesIndexSha = null;
        try {
            const indexResp = await fetch(apiBase + 'archives.json', { headers });
            if (indexResp.ok) {
                const indexFile = await indexResp.json();
                archivesIndex = JSON.parse(b64_to_utf8(indexFile.content));
                archivesIndexSha = indexFile.sha;
            }
        } catch(e) { /* Pas encore d'index */ }

        const entry = { year, type: campType, total, file: archivePath };
        const existingIdx = archivesIndex.findIndex(
            a => a.year === year && (a.type || 'spring') === campType
        );
        if (existingIdx >= 0) archivesIndex[existingIdx] = entry;
        else archivesIndex.push(entry);
        archivesIndex.sort((a, b) => b.year - a.year);

        const indexBody = {
            message: `Mise à jour index archives - ${typeLabel} ${year}`,
            content: utf8_to_b64(JSON.stringify(archivesIndex, null, 2)),
            ...(archivesIndexSha && { sha: archivesIndexSha })
        };

        const indexResp2 = await fetch(apiBase + 'archives.json', {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(indexBody)
        });
        if (!indexResp2.ok) throw new Error("Erreur lors de la mise à jour de archives.json");

        status.innerText = `⏳ Réinitialisation de ${activeFile}...`;

        // 4. Réinitialiser le fichier de données actif
        const resetBody = {
            message: `Réinitialisation de ${activeFile} après archivage ${typeLabel} ${year}`,
            content: utf8_to_b64(JSON.stringify([], null, 2)),
            sha: dataFile.sha
        };

        const resetResp = await fetch(apiBase + activeFile, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(resetBody)
        });
        if (!resetResp.ok) throw new Error(`Erreur lors de la réinitialisation de ${activeFile}`);

        // 5. campaign.json → statut fermé (type et dataFile conservés via ...campCurrent)
        status.innerText = "⏳ Mise à jour du statut de campagne...";
        let campSha = null;
        let campCurrent = { ...camp };
        try {
            const campResp = await fetch(apiBase + 'campaign.json', { headers });
            if (campResp.ok) {
                const campFile = await campResp.json();
                campSha = campFile.sha;
                campCurrent = JSON.parse(b64_to_utf8(campFile.content));
            }
        } catch(e) {}

        const campBody = {
            message: `Clôture campagne ${typeLabel} ${year} — campaign.json`,
            content: utf8_to_b64(JSON.stringify({
                ...campCurrent,
                year,
                status: 'closed',
                dateCloture: new Date().toISOString().slice(0, 10),
                message: `La campagne ${typeLabel} ${year} est terminée. Merci pour votre participation !`
            }, null, 2)),
            ...(campSha && { sha: campSha })
        };
        const campResp2 = await fetch(apiBase + 'campaign.json', {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(campBody)
        });
        if (!campResp2.ok) throw new Error("Archive faite, mais campaign.json n'a pas pu être fermé");

        status.innerHTML = `
            <span class='success'>
                ✅ Campagne ${typeLabel} ${year} archivée ! (${total} captures)<br>
                ${activeFile} réinitialisé — campaign.json passé en statut "fermé".<br>
                <a href="archives.html" style="color:#27ae60;">→ Voir les archives</a>
            </span>`;

        localStorage.removeItem('pending_frelons');
        renderPendingList();

    } catch (error) {
        console.error(error);
        status.innerHTML = `<span class='error'>❌ Erreur : ${error.message}</span>`;
    } finally {
        btn.disabled = false;
    }
}

// L'initialisation est gérée par initAdminPanel() dans admin.html
