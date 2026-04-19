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
    } else {
        errorMsg.style.display = 'block';
    }
}

function logout() {
    sessionStorage.removeItem('isLoggedIn');
    location.reload();
}

// --- GESTION DU TOKEN ---
function saveToken() {
    const token = document.getElementById('github-token').value;
    if(token) {
        localStorage.setItem('gh_token', token);
        document.getElementById('token-status').innerText = "Token sauvegardé !";
        document.getElementById('token-status').style.color = "green";
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
    return decodeURIComponent(escape(window.atob(str)));
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
        const apiUrl = `https://api.github.com/repos/${CONFIG.githubUser}/${CONFIG.githubRepo}/contents/${CONFIG.githubFilePath}`;
        
        const response = await fetch(apiUrl, {
            headers: { 
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) throw new Error("Impossible de lire data.json (Vérifiez votre Token et le nom du repo)");

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

        status.innerHTML = "<span class='success'>✅ Données mises à jour avec succès ! Le site sera à jour dans 1 ou 2 minutes.</span>";
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

    const currentYear = new Date().getFullYear();
    const yearInput = prompt(
        `Quelle saison souhaitez-vous archiver ?\n(Entrez l'année, ex: ${currentYear - 1})`,
        currentYear - 1
    );
    if (!yearInput) return;
    const year = parseInt(yearInput);
    if (isNaN(year)) { alert("Année invalide."); return; }

    const confirmed = confirm(
        `⚠️ Vous êtes sur le point d'archiver la saison ${year}.\n\n` +
        `Cela va :\n` +
        `  • Copier data.json → archives/${year}.json\n` +
        `  • Mettre à jour l'index archives.json\n` +
        `  • Réinitialiser data.json à [] pour la nouvelle saison\n\n` +
        `Cette action est irréversible. Continuer ?`
    );
    if (!confirmed) return;

    status.innerText = "⏳ Archivage en cours...";
    const btn = document.getElementById('btn-archive');
    btn.disabled = true;

    const apiBase = `https://api.github.com/repos/${CONFIG.githubUser}/${CONFIG.githubRepo}/contents/`;
    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    try {
        // 1. Lire data.json actuel
        const dataResp = await fetch(apiBase + CONFIG.githubFilePath, { headers });
        if (!dataResp.ok) throw new Error("Impossible de lire data.json");
        const dataFile = await dataResp.json();
        const currentData = JSON.parse(b64_to_utf8(dataFile.content));
        const total = currentData.reduce((acc, item) => acc + item.nombre, 0);

        status.innerText = `⏳ Écriture de l'archive ${year}.json... (${total} captures)`;

        // 2. Écrire archives/YEAR.json
        const archivePath = `archives/${year}.json`;
        let archiveSha = null;
        try {
            const existResp = await fetch(apiBase + archivePath, { headers });
            if (existResp.ok) {
                const existFile = await existResp.json();
                archiveSha = existFile.sha;
            }
        } catch(e) { /* Fichier n'existe pas encore, c'est normal */ }

        const archiveBody = {
            message: `Archive saison ${year} - ${total} fondatrices piégées`,
            content: utf8_to_b64(JSON.stringify(currentData, null, 2)),
            ...(archiveSha && { sha: archiveSha })
        };

        const archiveResp = await fetch(apiBase + archivePath, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(archiveBody)
        });
        if (!archiveResp.ok) throw new Error(`Erreur lors de l'écriture de archives/${year}.json`);

        status.innerText = "⏳ Mise à jour de l'index des archives...";

        // 3. Mettre à jour archives.json (index)
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

        const entry = { year, total, file: archivePath };
        const existingIdx = archivesIndex.findIndex(a => a.year === year);
        if (existingIdx >= 0) archivesIndex[existingIdx] = entry;
        else archivesIndex.push(entry);
        archivesIndex.sort((a, b) => b.year - a.year);

        const indexBody = {
            message: `Mise à jour index archives - saison ${year}`,
            content: utf8_to_b64(JSON.stringify(archivesIndex, null, 2)),
            ...(archivesIndexSha && { sha: archivesIndexSha })
        };

        const indexResp2 = await fetch(apiBase + 'archives.json', {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(indexBody)
        });
        if (!indexResp2.ok) throw new Error("Erreur lors de la mise à jour de archives.json");

        status.innerText = `⏳ Réinitialisation de data.json pour la saison ${year + 1}...`;

        // 4. Réinitialiser data.json
        const resetBody = {
            message: `🌱 Nouvelle saison ${year + 1} - Réinitialisation des données`,
            content: utf8_to_b64(JSON.stringify([], null, 2)),
            sha: dataFile.sha
        };

        const resetResp = await fetch(apiBase + CONFIG.githubFilePath, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(resetBody)
        });
        if (!resetResp.ok) throw new Error("Erreur lors de la réinitialisation de data.json");

        // Succès
        status.innerHTML = `
            <span class='success'>
                ✅ Saison ${year} archivée avec succès ! (${total} captures enregistrées)<br>
                data.json réinitialisé pour la saison ${year + 1}.<br>
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

// Charger la liste au démarrage si déjà logué
if(sessionStorage.getItem('isLoggedIn') === 'true') {
    renderPendingList();
}