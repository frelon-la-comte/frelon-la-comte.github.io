document.addEventListener('DOMContentLoaded', () => {
    fetchWeather();
    loadTrappingData();
});

// --- 1. GESTION MÉTÉO (API Open-Meteo) ---
async function fetchWeather() {
    const statusDiv = document.getElementById('weather-status');
    // API: Récupère temp max des 4 derniers jours + aujourd'hui (5 jours total)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}&daily=temperature_2m_max&past_days=4&forecast_days=1&timezone=auto`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        const temps = data.daily.temperature_2m_max; // Tableau des 5 jours
        // Calcul moyenne
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

// --- 2. GESTION DONNÉES PIÉGEAGE ---
async function loadTrappingData() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        
        const container = document.getElementById('stats-container');
        const totalSpan = document.getElementById('total-count');
        
        let total = 0;
        let htmlList = '<ul>';
        
        data.forEach(item => {
            total += item.nombre;
            htmlList += `<li><strong>${item.date}</strong> : ${item.nombre} frelon(s) à ${item.lieu}</li>`;
        });
        
        htmlList += '</ul>';
        
        container.innerHTML = htmlList;
        totalSpan.innerText = total;

    } catch (e) {
        console.log("Pas encore de données ou erreur JSON");
    }

}

async function verifyParticipant() {
    const id = document.getElementById('user-id').value.toLowerCase().trim();
    const street = document.getElementById('user-street-nb').value.trim();
    const combined = id + street;
    
    // Génère le hash de la saisie
    const hashedInput = await sha256(combined);
    
    // Charge la liste des utilisateurs autorisés
    const response = await fetch('users.json');
    const authorizedUsers = await response.json();

    if (authorizedUsers.includes(hashedInput)) {
        // Succès : on montre le formulaire et on cache l'auth
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('signalement-form').style.display = 'block';
    } else {
        document.getElementById('auth-error').style.display = 'block';
    }
}
