document.addEventListener('DOMContentLoaded', () => {
    fetchWeather();
    loadTrappingData();
});

// --- 1. GESTION MÉTÉO (API Open-Meteo) ---
async function fetchWeather() {
    const statusDiv = document.getElementById('weather-status');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}&daily=temperature_2m_max&past_days=4&forecast_days=1&timezone=auto`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        const temps = data.daily.temperature_2m_max;
        const sum = temps.reduce((a, b) => a + b, 0);
        const avg = (sum / temps.length).toFixed(1);

        let html = `<p>Température moyenne (5 jours) : <strong>${avg}°C</strong></p>`;
        
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