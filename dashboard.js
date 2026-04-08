document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

// --- COORDONNÉES APPROXIMATIVES DES RUES DE LA COMTÉ (62150) ---
const GPS_MAPPING = {
    "centre": [50.4256, 2.4993],
    "rue de l'église": [50.4282, 2.4915],
    "grande rue": [50.4278, 2.4957],
    "rue jules elby": [50.4282, 2.4985],
    "impasse jules elby": [50.4293, 2.4961],
    "rue du 14 juillet": [50.4270, 2.5039],
    "rue de la petite ville": [50.4254, 2.4987],
    "rue du 8 mai 1945": [50.4215, 2.5022],
    "rue du chateau": [50.4242, 2.5010],
    "rue du 19 mars 1962": [50.4244, 2.4963],
    "rue du 11 novembre": [50.4255, 2.4937],
};

async function initDashboard() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();

        updateKeyFigures(data);
        initMap(data);
        initCharts(data);

    } catch (error) {
        console.error("Erreur chargement données dashboard:", error);
        document.querySelector('main').innerHTML = "<p>Impossible de charger les statistiques.</p>";
    }
}

// 1. CHIFFRES CLÉS
function updateKeyFigures(data) {
    const total = data.reduce((acc, item) => acc + item.nombre, 0);
    document.getElementById('total-stat').innerText = total;

    if (data.length > 0) {
        const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
        document.getElementById('last-date').innerText = sorted[0].date;
    }
}

// 2. CARTE LEAFLET — avec agrégation par lieu
function initMap(data) {
    const map = L.map('map').setView([CONFIG.lat, CONFIG.lon], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // --- AGRÉGATION : on cumule les captures par lieu ---
    const parLieu = {};
    data.forEach(item => {
        const lieuClean = item.lieu.toLowerCase().trim();

        if (!parLieu[lieuClean]) {
            // Coordonnées : connues ou aléatoires autour du centre
            let coords = GPS_MAPPING[lieuClean];
            if (!coords) {
                const offsetLat = (Math.random() - 0.5) * 0.005;
                const offsetLon = (Math.random() - 0.5) * 0.005;
                coords = [CONFIG.lat + offsetLat, CONFIG.lon + offsetLon];
            }
            parLieu[lieuClean] = {
                coords: coords,
                total: 0,
                label: item.lieu, // Garde le nom d'origine (majuscules) pour l'affichage
                dates: []
            };
        }

        parLieu[lieuClean].total += item.nombre;
        parLieu[lieuClean].dates.push(`${item.date} : ${item.nombre} frelon(s)`);
    });

    // --- AFFICHAGE : un seul marqueur par lieu, avec le total agrégé ---
    Object.values(parLieu).forEach(lieu => {
        // Cercle dont le rayon est proportionnel au nombre de captures
        const radius = 8 + lieu.total * 3; // min 11px, grandit avec le total

        const circle = L.circleMarker(lieu.coords, {
            radius: Math.min(radius, 40), // plafond à 40px pour ne pas couvrir la carte
            fillColor: '#d35400',
            color: '#922b00',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.75
        }).addTo(map);

        // Popup détaillée avec le détail par date
        const detailDates = lieu.dates.join('<br>');
        circle.bindPopup(
            `<b>${lieu.label}</b><br>` +
            `<b>Total : ${lieu.total} frelon(s)</b><br>` +
            `<hr style="margin:5px 0">` +
            `<small>${detailDates}</small>`
        );
    });
}

// 3. GRAPHIQUES (CHART.JS)
function initCharts(data) {

    // A. Par date (Timeline)
    const parDate = {};
    data.forEach(item => {
        parDate[item.date] = (parDate[item.date] || 0) + item.nombre;
    });
    const labelsDate = Object.keys(parDate).sort();
    const valuesDate = labelsDate.map(date => parDate[date]);

    // B. Par Lieu (Camembert)
    const parLieu = {};
    data.forEach(item => {
        parLieu[item.lieu] = (parLieu[item.lieu] || 0) + item.nombre;
    });
    const labelsLieu = Object.keys(parLieu);
    const valuesLieu = labelsLieu.map(l => parLieu[l]);

    // --- GRAPHIQUE 1 : ÉVOLUTION ---
    new Chart(document.getElementById('timeChart'), {
        type: 'line',
        data: {
            labels: labelsDate,
            datasets: [{
                label: 'Fondatrices piégées',
                data: valuesDate,
                borderColor: '#d35400',
                backgroundColor: 'rgba(211, 84, 0, 0.15)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#d35400',
                pointRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // IMPORTANT : laisse le conteneur CSS fixer la hauteur
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });

    // --- GRAPHIQUE 2 : RÉPARTITION LIEUX ---
    new Chart(document.getElementById('locationChart'), {
        type: 'doughnut',
        data: {
            labels: labelsLieu,
            datasets: [{
                data: valuesLieu,
                backgroundColor: [
                    '#d35400', '#e67e22', '#f39c12',
                    '#FF6384', '#36A2EB', '#4BC0C0',
                    '#9966FF', '#FF9F40', '#2ecc71'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // IMPORTANT
            plugins: {
                title: { display: false },
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { size: 11 } }
                }
            }
        }
    });
}