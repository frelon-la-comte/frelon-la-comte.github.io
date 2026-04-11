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
        await initCharts(data); // await car on fetch les températures

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

// 3. FETCH TEMPÉRATURES — Moyenne diurne (lever → coucher du soleil)
async function fetchTemperatures(startDate, endDate) {
    const today = new Date().toISOString().slice(0, 10);
    const safeEnd = endDate > today ? today : endDate;

    // On demande :
    //   - hourly=temperature_2m  → température heure par heure
    //   - daily=sunrise,sunset   → horaires précis du lever/coucher pour chaque jour
    const url = `https://archive-api.open-meteo.com/v1/archive` +
        `?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}` +
        `&start_date=${startDate}&end_date=${safeEnd}` +
        `&hourly=temperature_2m` +
        `&daily=sunrise,sunset` +
        `&timezone=auto`;

    try {
        const resp = await fetch(url);
        const json = await resp.json();

        // Construit un index rapide : heure ISO → température
        // Ex: "2026-04-05T13:00" → 14.2
        const hourlyIndex = {};
        json.hourly.time.forEach((t, i) => {
            hourlyIndex[t] = json.hourly.temperature_2m[i];
        });

        // Pour chaque jour, calcule la moyenne des heures entre sunrise et sunset
        const result = {};
        json.daily.time.forEach((date, i) => {
            const sunrise = new Date(json.daily.sunrise[i]); // ex: 2026-04-05T06:32
            const sunset  = new Date(json.daily.sunset[i]);  // ex: 2026-04-05T20:14

            const dayTemps = [];
            // Open-Meteo fournit une mesure par heure (H:00)
            // On itère heure par heure entre sunrise et sunset
            const cursor = new Date(sunrise);
            cursor.setMinutes(0, 0, 0); // on part de l'heure pleine du lever

            while (cursor <= sunset) {
                // Formate la clé au format ISO sans secondes : "YYYY-MM-DDTHH:00"
                const key = cursor.toISOString().slice(0, 13) + ':00';
                // Open-Meteo utilise le fuseau local → on cherche aussi la clé locale
                const localKey = `${date}T${String(cursor.getHours()).padStart(2, '0')}:00`;

                const temp = hourlyIndex[localKey] ?? hourlyIndex[key];
                if (temp !== undefined && temp !== null) {
                    dayTemps.push(temp);
                }
                cursor.setHours(cursor.getHours() + 1);
            }

            if (dayTemps.length > 0) {
                const avg = dayTemps.reduce((a, b) => a + b, 0) / dayTemps.length;
                result[date] = parseFloat(avg.toFixed(1));
            } else {
                result[date] = null;
            }
        });

        return result;

    } catch (e) {
        console.warn("Impossible de récupérer les températures :", e);
        return {};
    }
}

// 4. GRAPHIQUES (CHART.JS)
async function initCharts(data) {

    // --- A. Agrégation captures par date ---
    const parDate = {};
    data.forEach(item => {
        parDate[item.date] = (parDate[item.date] || 0) + item.nombre;
    });

    // Dates triées (toute la plage de la saison)
    const datesCaptures = Object.keys(parDate).sort();

    if (datesCaptures.length === 0) {
        document.getElementById('timeChart').parentElement.innerHTML =
            '<p style="color:#999; font-style:italic; text-align:center; padding:20px;">Aucune donnée à afficher.</p>';
        initLocationChart(data);
        return;
    }

    // Plage complète de dates (du premier au dernier piégeage)
    const startDate = datesCaptures[0];
    const endDate = datesCaptures[datesCaptures.length - 1];

    // Génère toutes les dates entre start et end (pour un axe continu)
    const allDates = [];
    const d = new Date(startDate);
    const dEnd = new Date(endDate);
    while (d <= dEnd) {
        allDates.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
    }

    // Valeurs captures par date (0 si aucune capture ce jour-là)
    const captureValues = allDates.map(date => parDate[date] || 0);

    // --- B. Récupération températures ---
    const tempMap = await fetchTemperatures(startDate, endDate);
    const tempValues = allDates.map(date => {
        const v = tempMap[date];
        return (v !== undefined && v !== null) ? parseFloat(v.toFixed(1)) : null;
    });

    // Ligne seuil 10°C (constante sur toute la plage)
    const seuilValues = allDates.map(() => 10);

    // --- C. GRAPHIQUE TEMPOREL avec double axe + scroll horizontal ---

    // Construit le conteneur scrollable autour du canvas
    const canvas = document.getElementById('timeChart');
    const chartWrapper = canvas.parentElement; // .chart-wrapper

    // Div externe : overflow scroll avec indicateur visuel sur mobile
    const scrollOuter = document.createElement('div');
    scrollOuter.style.cssText = [
        'overflow-x: auto',
        'overflow-y: hidden',
        '-webkit-overflow-scrolling: touch', // scroll fluide iOS
        'cursor: grab',
        'border-radius: 6px',
    ].join(';');

    // Div interne : largeur calculée selon le nombre de jours
    const PX_PER_DAY = 32; // pixels par jour — ajustez si besoin
    const CHART_HEIGHT = 260; // px
    const totalWidth = Math.max(chartWrapper.clientWidth || 400, allDates.length * PX_PER_DAY);

    const scrollInner = document.createElement('div');
    scrollInner.style.cssText = `width:${totalWidth}px; height:${CHART_HEIGHT}px; position:relative;`;

    // Réorganise le DOM : wrapper > scrollOuter > scrollInner > canvas
    chartWrapper.appendChild(scrollOuter);
    scrollOuter.appendChild(scrollInner);
    scrollInner.appendChild(canvas);

    // Le canvas prend exactement la taille du scrollInner
    canvas.style.width  = '100%';
    canvas.style.height = '100%';

    // Drag-to-scroll au clic (desktop)
    let isDown = false, startX = 0, scrollLeft = 0;
    scrollOuter.addEventListener('mousedown',  e => { isDown = true; startX = e.pageX - scrollOuter.offsetLeft; scrollLeft = scrollOuter.scrollLeft; scrollOuter.style.cursor = 'grabbing'; });
    scrollOuter.addEventListener('mouseleave', () => { isDown = false; scrollOuter.style.cursor = 'grab'; });
    scrollOuter.addEventListener('mouseup',    () => { isDown = false; scrollOuter.style.cursor = 'grab'; });
    scrollOuter.addEventListener('mousemove',  e => { if (!isDown) return; e.preventDefault(); scrollOuter.scrollLeft = scrollLeft - (e.pageX - scrollOuter.offsetLeft - startX); });

    // Indice de scroll sur mobile (petit hint la première fois)
    if (allDates.length * PX_PER_DAY > (chartWrapper.clientWidth || 400)) {
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:0.75em; color:#aaa; text-align:right; margin-bottom:4px;';
        hint.innerHTML = '<i class="fas fa-arrows-left-right"></i> Faites glisser pour naviguer';
        chartWrapper.insertBefore(hint, scrollOuter);
    }

    new Chart(canvas, {
        data: {
            labels: allDates,
            datasets: [
                // Dataset 1 : Captures (barres, axe gauche)
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
                // Dataset 2 : Température moyenne diurne (lever → coucher du soleil)
                {
                    type: 'line',
                    label: 'Moy. diurne (°C)',
                    data: tempValues,
                    borderColor: '#2980b9',
                    backgroundColor: 'rgba(41, 128, 185, 0.08)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointBackgroundColor: '#2980b9',
                    borderWidth: 2,
                    yAxisID: 'yTemp',
                    order: 2,
                    spanGaps: true // relie les points même si des jours manquent
                },
                // Dataset 3 : Seuil 10°C (ligne pointillée, axe droit)
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
            responsive: false,        // taille fixée par le DOM, pas le conteneur
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',      // tooltip sur toutes les séries à la même date
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 14,
                        font: { size: 11 },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        // Ajoute l'unité selon la série
                        label: function(ctx) {
                            if (ctx.dataset.label === 'Fondatrices piégées') {
                                return ` ${ctx.parsed.y} capture(s)`;
                            }
                            if (ctx.dataset.label === 'Seuil vol (10°C)') {
                                return ` Seuil : 10°C`;
                            }
                            return ` Moy. diurne : ${ctx.parsed.y}°C`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 12,   // évite la surcharge de labels
                        maxRotation: 45,
                        font: { size: 10 }
                    }
                },
                // Axe gauche : captures
                yCaptures: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: '#d35400',
                        font: { size: 10 }
                    },
                    title: {
                        display: true,
                        text: 'Captures',
                        color: '#d35400',
                        font: { size: 11 }
                    },
                    grid: {
                        color: 'rgba(211, 84, 0, 0.08)'
                    }
                },
                // Axe droit : température
                yTemp: {
                    type: 'linear',
                    position: 'right',
                    ticks: {
                        color: '#2980b9',
                        font: { size: 10 },
                        callback: v => `${v}°C`
                    },
                    title: {
                        display: true,
                        text: 'Température (°C)',
                        color: '#2980b9',
                        font: { size: 11 }
                    },
                    grid: {
                        drawOnChartArea: false  // pas de grille double
                    }
                }
            }
        }
    });

    // --- D. GRAPHIQUE RÉPARTITION LIEUX (inchangé) ---
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