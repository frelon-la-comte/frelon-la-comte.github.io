// Fichier d'authentification
// Les mots de passe sont hashés en SHA256

const users = {

	"Thomas":"c498bfb76b6522f7593d129037cfcf763b470c620cc95062a1e21d6cd81415a8",
	"Catherine":"e57d45172320c4147032444831a60383210a060f29da18d9cd1ac5f03cd197df"
    // Format: "username": "SHA256_hash_du_mot_de_passe"
    
    // Exemple: utilisateur "apiculteur" avec mot de passe "ruche2024"
    // Hash SHA256 de "ruche2024": ceffbe62205c7a6b59f7d54b2b38b35390d5047cd75a6a8e9aca9c453802c1fe
    "apiculteur": "ceffbe62205c7a6b59f7d54b2b38b35390d5047cd75a6a8e9aca9c453802c1fe",
    
    // Pour ajouter un nouvel utilisateur, générez le hash SHA256 de votre mot de passe
    // Vous pouvez utiliser ce site: https://emn178.github.io/online-tools/sha256.html
    // Puis ajoutez la ligne: "nom_utilisateur": "hash_sha256_du_mot_de_passe"
};

// Fonction pour hasher avec SHA256
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Fonction d'authentification
async function authenticate(username, password) {
    if (!users[username]) {
        return false;
    }
    
    const hashedPassword = await sha256(password);
    return hashedPassword === users[username];
}

// Vérifier si l'utilisateur est connecté
function checkAuth() {
    return sessionStorage.getItem('authenticated') === 'true';
}

// Déconnexion
function logout() {
    sessionStorage.removeItem('authenticated');
    sessionStorage.removeItem('username');
    window.location.href = 'index.html';
}
