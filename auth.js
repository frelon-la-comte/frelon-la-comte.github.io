async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkLogin() {
    const inputPass = document.getElementById('admin-pass').value;
    const errorMsg = document.getElementById('error-msg');
    
    // Hash l'entrée utilisateur et compare avec la config
    const hashedInput = await sha256(inputPass);

    if (hashedInput === CONFIG.adminHash) {
        // Succès
        document.getElementById('login-panel').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        errorMsg.style.display = 'none';
        
        // Optionnel: Sauvegarder la session dans sessionStorage
        sessionStorage.setItem('isLoggedIn', 'true');
    } else {
        // Échec
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

// --- GESTION LOCALSTORAGE (Ajout temporaire) ---
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
    
    // Reset champs
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

// --- GESTION API GITHUB (Le gros morceau) ---
// Fonction utilitaire pour encoder en Base64 avec support des accents (UTF-8)
function utf8_to_b64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
}

function b64_to_utf8(str) {
    return decodeURIComponent(escape(window.atob(str)));
}

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
        // 1. Récupérer le fichier data.json actuel sur GitHub (pour ne pas écraser les anciennes données)
        const apiUrl = `https://api.github.com/repos/${CONFIG.githubUser}/${CONFIG.githubRepo}/contents/${CONFIG.githubFilePath}`;
        
        const response = await fetch(apiUrl, {
            headers: { 
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) throw new Error("Impossible de lire data.json (Vérifiez votre Token et le nom du repo)");

        const fileData = await response.json();
        const currentSha = fileData.sha; // Important pour dire à GitHub "je modifie CETTE version"
        
        // Décoder le contenu actuel (qui est en Base64)
        let currentContent = JSON.parse(b64_to_utf8(fileData.content));

        // 2. Fusionner les données (Anciennes + Nouvelles du localStorage)
        const newContent = currentContent.concat(pendingData);

        // 3. Renvoyer le tout à GitHub
        const putBody = {
            message: `Mise à jour via Admin Panel : ${pendingData.length} ajouts`,
            content: utf8_to_b64(JSON.stringify(newContent, null, 2)), // Encoder en Base64 propre
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

        // SUCCÈS !
        status.innerHTML = "<span class='success'>✅ Données mises à jour avec succès ! Le site sera à jour dans 1 ou 2 minutes.</span>";
        
        // Vider le localStorage
        localStorage.removeItem('pending_frelons');
        renderPendingList();

    } catch (error) {
        console.error(error);
        status.innerHTML = `<span class='error'>❌ Erreur : ${error.message}</span>`;
    } finally {
        btn.disabled = false;
    }
}

// Charger la liste au démarrage si on est déjà logué
if(sessionStorage.getItem('isLoggedIn') === 'true') {
    renderPendingList();
}