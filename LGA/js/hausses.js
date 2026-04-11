// ========================================
// GESTION DES HAUSSES
// ========================================

let hausses      = [];
let hausseActive = null;
let qrcodeInstance = null;
let filtreCourant  = 'tous';

// ========================================
// STORAGE
// ========================================

function sauvegarderHausses() {
    try {
        LGAStorage.setItem('lga_hausses', JSON.stringify(hausses));
        console.log('Hausses sauvegardées:', hausses.length);
    } catch (error) {
        console.error('Erreur sauvegarde hausses:', error);
    }
}

function chargerHausses() {
    try {
        const data = LGAStorage.getItem('lga_hausses');
        if (data) {
            hausses = JSON.parse(data);
            console.log('Hausses chargées:', hausses.length);
        }
    } catch (error) {
        console.error('Erreur chargement hausses:', error);
    }
}

// ========================================
// CALCULS
// ========================================

function calculerStatsHausse(hausse) {
    const poses     = hausse.poses     || [];
    const entretiens= hausse.entretien || [];

    const nbPoses    = poses.length;
    const nbRecoltes = poses.filter(p => p.dateRecolte).length;

    const productionTotale  = poses.reduce((sum, p) => sum + (p.mielExtrait || 0), 0);
    const productionMoyenne = nbRecoltes > 0 ? productionTotale / nbRecoltes : 0;
    const meilleureRecolte  = nbRecoltes > 0 ? Math.max(...poses.filter(p => p.mielExtrait).map(p => p.mielExtrait)) : 0;

    const tareMoyenne= nbPoses > 0 ? poses.reduce((sum, p) => sum + (p.tarePose || 0), 0) / nbPoses : hausse.tare;
    const prodParTare= tareMoyenne > 0 ? productionMoyenne / tareMoyenne : 0;

    const rendementMoyen = nbRecoltes > 0
        ? poses.filter(p => p.rendementExtraction).reduce((sum, p) => sum + p.rendementExtraction, 0) / nbRecoltes
        : 0;

    // Durée moyenne pose→récolte
    const durees = poses.filter(p => p.dateRecolte).map(p => {
        return (new Date(p.dateRecolte) - new Date(p.datePose)) / (1000 * 60 * 60 * 24);
    });
    const dureeMoyenne = durees.length > 0 ? durees.reduce((s, d) => s + d, 0) / durees.length : 0;

    // Dernier entretien
    const dernierEntretien = entretiens.length > 0
        ? entretiens.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
        : null;

    // Action la plus fréquente
    const actionsCount = {};
    entretiens.forEach(e => { actionsCount[e.action] = (actionsCount[e.action] || 0) + 1; });
    const actionsPlusFrequentes = Object.entries(actionsCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    return {
        nbPoses, nbRecoltes, productionTotale, productionMoyenne, meilleureRecolte,
        prodParTare, rendementMoyen, dureeMoyenne, dernierEntretien,
        nbEntretiens: entretiens.length, actionsPlusFrequentes
    };
}

// ========================================
// AFFICHAGE LISTE
// ========================================

function afficherHausses(filtre = filtreCourant) {
    filtreCourant = filtre;
    const container = document.getElementById('liste-hausses');

    // Mettre à jour les compteurs
    document.getElementById('count-tous').textContent      = hausses.length;
    document.getElementById('count-stock').textContent     = hausses.filter(h => h.statut === 'Stock').length;
    document.getElementById('count-ruche').textContent     = hausses.filter(h => h.statut === 'Sur ruche').length;
    document.getElementById('count-entretien').textContent = hausses.filter(h => h.statut === 'Entretien').length;

    let haussesFiltrees = filtre === 'tous' ? hausses : hausses.filter(h => h.statut === filtre);

    // Appliquer la recherche
    const recherche = (document.getElementById('search-hausse')?.value || '').toLowerCase();
    if (recherche) {
        haussesFiltrees = haussesFiltrees.filter(h => h.numero.toLowerCase().includes(recherche));
    }

    if (haussesFiltrees.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucune hausse trouvée.</p>';
        return;
    }

    container.innerHTML = haussesFiltrees.map(h => {
        const statutClass = h.statut === 'Stock' ? 'statut-stock'
                          : h.statut === 'Sur ruche' ? 'statut-ruche'
                          : 'statut-entretien';
        return `
            <div class="hausse-card" onclick="ouvrirModalHausse('${h.id}')">
                <div class="hausse-numero">${h.numero}</div>
                <div class="hausse-type">${h.type} • Tare : ${h.tare} kg • Année : ${h.annee || '-'}</div>
                <span class="hausse-statut-badge ${statutClass}">${h.statut}</span>
                <div class="hausse-info-grid">
                    <div class="hausse-info-item">
                        <span class="hausse-info-label">Ruche actuelle</span>
                        <span class="hausse-info-value">${h.rucheActuelle || '-'}</span>
                    </div>
                    <div class="hausse-info-item">
                        <span class="hausse-info-label">Poses totales</span>
                        <span class="hausse-info-value">${(h.poses || []).length}</span>
                    </div>
                    <div class="hausse-info-item">
                        <span class="hausse-info-label">Production totale</span>
                        <span class="hausse-info-value">${(h.poses || []).reduce((s, p) => s + (p.mielExtrait || 0), 0).toFixed(1)} kg</span>
                    </div>
                    <div class="hausse-info-item">
                        <span class="hausse-info-label">Entretiens</span>
                        <span class="hausse-info-value">${(h.entretien || []).length}</span>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function filtrerHausses(filtre) {
    document.querySelectorAll('.btn-filtre').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-filtre="${filtre}"]`)?.classList.add('active');
    afficherHausses(filtre);
}

function mettreAJourStatistiques() {
    const total          = hausses.length;
    const surRuches      = hausses.filter(h => h.statut === 'Sur ruche').length;
    const enStock        = hausses.filter(h => h.statut === 'Stock').length;
    const prodEstimee    = hausses.reduce((sum, h) => {
        const poses = (h.poses || []).filter(p => !p.dateRecolte);
        return sum + poses.reduce((s, p) => s + (p.tarePose || 0), 0) * 0.7;
    }, 0);

    document.getElementById('total-hausses').textContent      = total;
    document.getElementById('hausses-sur-ruches').textContent = surRuches;
    document.getElementById('hausses-stock').textContent      = enStock;
    document.getElementById('production-estimee').textContent = prodEstimee.toFixed(1) + ' kg';
}

// ========================================
// FORMULAIRE AJOUT
// ========================================

function initialiserFormulaireHausse() {
    const form = document.getElementById('form-hausse');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const hausse = {
            id:          Date.now().toString(),
            numero:      document.getElementById('hausse-numero').value.toUpperCase(),
            type:        document.getElementById('hausse-type').value,
            tare:        parseFloat(document.getElementById('hausse-tare').value),
            annee:       document.getElementById('hausse-annee').value || new Date().getFullYear(),
            statut:      document.getElementById('hausse-statut').value,
            rucheActuelle: null,
            entretien:   [],
            poses:       []
        };

        // Vérifier doublon numéro
        if (hausses.find(h => h.numero === hausse.numero)) {
            alert(`Une hausse avec le numéro ${hausse.numero} existe déjà !`);
            return;
        }

        hausses.push(hausse);
        sauvegarderHausses();
        afficherHausses();
        mettreAJourStatistiques();
        form.reset();
        alert(`Hausse ${hausse.numero} ajoutée !`);
    });
}

function initialiserRecherche() {
    const input = document.getElementById('search-hausse');
    if (input) {
        input.addEventListener('input', () => afficherHausses());
    }
}

// ========================================
// MODAL HAUSSE
// ========================================

function ouvrirModalHausse(id) {
    const hausse = hausses.find(h => h.id === id);
    if (!hausse) return;

    hausseActive = hausse;
    document.getElementById('modal-titre-hausse').textContent = `Hausse ${hausse.numero}`;

    document.getElementById('info-type').textContent  = hausse.type;
    document.getElementById('info-tare').textContent  = hausse.tare + ' kg';
    document.getElementById('info-statut').value      = hausse.statut;

    chargerListeRuches();
    document.getElementById('info-ruche-actuelle').value = hausse.rucheActuelle || '';

    genererQRCode(hausse.numero);

    afficherEntretienHausse();
    afficherPosesHausse();
    afficherHistoriqueHausse();
    afficherStatsHausse();

    document.getElementById('modal-hausse').classList.add('active');
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="entretien"]').classList.add('active');
    document.getElementById('tab-entretien-hausse').classList.add('active');
}

function fermerModalHausse() {
    document.getElementById('modal-hausse').classList.remove('active');
    hausseActive = null;
    if (qrcodeInstance) {
        document.getElementById('qrcode-container').innerHTML = '';
        qrcodeInstance = null;
    }
}

function initialiserNavigationModal() {
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${targetTab}-hausse`).classList.add('active');
        });
    });
}

function changerStatutHausse() {
    if (!hausseActive) return;
    hausseActive.statut = document.getElementById('info-statut').value;
    sauvegarderHausses(); afficherHausses(); mettreAJourStatistiques();
}

function associerRuche() {
    if (!hausseActive) return;
    hausseActive.rucheActuelle = document.getElementById('info-ruche-actuelle').value || null;
    sauvegarderHausses(); afficherHausses();
}

function chargerListeRuches() {
    try {
        const ruchesData = LGAStorage.getItem('lga_ruches');
        if (ruchesData) {
            const ruches  = JSON.parse(ruchesData);
            const options = ruches.map(r => `<option value="${r.nom}">${r.nom} - ${r.rucher}</option>`).join('');
            const select1 = document.getElementById('info-ruche-actuelle');
            const select2 = document.getElementById('pose-ruche');
            if (select1) select1.innerHTML = '<option value="">Aucune</option>' + options;
            if (select2) select2.innerHTML = '<option value="">Sélectionner ruche</option>' + options;
        }
    } catch (error) {
        console.error('Erreur chargement ruches:', error);
    }
}

// ========================================
// QR CODE
// ========================================

function genererQRCode(numero) {
    const container = document.getElementById('qrcode-container');
    container.innerHTML = '';
    qrcodeInstance = new QRCode(container, {
        text:         JSON.stringify({ type: 'hausse', numero, app: 'LGA' }),
        width:        200, height: 200,
        colorDark:    '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
}

function telechargerQRCode() {
    if (!hausseActive) return;
    const canvas = document.querySelector('#qrcode-container canvas');
    if (!canvas) return;
    const link    = document.createElement('a');
    link.download = `QR_Hausse_${hausseActive.numero}.png`;
    link.href     = canvas.toDataURL();
    link.click();
}

function imprimerEtiquette() {
    if (!hausseActive) return;
    document.getElementById('etiquette-numero').textContent = hausseActive.numero;
    document.getElementById('etiquette-type').textContent   = hausseActive.type;
    document.getElementById('etiquette-tare').textContent   = hausseActive.tare + ' kg';
    document.getElementById('etiquette-annee').textContent  = hausseActive.annee;

    const containerEtiquette = document.getElementById('etiquette-qr');
    containerEtiquette.innerHTML = '';
    new QRCode(containerEtiquette, {
        text:         JSON.stringify({ type: 'hausse', numero: hausseActive.numero, app: 'LGA' }),
        width:        150, height: 150,
        colorDark:    '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    document.getElementById('modal-etiquette').classList.add('active');
}

function fermerModalEtiquette() {
    document.getElementById('modal-etiquette').classList.remove('active');
}

// ========================================
// ENTRETIEN
// ========================================

function initialiserEntretien() {
    const form = document.getElementById('form-entretien');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!hausseActive) return;
        const entretien = {
            id:      Date.now(),
            date:    document.getElementById('entretien-date').value,
            action:  document.getElementById('entretien-action').value,
            produit: document.getElementById('entretien-produit').value || '-',
            lot:     document.getElementById('entretien-lot').value     || '-',
            notes:   document.getElementById('entretien-notes').value   || ''
        };
        if (!hausseActive.entretien) hausseActive.entretien = [];
        hausseActive.entretien.push(entretien);
        sauvegarderHausses(); afficherEntretienHausse(); afficherHistoriqueHausse(); afficherStatsHausse();
        form.reset();
    });
}

function afficherEntretienHausse() {
    if (!hausseActive) return;
    const tbody     = document.querySelector('#table-entretien-hausse tbody');
    const entretiens= hausseActive.entretien || [];
    if (entretiens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Aucun entretien</td></tr>'; return;
    }
    const tries = [...entretiens].sort((a, b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = tries.map(e => `
        <tr>
            <td>${new Date(e.date).toLocaleDateString('fr-FR')}</td>
            <td><strong>${e.action}</strong></td>
            <td>${e.produit}</td><td>${e.lot}</td><td>${e.notes || '-'}</td>
            <td><button class="btn-delete" onclick="supprimerEntretien(${e.id})">Supprimer</button></td>
        </tr>`).join('');
}

function supprimerEntretien(id) {
    if (!hausseActive) return;
    hausseActive.entretien = hausseActive.entretien.filter(e => e.id !== id);
    sauvegarderHausses(); afficherEntretienHausse(); afficherHistoriqueHausse(); afficherStatsHausse();
}

// ========================================
// POSES ET RÉCOLTES
// ========================================

function initialiserPoses() {
    const formPose    = document.getElementById('form-pose');
    const formRecolte = document.getElementById('form-recolte');

    formPose.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!hausseActive) return;
        const pose = {
            id:               Date.now(),
            datePose:         document.getElementById('pose-date').value,
            ruche:            document.getElementById('pose-ruche').value,
            tarePose:         parseFloat(document.getElementById('pose-tare').value),
            dateRecolte:      null, poidsPlein: null, poidsVide: null,
            poidsMielHausse:  null, mielExtrait: null, rendementExtraction: null, lot: null
        };
        if (!hausseActive.poses) hausseActive.poses = [];
        hausseActive.poses.push(pose);
        hausseActive.statut        = 'Sur ruche';
        hausseActive.rucheActuelle = pose.ruche;
        sauvegarderHausses(); afficherPosesHausse(); afficherHistoriqueHausse();
        afficherHausses(); mettreAJourStatistiques();
        formPose.reset();
        alert('Hausse posée sur ruche !');
    });

    formRecolte.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!hausseActive) return;
        const poses       = hausseActive.poses || [];
        const poseEnCours = poses.find(p => !p.dateRecolte);
        if (!poseEnCours) { alert('Aucune pose en cours à récolter !'); return; }

        const poidsPlein      = parseFloat(document.getElementById('recolte-poids-plein').value);
        const poidsVide       = parseFloat(document.getElementById('recolte-poids-vide').value);
        const poidsMielHausse = poidsPlein - poseEnCours.tarePose;
        const mielExtrait     = poidsPlein - poidsVide;
        const rendement       = poidsMielHausse > 0 ? (mielExtrait / poidsMielHausse) * 100 : 0;

        poseEnCours.dateRecolte          = document.getElementById('recolte-date').value;
        poseEnCours.poidsPlein           = poidsPlein;
        poseEnCours.poidsVide            = poidsVide;
        poseEnCours.poidsMielHausse      = poidsMielHausse;
        poseEnCours.mielExtrait          = mielExtrait;
        poseEnCours.rendementExtraction  = rendement;
        poseEnCours.lot                  = document.getElementById('recolte-lot').value || null;

        hausseActive.statut        = 'Stock';
        hausseActive.rucheActuelle = null;

        sauvegarderHausses();
        afficherPosesHausse(); afficherHistoriqueHausse(); afficherStatsHausse();
        afficherHausses(); mettreAJourStatistiques();

        document.getElementById('poids-miel-hausse').textContent    = poidsMielHausse.toFixed(1) + ' kg';
        document.getElementById('miel-extrait').textContent         = mielExtrait.toFixed(1)     + ' kg';
        document.getElementById('rendement-extraction').textContent  = rendement.toFixed(1)       + ' %';
        document.getElementById('production-info').style.display    = 'block';

        formRecolte.reset();
        setTimeout(() => { document.getElementById('production-info').style.display = 'none'; }, 10000);
    });
}

function afficherPosesHausse() {
    if (!hausseActive) return;
    const tbody= document.querySelector('#table-poses-hausse tbody');
    const poses= hausseActive.poses || [];
    if (poses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-message">Aucune pose</td></tr>'; return;
    }
    const tries = [...poses].sort((a, b) => new Date(b.datePose) - new Date(a.datePose));
    tbody.innerHTML = tries.map(p => {
        let duree = '-';
        if (p.dateRecolte) {
            const jours = Math.round((new Date(p.dateRecolte) - new Date(p.datePose)) / (1000 * 60 * 60 * 24));
            duree = jours + ' j';
        }
        const rendCouleur = p.rendementExtraction >= 90 ? '#4caf50' : p.rendementExtraction >= 80 ? '#ff9800' : '#f44336';
        return `
        <tr>
            <td>${new Date(p.datePose).toLocaleDateString('fr-FR')}</td>
            <td>${p.ruche}</td>
            <td>${p.tarePose.toFixed(1)} kg</td>
            <td>${p.dateRecolte ? new Date(p.dateRecolte).toLocaleDateString('fr-FR') : 'En cours'}</td>
            <td>${p.poidsPlein    ? p.poidsPlein.toFixed(1)    + ' kg' : '-'}</td>
            <td>${p.poidsVide     ? p.poidsVide.toFixed(1)     + ' kg' : '-'}</td>
            <td style="font-weight:bold;color:#4caf50;">${p.mielExtrait ? p.mielExtrait.toFixed(1) + ' kg' : '-'}</td>
            <td style="font-weight:bold;color:${rendCouleur};">${p.rendementExtraction ? p.rendementExtraction.toFixed(1) + ' %' : '-'}</td>
            <td>${p.lot || '-'}</td>
            <td>${duree}</td>
        </tr>`;
    }).join('');
}

// ========================================
// HISTORIQUE
// ========================================

function afficherHistoriqueHausse() {
    if (!hausseActive) return;
    const container = document.getElementById('historique-timeline');
    const evenements= [];

    (hausseActive.entretien || []).forEach(e => evenements.push({
        date: e.date, type: 'entretien', action: e.action,
        details: `Produit: ${e.produit} | Lot: ${e.lot}${e.notes ? ' | ' + e.notes : ''}`
    }));

    (hausseActive.poses || []).forEach(p => {
        evenements.push({ date: p.datePose, type: 'pose', action: 'Pose sur ruche',
            details: `Ruche: ${p.ruche} | Tare: ${p.tarePose.toFixed(1)} kg` });
        if (p.dateRecolte) {
            evenements.push({ date: p.dateRecolte, type: 'recolte', action: 'Récolte',
                details: `Miel extrait: ${p.mielExtrait.toFixed(1)} kg${p.rendementExtraction ? ' | Rendement: ' + p.rendementExtraction.toFixed(1) + '%' : ''}${p.lot ? ' | Lot: ' + p.lot : ''}` });
        }
    });

    evenements.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (evenements.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucun événement enregistré</p>'; return;
    }

    container.innerHTML = evenements.map(e => `
        <div class="timeline-item timeline-type-${e.type}">
            <div class="timeline-date">${new Date(e.date).toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
            <div class="timeline-action">${e.action}</div>
            <div class="timeline-details">${e.details}</div>
        </div>`).join('');
}

// ========================================
// STATISTIQUES
// ========================================

function afficherStatsHausse() {
    if (!hausseActive) return;
    const stats = calculerStatsHausse(hausseActive);

    document.getElementById('stat-nb-poses').textContent        = stats.nbPoses;
    document.getElementById('stat-nb-recoltes').textContent     = stats.nbRecoltes;
    document.getElementById('stat-prod-totale').textContent     = stats.productionTotale.toFixed(1)  + ' kg';
    document.getElementById('stat-prod-moyenne').textContent    = stats.productionMoyenne.toFixed(1) + ' kg';
    document.getElementById('stat-dernier-entretien').textContent = stats.dernierEntretien ? new Date(stats.dernierEntretien).toLocaleDateString('fr-FR') : '-';
    document.getElementById('stat-nb-entretiens').textContent   = stats.nbEntretiens;
    document.getElementById('stat-actions-freq').textContent    = stats.actionsPlusFrequentes;
    document.getElementById('stat-meilleure-recolte').textContent = stats.meilleureRecolte.toFixed(1) + ' kg';
    document.getElementById('stat-prod-par-tare').textContent   = stats.prodParTare.toFixed(1);
    document.getElementById('stat-duree-moyenne').textContent   = Math.round(stats.dureeMoyenne) + ' jours';

    const rendementDiv = document.getElementById('stat-rendement-moyen');
    if (rendementDiv) rendementDiv.textContent = stats.rendementMoyen.toFixed(1) + ' %';
}

// ========================================
// INITIALISATION
// ========================================

LGAStorage.init().then(() => {
    console.log('📦 Module Hausses - Démarrage...');

    chargerHausses();

    initialiserFormulaireHausse();
    initialiserRecherche();
    initialiserNavigationModal();
    initialiserEntretien();
    initialiserPoses();

    afficherHausses();
    mettreAJourStatistiques();

    document.getElementById('modal-hausse').addEventListener('click', (e) => {
        if (e.target.id === 'modal-hausse') fermerModalHausse();
    });
    document.getElementById('modal-etiquette').addEventListener('click', (e) => {
        if (e.target.id === 'modal-etiquette') fermerModalEtiquette();
    });

    console.log('✅ Module Hausses initialisé');
}).catch(err => {
    console.error('Erreur initialisation stockage:', err);
});
