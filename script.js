document.addEventListener('DOMContentLoaded', () => {
    loadCampaignAndInit();
});

function adaptLabels(type) {
    if (type !== 'autumn') return;

    const sigIntro = document.getElementById('signalement-intro');
    if (sigIntro) sigIntro.textContent = 'Vous avez piégé des frelons ? Signalez-le nous.';

    // Titre du suivi
    const statsTitle = document.getElementById('stats-container')
        ?.closest('section')?.querySelector('h2');
    if (statsTitle) statsTitle.innerHTML =
        '<i class="fas fa-chart-bar"></i> Suivi des Piégeages d\'automne <span id="current-year-label"></span>';

    // Compteur
    const totalLine = document.querySelector('.total-line');
    if (totalLine) totalLine.innerHTML =
        '<strong>Total captures : <span id="total-count">0</span></strong>';

    const meteoTitle = document.querySelector('#meteo-indicator h2');
    if (meteoTitle) meteoTitle.innerHTML =
        '<i class="fas fa-thermometer-half"></i> Météo des 5 derniers jours';

    // Texte d'accroche du formulaire
    const intro = document.querySelector('#auth-section p');
    if (intro) intro.textContent = 'Veuillez vous identifier pour signaler une capture :';

    // Encart explicatif
    const stats = document.getElementById('stats-container')?.closest('section');
    if (stats) {
        const box = document.createElement('div');
        box.style.cssText = 'background:#fff3cd;border-left:4px solid #f39c12;padding:10px 14px;margin:10px 0;border-radius:4px;font-size:0.88em;color:#856404;';
        box.innerHTML = '<i class="fas fa-info-circle"></i> <strong>Campagne d\'automne :</strong> les individus piégés peuvent être de futures fondatrices ou des ouvrières, difficilement distinguables. Les chiffres sont donnés à titre indicatif.';
        stats.querySelector('.stats-header')?.after(box);
    }
}

// ── CHARGEMENT CAMPAGNE ────────────────────────────────────────────────────
let currentCampaign = null;

async function loadCampaignAndInit() {
    try {
        const resp = await fetch('campaign.json?v=' + Date.now());
        currentCampaign = await resp.json();
        currentCampaign.type     = currentCampaign.type     || 'spring';
        currentCampaign.dataFile = currentCampaign.dataFile || 'data.json';

        // sinon il recrée le <span id="current-year-label"> vide
        adaptLabels(currentCampaign.type);

        const yearLabel = document.getElementById('current-year-label');
        if (yearLabel) {
            const prefix = currentCampaign.type === 'autumn' ? 'Automne' : 'Saison';
            yearLabel.innerText = `— ${prefix} ${currentCampaign.year}`;
        }

        if (currentCampaign.status === 'closed') blockFormClosed(currentCampaign);
        fetchWeather(currentCampaign);
        loadTrappingData(currentCampaign.dataFile);

    } catch(e) {
        console.warn('campaign.json introuvable, mode printemps par défaut');
        currentCampaign = { year: new Date().getFullYear(), type: 'spring', dataFile: 'data.json' };
        const yearLabel = document.getElementById('current-year-label');
        if (yearLabel) yearLabel.innerText = `— Saison ${currentCampaign.year}`;
        fetchWeather(null);
        loadTrappingData('data.json');
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
async function fetchWeather(campaign) {
    const statusDiv = document.getElementById('weather-status');

    // ── Banderole statut campagne ──
    let campagneBanner = '';
    if (campaign) {
        if (campaign.status === 'closed') {
            campagneBanner = `
                <div style="
                    background: #f8d7da;
                    border-left: 5px solid #e74c3c;
                    border-radius: 6px;
                    padding: 10px 14px;
                    margin-bottom: 12px;
                    color: #721c24;
                    font-size: 0.9em;
                    display: flex;
                    align-items: center;
                    gap: 10px;">
                    <i class="fas fa-lock" style="font-size:1.2em;"></i>
                    <div>
                        <strong>Campagne ${campaign.year} clôturée</strong>
                        ${campaign.dateCloture ? `<span style="margin-left:8px; font-size:0.85em; opacity:0.8;">(le ${campaign.dateCloture})</span>` : ''}
                        ${campaign.dateOuverture ? `<br><span style="font-size:0.85em;">Prochaine ouverture prévue : <strong>${campaign.dateOuverture}</strong></span>` : ''}
                    </div>
                </div>`;
        } else {
            campagneBanner = `
                <div style="
                    background: #d4edda;
                    border-left: 5px solid #27ae60;
                    border-radius: 6px;
                    padding: 10px 14px;
                    margin-bottom: 12px;
                    color: #155724;
                    font-size: 0.9em;
                    display: flex;
                    align-items: center;
                    gap: 10px;">
                    <i class="fas fa-leaf" style="font-size:1.2em;"></i>
                    <div>
                        <strong>Campagne ${campaign.year} en cours</strong>
                        ${campaign.dateCloture ? `<br><span style="font-size:0.85em;">Clôture prévue le : <strong>${campaign.dateCloture}</strong></span>` : ''}
                    </div>
                </div>`;
        }
    }

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

        let html = campagneBanner;
        html += `<p>Moyenne diurne (5 jours, lever → coucher du soleil) : <strong>${avg}°C</strong></p>`;

        if (campaign && campaign.type === 'autumn') {
            html += `<div style="background:#eaf2f8;border-left:4px solid #2980b9;padding:10px 14px;border-radius:4px;font-size:0.9em;color:#1b4f72;">
                        <i class="fas fa-info-circle"></i> Information météo à titre indicatif.</div>`;
        } else if (avg >= 10) {
            html += `<div class="status-go"><i class="fas fa-exclamation-triangle"></i> ALERTE : Conditions favorables au vol des fondatrices ! Vérifiez vos pièges.</div>`;
        } else {
            html += `<div class="status-stop"><i class="fas fa-snowflake"></i> CALME : Températures trop basses pour un vol actif.</div>`;
        }
        statusDiv.innerHTML = html;

    } catch (error) {
        statusDiv.innerHTML = campagneBanner + "Impossible de récupérer la météo.";
        console.error(error);
    }
}

// --- 2. GESTION DONNÉES PIÉGEAGE AVEC PAGINATION ---
let allTrappingData = [];
let currentPage = 0;
const PAGE_SIZE = 5;

async function loadTrappingData(dataFile = 'data.json') {
    try {
        const response = await fetch(dataFile + '?v=' + Date.now());
        const data = await response.json();
        
        // Tri du plus récent au plus ancien
        allTrappingData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const totalSpan = document.getElementById('total-count');
        const total = data.reduce((acc, item) => acc + item.nombre, 0);
        totalSpan.innerText = total;

        currentPage = 0;
        renderPage();

    } catch (e) {
        console.error("loadTrappingData :", e);
        document.getElementById('stats-container').innerHTML = '<p style="color:#999; font-style:italic;">Aucune capture enregistrée pour le moment.</p>';
    }
}

function renderPage() {
    const container = document.getElementById('stats-container');
    const totalPages = Math.ceil(allTrappingData.length / PAGE_SIZE);
    const start = currentPage * PAGE_SIZE;
    const pageData = allTrappingData.slice(start, start + PAGE_SIZE);
    const unit = (currentCampaign?.type === 'autumn') ? 'capture(s)' : 'frelon(s)';

    if (allTrappingData.length === 0) {
        container.innerHTML = '<p style="color:#999; font-style:italic;">Aucune capture enregistrée pour le moment.</p>';
        return;
    }

    let html = '<ul class="capture-list">';
    pageData.forEach(item => {
        html += `
            <li class="capture-item">
                <span class="capture-date"><i class="fas fa-calendar-alt"></i> ${item.date}</span>
                <span class="capture-info">${item.nombre} ${unit} — <em>${item.lieu}</em></span>
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