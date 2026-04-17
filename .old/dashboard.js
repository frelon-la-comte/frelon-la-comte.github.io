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
        await initCharts(data);

        // Expose les données pour la fonction d'export PDF
        window._dashboardData = data;

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

    const parLieu = {};
    data.forEach(item => {
        const lieuClean = item.lieu.toLowerCase().trim();

        if (!parLieu[lieuClean]) {
            let coords = GPS_MAPPING[lieuClean];
            if (!coords) {
                const offsetLat = (Math.random() - 0.5) * 0.005;
                const offsetLon = (Math.random() - 0.5) * 0.005;
                coords = [CONFIG.lat + offsetLat, CONFIG.lon + offsetLon];
            }
            parLieu[lieuClean] = {
                coords: coords,
                total: 0,
                label: item.lieu,
                dates: []
            };
        }

        parLieu[lieuClean].total += item.nombre;
        parLieu[lieuClean].dates.push(`${item.date} : ${item.nombre} frelon(s)`);
    });

    Object.values(parLieu).forEach(lieu => {
        const radius = 8 + lieu.total * 3;

        const circle = L.circleMarker(lieu.coords, {
            radius: Math.min(radius, 40),
            fillColor: '#d35400',
            color: '#922b00',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.75
        }).addTo(map);

        const detailDates = lieu.dates.join('<br>');
        circle.bindPopup(
            `<b>${lieu.label}</b><br>` +
            `<b>Total : ${lieu.total} frelon(s)</b><br>` +
            `<hr style="margin:5px 0">` +
            `<small>${detailDates}</small>`
        );
    });
}

// 3. FETCH MÉTÉO — Moyenne diurne + précipitations journalières (Open-Meteo archive)
async function fetchWeatherData(startDate, endDate) {
    const today = new Date().toISOString().slice(0, 10);
    const safeEnd = endDate > today ? today : endDate;

    // Un seul appel API pour tout récupérer :
    //   - hourly=temperature_2m   → température heure par heure
    //   - daily=sunrise,sunset    → lever/coucher pour filtrer les heures diurnes
    //   - daily=precipitation_sum → cumul de pluie journalier (mm)
    const url = `https://archive-api.open-meteo.com/v1/archive` +
        `?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}` +
        `&start_date=${startDate}&end_date=${safeEnd}` +
        `&hourly=temperature_2m` +
        `&daily=sunrise,sunset,precipitation_sum` +
        `&timezone=auto`;

    try {
        const resp = await fetch(url);
        const json = await resp.json();

        const hourlyIndex = {};
        json.hourly.time.forEach((t, i) => {
            hourlyIndex[t] = json.hourly.temperature_2m[i];
        });

        const tempMap   = {};
        const precipMap = {};

        json.daily.time.forEach((date, i) => {
            // Température : moyenne diurne (lever → coucher)
            const sunrise = new Date(json.daily.sunrise[i]);
            const sunset  = new Date(json.daily.sunset[i]);
            const dayTemps = [];
            const cursor = new Date(sunrise);
            cursor.setMinutes(0, 0, 0);
            while (cursor <= sunset) {
                const localKey = `${date}T${String(cursor.getHours()).padStart(2, '0')}:00`;
                const temp = hourlyIndex[localKey];
                if (temp !== undefined && temp !== null) dayTemps.push(temp);
                cursor.setHours(cursor.getHours() + 1);
            }
            tempMap[date] = dayTemps.length > 0
                ? parseFloat((dayTemps.reduce((a, b) => a + b, 0) / dayTemps.length).toFixed(1))
                : null;

            // Précipitations : cumul journalier (mm)
            const p = json.daily.precipitation_sum[i];
            precipMap[date] = (p !== undefined && p !== null) ? parseFloat(p.toFixed(1)) : 0;
        });

        return { tempMap, precipMap };

    } catch (e) {
        console.warn("Impossible de récupérer les données météo :", e);
        return { tempMap: {}, precipMap: {} };
    }
}

// 4. GRAPHIQUES (CHART.JS)
async function initCharts(data) {

    // --- A. Agrégation captures par date ---
    const parDate = {};
    data.forEach(item => {
        parDate[item.date] = (parDate[item.date] || 0) + item.nombre;
    });

    const datesCaptures = Object.keys(parDate).sort();

    if (datesCaptures.length === 0) {
        document.getElementById('timeChart').parentElement.innerHTML =
            '<p style="color:#999; font-style:italic; text-align:center; padding:20px;">Aucune donnée à afficher.</p>';
        initLocationChart(data);
        return;
    }

    const startDate = datesCaptures[0];
    const endDate = datesCaptures[datesCaptures.length - 1];

    // Plage complète de dates continues
    const allDates = [];
    const d = new Date(startDate);
    const dEnd = new Date(endDate);
    while (d <= dEnd) {
        allDates.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
    }

    const captureValues = allDates.map(date => parDate[date] || 0);

    // --- B. Récupération météo (température + précipitations) ---
    const { tempMap, precipMap } = await fetchWeatherData(startDate, endDate);
    const tempValues   = allDates.map(date => tempMap[date]   ?? null);
    const precipValues = allDates.map(date => precipMap[date] ?? 0);

    const seuilValues = allDates.map(() => 10);

    // --- C. GRAPHIQUE TEMPOREL avec triple axe ---
    new Chart(document.getElementById('timeChart'), {
        data: {
            labels: allDates,
            datasets: [
                // Dataset 1 : Précipitations (barres grises, en arrière-plan)
                {
                    type: 'bar',
                    label: 'Précipitations (mm)',
                    data: precipValues,
                    backgroundColor: 'rgba(100, 149, 237, 0.25)',
                    borderColor: 'rgba(100, 149, 237, 0.5)',
                    borderWidth: 1,
                    borderRadius: 2,
                    yAxisID: 'yPrecip',
                    order: 4
                },
                // Dataset 2 : Captures (barres oranges)
                {
                    type: 'bar',
                    label: 'Fondatrices piégées',
                    data: captureValues,
                    backgroundColor: 'rgba(211, 84, 0, 0.70)',
                    borderColor: '#922b00',
                    borderWidth: 1,
                    borderRadius: 3,
                    yAxisID: 'yCaptures',
                    order: 3
                },
                // Dataset 3 : Température moyenne diurne (ligne bleue)
                {
                    type: 'line',
                    label: 'Moy. diurne (°C)',
                    data: tempValues,
                    borderColor: '#2980b9',
                    backgroundColor: 'rgba(41, 128, 185, 0.06)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointBackgroundColor: '#2980b9',
                    borderWidth: 2,
                    yAxisID: 'yTemp',
                    order: 2,
                    spanGaps: true
                },
                // Dataset 4 : Seuil 10°C (pointillés rouges)
                {
                    type: 'line',
                    label: 'Seuil vol (10°C)',
                    data: seuilValues,
                    borderColor: '#e74c3c',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false,
                    tension: 0,
                    yAxisID: 'yTemp',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { boxWidth: 14, font: { size: 11 }, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            if (ctx.dataset.label === 'Fondatrices piégées')   return ` ${ctx.parsed.y} capture(s)`;
                            if (ctx.dataset.label === 'Seuil vol (10°C)')      return ` Seuil : 10°C`;
                            if (ctx.dataset.label === 'Précipitations (mm)')   return ` ${ctx.parsed.y} mm de pluie`;
                            return ` Moy. diurne : ${ctx.parsed.y}°C`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { maxTicksLimit: 12, maxRotation: 45, font: { size: 10 } }
                },
                // Axe gauche : captures
                yCaptures: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    ticks: { precision: 0, color: '#d35400', font: { size: 10 } },
                    title: { display: true, text: 'Captures', color: '#d35400', font: { size: 11 } },
                    grid: { color: 'rgba(211, 84, 0, 0.08)' }
                },
                // Axe droit : température
                yTemp: {
                    type: 'linear',
                    position: 'right',
                    ticks: { color: '#2980b9', font: { size: 10 }, callback: v => `${v}°C` },
                    title: { display: true, text: 'Température (°C)', color: '#2980b9', font: { size: 11 } },
                    grid: { drawOnChartArea: false }
                },
                // Axe droit (décalé) : précipitations — discret, juste pour l'échelle
                yPrecip: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    offset: true,           // décale l'axe pour ne pas chevaucher yTemp
                    ticks: { color: 'rgba(100,149,237,0.7)', font: { size: 9 }, callback: v => `${v}mm` },
                    title: { display: true, text: 'Pluie (mm)', color: 'rgba(100,149,237,0.8)', font: { size: 10 } },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });

    // --- D. GRAPHIQUE RÉPARTITION LIEUX ---
    initLocationChart(data);
}

function initLocationChart(data) {
    const parLieu = {};
    data.forEach(item => {
        parLieu[item.lieu] = (parLieu[item.lieu] || 0) + item.nombre;
    });
    const labelsLieu = Object.keys(parLieu);
    const valuesLieu = labelsLieu.map(l => parLieu[l]);

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
            maintainAspectRatio: false,
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