document.addEventListener('DOMContentLoaded', () => {
    loadCampaignAndInit();
});

// ── CHARGEMENT CAMPAGNE ────────────────────────────────────────────────────
async function loadCampaignAndInit() {
    try {
        const resp = await fetch('campaign.json');
        const campaign = await resp.json();

        // Mise à jour de l'étiquette d'année (Saison XXXX)
        const yearLabel = document.getElementById('current-year-label');
        if (yearLabel) yearLabel.innerText = `— Saison ${campaign.year}`;

        if (campaign.status === 'closed') {
            // ── Campagne fermée : bloquer le formulaire ──
            blockFormClosed(campaign);
            // On charge quand même la météo et les stats (lecture seule)
            fetchWeather();
            loadTrappingData();
        } else {
            // ── Campagne ouverte ──
            fetchWeather();
            loadTrappingData();
        }
    } catch(e) {
        // Pas de campaign.json → comportement par défaut
        console.warn('campaign.json introuvable, mode ouvert par défaut');
        const yearLabel = document.getElementById('current-year-label');
        if (yearLabel) yearLabel.innerText = `— Saison ${new Date().getFullYear()}`;
        fetchWeather();
        loadTrappingData();
    }
}

function blockFormClosed(campaign) {
    const authSection = document.getElementById('auth-section');
    const form        = document.getElementById('signalement-form');

    const msg = campaign.message
        || `La campagne ${campaign.year} est officiellement clôturée. La prochaine saison ouvrira prochainement.`;

    const banner = `
        <div style="
            background: #fff3cd;
            border-left: 5px solid #f39c12;
            border-radius: 6px;
            padding: 14px 16px;
            margin-top: 10px;
            color: #856404;
            font-size: 0.95em;">
            <strong><i class='fas fa-lock'></i> Campagne ${campaign.year} clôturée</strong><br>
            <span style='margin-top:6px; display:block;'>${msg}</span>
            ${campaign.dateOuverture
                ? `<span style='font-size:0.85em; margin-top:6px; display:block;'>
                   <i class='fas fa-calendar-alt'></i>
                   Prochaine ouverture prévue : <strong>${campaign.dateOuverture}</strong></span>`
                : ''}
        </div>`;

    if (authSection) authSection.innerHTML = banner;
    if (form)        form.style.display = 'none';
}

// --- 1. GESTION MÉTÉO — Moyenne diurne sur 5 jours (lever → coucher du soleil) ---
async function fetchWeather() {
    const statusDiv = document.getElementById('weather-status');

    // On demande 5 jours (4 passés + aujourd'hui) :
    //   - hourly=temperature_2m  → relevés heure par heure
    //   - daily=sunrise,sunset   → lever/coucher précis pour filtrer les heures nocturnes
    const url = `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}` +
        `&hourly=temperature_2m` +
        `&daily=sunrise,sunset` +
        `&past_days=4&forecast_days=1` +
        `&timezone=auto`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Index rapide : "YYYY-MM-DDTHH:00" → température
        const hourlyIndex = {};
        data.hourly.time.forEach((t, i) => {
            hourlyIndex[t] = data.hourly.temperature_2m[i];
        });

        // Pour chaque jour, calcule la moyenne des heures entre sunrise et sunset
        const dailyDiurnal = data.daily.time.map((date, i) => {
            const sunrise = new Date(data.daily.sunrise[i]);
            const sunset  = new Date(data.daily.sunset[i]);

            const dayTemps = [];
            const cursor = new Date(sunrise);
            cursor.setMinutes(0, 0, 0);

            while (cursor <= sunset) {
                const localKey = `${date}T${String(cursor.getHours()).padStart(2, '0')}:00`;
                const temp = hourlyIndex[localKey];
                if (temp !== undefined && temp !== null) dayTemps.push(temp);
                cursor.setHours(cursor.getHours() + 1);
            }

            return dayTemps.length > 0
                ? dayTemps.reduce((a, b) => a + b, 0) / dayTemps.length
                : null;
        }).filter(v => v !== null);

        // Moyenne des moyennes diurnes sur les 5 jours
        const avg = (dailyDiurnal.reduce((a, b) => a + b, 0) / dailyDiurnal.length).toFixed(1);

        let html = `<p>Moyenne diurne (5 jours, lever → coucher du soleil) : <strong>${avg}°C</strong></p>`;

        if (avg >= 10) {
            html += `<div class="status-go"><i class="fas fa-exclamation-triangle"></i> ALERTE : Conditions favorables au vol des fondatrices ! Vérifiez vos pièges.</div>`;
        } else {
            html += `<div class="status-stop"><i class="fas fa-snowflake"></i> CALME : Températures trop basses pour un vol actif.</div>`;
        }
        statusDiv.innerHTML = html;

    } catch (error) {
        statusDiv.innerHTML = "Impossible de récupérer la météo.";
        console.error(error);
    }
}

// --- 2. GESTION DONNÉES PIÉGEAGE AVEC PAGINATION ---
let allTrappingData = [];
let currentPage = 0;
const PAGE_SIZE = 5;

async function loadTrappingData() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        
        // Tri du plus récent au plus ancien
        allTrappingData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const totalSpan = document.getElementById('total-count');
        const total = data.reduce((acc, item) => acc + item.nombre, 0);
        totalSpan.innerText = total;

        currentPage = 0;
        renderPage();

    } catch (e) {
        console.log("Pas encore de données ou erreur JSON");
        document.getElementById('stats-container').innerHTML = '<p style="color:#999; font-style:italic;">Aucune capture enregistrée pour le moment.</p>';
    }
}

function renderPage() {
    const container = document.getElementById('stats-container');
    const totalPages = Math.ceil(allTrappingData.length / PAGE_SIZE);
    const start = currentPage * PAGE_SIZE;
    const pageData = allTrappingData.slice(start, start + PAGE_SIZE);

    if (allTrappingData.length === 0) {
        container.innerHTML = '<p style="color:#999; font-style:italic;">Aucune capture enregistrée pour le moment.</p>';
        return;
    }

    let html = '<ul class="capture-list">';
    pageData.forEach(item => {
        html += `
            <li class="capture-item">
                <span class="capture-date"><i class="fas fa-calendar-alt"></i> ${item.date}</span>
                <span class="capture-info">${item.nombre} frelon(s) — <em>${item.lieu}</em></span>
            </li>`;
    });
    html += '</ul>';

    if (totalPages > 1) {
        html += `
            <div class="pagination">
                <button onclick="changePage(-1)" ${currentPage === 0 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Précédent
                </button>
                <span class="page-indicator">Volet ${currentPage + 1} / ${totalPages}</span>
                <button onclick="changePage(1)" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>
                    Suivant <i class="fas fa-chevron-right"></i>
                </button>
            </div>`;
    }

    container.innerHTML = html;
}

function changePage(delta) {
    const totalPages = Math.ceil(allTrappingData.length / PAGE_SIZE);
    currentPage = Math.max(0, Math.min(currentPage + delta, totalPages - 1));
    renderPage();
}

// --- 3. AUTHENTIFICATION PARTICIPANT ---
async function verifyParticipant() {
    const id = document.getElementById('user-id').value.toLowerCase().trim();
    const street = document.getElementById('user-street-nb').value.trim();
    const combined = id + street;
    
    try {
        const hashedInput = await sha256(combined);
        const response = await fetch('users.json');
        const authorizedUsers = await response.json();

        if (authorizedUsers.includes(hashedInput)) {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('signalement-form').style.display = 'block';
        } else {
            document.getElementById('auth-error').style.display = 'block';
        }
    } catch (error) {
        console.error("Erreur technique :", error);
        alert("Le système de vérification ne peut pas fonctionner en local. Veuillez tester sur le site GitHub (HTTPS).");
    }
}