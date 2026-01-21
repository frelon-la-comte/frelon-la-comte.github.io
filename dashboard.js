document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

// --- COORDONNÉES APPROXIMATIVES DES RUES DE LA COMTÉ (62150) ---
// Vous pourrez compléter cette liste pour que les points soient bien placés
const GPS_MAPPING = {
    "centre": [50.407, 2.502], // Centre du village par défaut
    "rue de l'église": [50.4075, 2.5025],
    "grand rue": [50.408, 2.501],
    "rue du bois": [50.405, 2.498],
    "chemin vert": [50.409, 2.505],
    // Ajoutez vos lieux ici en minuscules
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
    // Calcul du total
    const total = data.reduce((acc, item) => acc + item.nombre, 0);
    document.getElementById('total-stat').innerText = total;

    // Dernière date
    if (data.length > 0) {
        // Trie par date décroissante pour trouver la plus récente
        const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
        document.getElementById('last-date').innerText = sorted[0].date;
    }
}

// 2. CARTE (LEAFLET)
function initMap(data) {
    // Initialiser la carte centrée sur La Comté (via config.js)
    const map = L.map('map').setView([CONFIG.lat, CONFIG.lon], 14);

    // Ajouter le fond de carte (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Ajouter les marqueurs
    data.forEach(item => {
        // On essaie de trouver les coordonnées du lieu
        let lieuClean = item.lieu.toLowerCase().trim();
        let coords = GPS_MAPPING[lieuClean];

        // Si on ne connait pas la rue, on met au centre avec un tout petit décalage aléatoire
        // pour ne pas que les points se superposent parfaitement
        if (!coords) {
            const offsetLat = (Math.random() - 0.5) * 0.005;
            const offsetLon = (Math.random() - 0.5) * 0.005;
            coords = [CONFIG.lat + offsetLat, CONFIG.lon + offsetLon];
        }

        // Création du marqueur
        L.marker(coords)
            .addTo(map)
            .bindPopup(`<b>${item.date}</b><br>${item.nombre} frelon(s)<br>${item.lieu}`);
    });
}

// 3. GRAPHIQUES (CHART.JS)
function initCharts(data) {
    // --- PRÉPARATION DES DONNÉES ---
    
    // A. Par date (Timeline)
    // On regroupe les prises par date
    const parDate = {};
    data.forEach(item => {
        parDate[item.date] = (parDate[item.date] || 0) + item.nombre;
    });
    // On trie les dates
    const labelsDate = Object.keys(parDate).sort();
    const valuesDate = labelsDate.map(date => parDate[date]);

    // B. Par Lieu (Camembert)
    const parLieu = {};
    data.forEach(item => {
        parLieu[item.lieu] = (parLieu[item.lieu] || 0) + item.nombre;
    });
    const labelsLieu = Object.keys(parLieu);
    const valuesLieu = labelsLieu.map(l => parLieu[l]);


    // --- RENDU GRAPHIQUE 1 : EVOLUTION ---
    new Chart(document.getElementById('timeChart'), {
        type: 'line', // ou 'bar'
        data: {
            labels: labelsDate,
            datasets: [{
                label: 'Nombre de fondatrices piégées',
                data: valuesDate,
                borderColor: '#d35400',
                backgroundColor: 'rgba(211, 84, 0, 0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Évolution temporelle' }
            }
        }
    });

    // --- RENDU GRAPHIQUE 2 : REPARTITION LIEUX ---
    new Chart(document.getElementById('locationChart'), {
        type: 'doughnut', // ou 'pie'
        data: {
            labels: labelsLieu,
            datasets: [{
                data: valuesLieu,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Répartition par zone' },
                legend: { position: 'bottom' }
            }
        }
    });
}