// ============================================================
// LGA - AUTHENTIFICATION
// Protection par mot de passe (hash SHA-256 côté client)
// Session conservée dans sessionStorage (onglet courant seulement)
// ============================================================

const SESSION_KEY = 'lga_authenticated';

// ----------------------------------------------------------
// Vérifie si l'utilisateur est déjà authentifié dans cet onglet
// ----------------------------------------------------------
function estAuthentifie() {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
}

// ----------------------------------------------------------
// Hash SHA-256 via l'API Web Crypto native (aucune dépendance)
// ----------------------------------------------------------
async function sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// ----------------------------------------------------------
// Crée et injecte l'overlay de connexion dans le DOM
// ----------------------------------------------------------
function creerOverlayConnexion() {
    const overlay = document.createElement('div');
    overlay.id = 'lga-auth-overlay';
    overlay.innerHTML = `
        <div id="lga-auth-box">
            <div id="lga-auth-logo">🐝</div>
            <h1>LGA</h1>
            <p>Logiciel de Gestion Apicole</p>
            <div id="lga-auth-form">
                <input
                    type="password"
                    id="lga-password-input"
                    placeholder="Mot de passe"
                    autocomplete="current-password"
                />
                <button id="lga-login-btn" onclick="tenterConnexion()">
                    Se connecter
                </button>
                <div id="lga-auth-error" style="display:none;">
                    ❌ Mot de passe incorrect
                </div>
            </div>
        </div>
    `;

    // Styles inline pour que l'overlay fonctionne sans CSS externe
    const style = document.createElement('style');
    style.textContent = `
        #lga-auth-overlay {
            position: fixed;
            inset: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
        }
        #lga-auth-box {
            background: white;
            border-radius: 16px;
            padding: 50px 40px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 340px;
        }
        #lga-auth-logo {
            font-size: 56px;
            margin-bottom: 10px;
        }
        #lga-auth-box h1 {
            font-size: 28px;
            color: #333;
            margin: 0 0 4px;
            font-family: system-ui, sans-serif;
        }
        #lga-auth-box p {
            color: #888;
            font-size: 14px;
            margin: 0 0 30px;
            font-family: system-ui, sans-serif;
        }
        #lga-password-input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            margin-bottom: 12px;
            box-sizing: border-box;
            transition: border-color 0.2s;
            font-family: system-ui, sans-serif;
        }
        #lga-password-input:focus {
            outline: none;
            border-color: #667eea;
        }
        #lga-login-btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s;
            font-family: system-ui, sans-serif;
        }
        #lga-login-btn:hover { opacity: 0.9; }
        #lga-login-btn:disabled { opacity: 0.6; cursor: default; }
        #lga-auth-error {
            margin-top: 12px;
            color: #dc3545;
            font-size: 14px;
            font-family: system-ui, sans-serif;
        }
        body.lga-locked { overflow: hidden; }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);
    document.body.classList.add('lga-locked');

    // Connexion avec la touche Entrée
    document.getElementById('lga-password-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tenterConnexion();
    });

    // Focus automatique
    setTimeout(() => document.getElementById('lga-password-input').focus(), 100);
}

// ----------------------------------------------------------
// Tentative de connexion : hash le mot de passe et compare
// ----------------------------------------------------------
async function tenterConnexion() {
    const input = document.getElementById('lga-password-input');
    const btn   = document.getElementById('lga-login-btn');
    const error = document.getElementById('lga-auth-error');

    const motDePasse = input.value;
    if (!motDePasse) return;

    btn.disabled = true;
    btn.textContent = '…';
    error.style.display = 'none';

    try {
        const hash = await sha256(motDePasse);

        if (hash === LGA_CONFIG.PASSWORD_HASH) {
            // ✅ Mot de passe correct
            sessionStorage.setItem(SESSION_KEY, 'true');
            document.getElementById('lga-auth-overlay').remove();
            document.body.classList.remove('lga-locked');
        } else {
            // ❌ Mot de passe incorrect
            error.style.display = 'block';
            input.value = '';
            input.focus();
            // Légère animation de secousse
            input.style.borderColor = '#dc3545';
            setTimeout(() => input.style.borderColor = '#e0e0e0', 1000);
        }
    } catch (err) {
        console.error('Erreur lors du hachage:', err);
        error.textContent = 'Erreur technique, rechargez la page.';
        error.style.display = 'block';
    }

    btn.disabled = false;
    btn.textContent = 'Se connecter';
}

// ----------------------------------------------------------
// Point d'entrée : protège la page avant tout chargement
// ----------------------------------------------------------
(function protegerPage() {
    if (!estAuthentifie()) {
        // Bloquer le rendu immédiatement
        document.documentElement.style.visibility = 'hidden';

        document.addEventListener('DOMContentLoaded', () => {
            document.documentElement.style.visibility = '';
            creerOverlayConnexion();
        });
    }
})();
