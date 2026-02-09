// ========================================
// MODAL HAUSSE
// ========================================

function ouvrirModalHausse(id) {
    const hausse = hausses.find(h => h.id === id);
    if (!hausse) return;
    
    hausseActive = hausse;
    document.getElementById('modal-titre-hausse').textContent = `Hausse ${hausse.numero}`;
    
    // Infos principales
    document.getElementById('info-type').textContent = hausse.type;
    document.getElementById('info-tare').textContent = hausse.tare + ' kg';
    document.getElementById('info-statut').value = hausse.statut;
    
    // Charger liste des ruches
    chargerListeRuches();
    document.getElementById('info-ruche-actuelle').value = hausse.rucheActuelle || '';
    
    // Générer QR Code
    genererQRCode(hausse.numero);
    
    // Afficher les données
    afficherEntretienHausse();
    afficherPosesHausse();
    afficherHistoriqueHausse();
    afficherStatsHausse();
    
    // Ouvrir le modal
    document.getElementById('modal-hausse').classList.add('active');
    
    // Réinitialiser à l'onglet entretien
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
    
    const nouveauStatut = document.getElementById('info-statut').value;
    hausseActive.statut = nouveauStatut;
    
    sauvegarderHausses();
    afficherHausses();
    mettreAJourStatistiques();
}

function associerRuche() {
    if (!hausseActive) return;
    
    const rucheId = document.getElementById('info-ruche-actuelle').value;
    hausseActive.rucheActuelle = rucheId || null;
    
    sauvegarderHausses();
    afficherHausses();
}

function chargerListeRuches() {
    try {
        const ruchesData = localStorage.getItem('lga_ruches');
        if (ruchesData) {
            const ruches = JSON.parse(ruchesData);
            const select1 = document.getElementById('info-ruche-actuelle');
            const select2 = document.getElementById('pose-ruche');
            
            const options = ruches.map(r => `<option value="${r.nom}">${r.nom} - ${r.rucher}</option>`).join('');
            
            select1.innerHTML = '<option value="">Aucune</option>' + options;
            select2.innerHTML = '<option value="">Sélectionner ruche</option>' + options;
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
    
    // Données du QR code
    const qrData = JSON.stringify({
        type: 'hausse',
        numero: numero,
        app: 'LGA'
    });
    
    qrcodeInstance = new QRCode(container, {
        text: qrData,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
}

function telechargerQRCode() {
    if (!hausseActive) return;
    
    const canvas = document.querySelector('#qrcode-container canvas');
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `QR_Hausse_${hausseActive.numero}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

function imprimerEtiquette() {
    if (!hausseActive) return;
    
    // Remplir l'étiquette
    document.getElementById('etiquette-numero').textContent = hausseActive.numero;
    document.getElementById('etiquette-type').textContent = hausseActive.type;
    document.getElementById('etiquette-tare').textContent = hausseActive.tare + ' kg';
    document.getElementById('etiquette-annee').textContent = hausseActive.annee;
    
    // Générer QR pour étiquette
    const containerEtiquette = document.getElementById('etiquette-qr');
    containerEtiquette.innerHTML = '';
    
    const qrData = JSON.stringify({
        type: 'hausse',
        numero: hausseActive.numero,
        app: 'LGA'
    });
    
    new QRCode(containerEtiquette, {
        text: qrData,
        width: 150,
        height: 150,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
    
    // Ouvrir modal étiquette
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
            id: Date.now(),
            date: document.getElementById('entretien-date').value,
            action: document.getElementById('entretien-action').value,
            produit: document.getElementById('entretien-produit').value || '-',
            lot: document.getElementById('entretien-lot').value || '-',
            notes: document.getElementById('entretien-notes').value || ''
        };
        
        if (!hausseActive.entretien) hausseActive.entretien = [];
        hausseActive.entretien.push(entretien);
        
        sauvegarderHausses();
        afficherEntretienHausse();
        afficherHistoriqueHausse();
        afficherStatsHausse();
        
        form.reset();
    });
}

function afficherEntretienHausse() {
    if (!hausseActive) return;
    
    const tbody = document.querySelector('#table-entretien-hausse tbody');
    const entretiens = hausseActive.entretien || [];
    
    if (entretiens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Aucun entretien</td></tr>';
        return;
    }
    
    const entreTries = entretiens.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tbody.innerHTML = entreTries.map(e => `
        <tr>
            <td>${new Date(e.date).toLocaleDateString('fr-FR')}</td>
            <td><strong>${e.action}</strong></td>
            <td>${e.produit}</td>
            <td>${e.lot}</td>
            <td>${e.notes || '-'}</td>
            <td>
                <button class="btn-delete" onclick="supprimerEntretien(${e.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
}

function supprimerEntretien(id) {
    if (!hausseActive) return;
    hausseActive.entretien = hausseActive.entretien.filter(e => e.id !== id);
    sauvegarderHausses();
    afficherEntretienHausse();
    afficherHistoriqueHausse();
    afficherStatsHausse();
}

// ========================================
// POSES ET RÉCOLTES
// ========================================

function initialiserPoses() {
    const formPose = document.getElementById('form-pose');
    const formRecolte = document.getElementById('form-recolte');
    
    // Pose
    formPose.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!hausseActive) return;
        
        const pose = {
            id: Date.now(),
            datePose: document.getElementById('pose-date').value,
            ruche: document.getElementById('pose-ruche').value,
            tarePose: parseFloat(document.getElementById('pose-tare').value), // NOUVEAU
            dateRecolte: null,
            poidsPlein: null,
            poidsVide: null,
            poidsMielHausse: null,
            mielExtrait: null,
            rendementExtraction: null,
            lot: null
        };
        
        if (!hausseActive.poses) hausseActive.poses = [];
        hausseActive.poses.push(pose);
        
        // Changer statut et ruche
        hausseActive.statut = 'Sur ruche';
        hausseActive.rucheActuelle = pose.ruche;
        
        sauvegarderHausses();
        afficherPosesHausse();
        afficherHistoriqueHausse();
        afficherHausses();
        mettreAJourStatistiques();
        
        formPose.reset();
        alert('Hausse posée sur ruche !');
    });
    
    // Récolte
    formRecolte.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!hausseActive) return;
        
        // Trouver la dernière pose sans récolte
        const poses = hausseActive.poses || [];
        const poseEnCours = poses.find(p => !p.dateRecolte);
        
        if (!poseEnCours) {
            alert('Aucune pose en cours à récolter !');
            return;
        }
        
        const poidsPlein = parseFloat(document.getElementById('recolte-poids-plein').value);
        const poidsVide = parseFloat(document.getElementById('recolte-poids-vide').value);
        const tarePose = poseEnCours.tarePose;
        
        // Calculs
        const poidsMielHausse = poidsPlein - tarePose; // Miel dans la hausse
        const mielExtrait = poidsPlein - poidsVide; // Miel récupéré
        const rendementExtraction = poidsMielHausse > 0 ? (mielExtrait / poidsMielHausse) * 100 : 0;
        
        poseEnCours.dateRecolte = document.getElementById('recolte-date').value;
        poseEnCours.poidsPlein = poidsPlein;
        poseEnCours.poidsVide = poidsVide;
        poseEnCours.poidsMielHausse = poidsMielHausse;
        poseEnCours.mielExtrait = mielExtrait;
        poseEnCours.rendementExtraction = rendementExtraction;
        poseEnCours.lot = document.getElementById('recolte-lot').value || null;
        
        // Changer statut
        hausseActive.statut = 'Stock';
        hausseActive.rucheActuelle = null;
        
        sauvegarderHausses();
        afficherPosesHausse();
        afficherHistoriqueHausse();
        afficherStatsHausse();
        afficherHausses();
        mettreAJourStatistiques();
        
        // Afficher résultats
        document.getElementById('poids-miel-hausse').textContent = poidsMielHausse.toFixed(1) + ' kg';
        document.getElementById('miel-extrait').textContent = mielExtrait.toFixed(1) + ' kg';
        document.getElementById('rendement-extraction').textContent = rendementExtraction.toFixed(1) + ' %';
        document.getElementById('production-info').style.display = 'block';
        
        formRecolte.reset();
        
        setTimeout(() => {
            document.getElementById('production-info').style.display = 'none';
        }, 10000);
    });
}

function afficherPosesHausse() {
    if (!hausseActive) return;
    
    const tbody = document.querySelector('#table-poses-hausse tbody');
    const poses = hausseActive.poses || [];
    
    if (poses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-message">Aucune pose</td></tr>';
        return;
    }
    
    const posesTries = poses.sort((a, b) => new Date(b.datePose) - new Date(a.datePose));
    
    tbody.innerHTML = posesTries.map(p => {
        let duree = '-';
        if (p.dateRecolte) {
            const debut = new Date(p.datePose);
            const fin = new Date(p.dateRecolte);
            const jours = Math.round((fin - debut) / (1000 * 60 * 60 * 24));
            duree = jours + ' j';
        }
        
        return `
        <tr>
            <td>${new Date(p.datePose).toLocaleDateString('fr-FR')}</td>
            <td>${p.ruche}</td>
            <td>${p.tarePose.toFixed(1)} kg</td>
            <td>${p.dateRecolte ? new Date(p.dateRecolte).toLocaleDateString('fr-FR') : 'En cours'}</td>
            <td>${p.poidsPlein ? p.poidsPlein.toFixed(1) + ' kg' : '-'}</td>
            <td>${p.poidsVide ? p.poidsVide.toFixed(1) + ' kg' : '-'}</td>
            <td style="font-weight: bold; color: #4caf50;">
                ${p.mielExtrait ? p.mielExtrait.toFixed(1) + ' kg' : '-'}
            </td>
            <td style="font-weight: bold; color: ${p.rendementExtraction >= 90 ? '#4caf50' : p.rendementExtraction >= 80 ? '#ff9800' : '#f44336'};">
                ${p.rendementExtraction ? p.rendementExtraction.toFixed(1) + ' %' : '-'}
            </td>
            <td>${p.lot || '-'}</td>
            <td>${duree}</td>
        </tr>
    `;
    }).join('');
}

// Continuer dans le fichier principal d'intégration...

// ========================================
// HISTORIQUE
// ========================================

function afficherHistoriqueHausse() {
    if (!hausseActive) return;
    
    const container = document.getElementById('historique-timeline');
    
    // Combiner tous les événements
    const evenements = [];
    
    // Entretiens
    (hausseActive.entretien || []).forEach(e => {
        evenements.push({
            date: e.date,
            type: 'entretien',
            action: e.action,
            details: `Produit: ${e.produit} | Lot: ${e.lot}${e.notes ? ' | ' + e.notes : ''}`
        });
    });
    
    // Poses
    (hausseActive.poses || []).forEach(p => {
        evenements.push({
            date: p.datePose,
            type: 'pose',
            action: 'Pose sur ruche',
            details: `Ruche: ${p.ruche} | Tare: ${p.tarePose.toFixed(1)} kg`
        });
        
        if (p.dateRecolte) {
            const rendement = p.rendementExtraction ? ` | Rendement: ${p.rendementExtraction.toFixed(1)}%` : '';
            evenements.push({
                date: p.dateRecolte,
                type: 'recolte',
                action: 'Récolte',
                details: `Miel extrait: ${p.mielExtrait.toFixed(1)} kg (Plein: ${p.poidsPlein.toFixed(1)} kg, Vide: ${p.poidsVide.toFixed(1)} kg)${rendement}${p.lot ? ' | Lot: ' + p.lot : ''}`
            });
        }
    });
    
    // Trier par date décroissante
    evenements.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (evenements.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucun événement enregistré</p>';
        return;
    }
    
    container.innerHTML = evenements.map(e => `
        <div class="timeline-item timeline-type-${e.type}">
            <div class="timeline-date">${new Date(e.date).toLocaleDateString('fr-FR', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}</div>
            <div class="timeline-action">${e.action}</div>
            <div class="timeline-details">${e.details}</div>
        </div>
    `).join('');
}

// ========================================
// STATISTIQUES
// ========================================

function afficherStatsHausse() {
    if (!hausseActive) return;
    
    const stats = calculerStatsHausse(hausseActive);
    
    // Utilisation
    document.getElementById('stat-nb-poses').textContent = stats.nbPoses;
    document.getElementById('stat-nb-recoltes').textContent = stats.nbRecoltes;
    document.getElementById('stat-prod-totale').textContent = stats.productionTotale.toFixed(1) + ' kg';
    document.getElementById('stat-prod-moyenne').textContent = stats.productionMoyenne.toFixed(1) + ' kg';
    
    // Entretien
    document.getElementById('stat-dernier-entretien').textContent = 
        stats.dernierEntretien ? new Date(stats.dernierEntretien).toLocaleDateString('fr-FR') : '-';
    document.getElementById('stat-nb-entretiens').textContent = stats.nbEntretiens;
    document.getElementById('stat-actions-freq').textContent = stats.actionsPlusFrequentes;
    
    // Performances
    document.getElementById('stat-meilleure-recolte').textContent = stats.meilleureRecolte.toFixed(1) + ' kg';
    document.getElementById('stat-prod-par-tare').textContent = stats.prodParTare.toFixed(1);
    document.getElementById('stat-duree-moyenne').textContent = Math.round(stats.dureeMoyenne) + ' jours';
    
    // Ajouter rendement moyen
    const rendementDiv = document.getElementById('stat-rendement-moyen');
    if (rendementDiv) {
        rendementDiv.textContent = stats.rendementMoyen.toFixed(1) + ' %';
    }
}

// ========================================
// INITIALISATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📦 Module Hausses - Démarrage...');
    
    chargerHausses();
    
    initialiserFormulaireHausse();
    initialiserRecherche();
    initialiserNavigationModal();
    initialiserEntretien();
    initialiserPoses();
    
    afficherHausses();
    mettreAJourStatistiques();
    
    // Fermer les modals en cliquant en dehors
    document.getElementById('modal-hausse').addEventListener('click', (e) => {
        if (e.target.id === 'modal-hausse') {
            fermerModalHausse();
        }
    });
    
    document.getElementById('modal-etiquette').addEventListener('click', (e) => {
        if (e.target.id === 'modal-etiquette') {
            fermerModalEtiquette();
        }
    });
    
    console.log('✅ Module Hausses initialisé');
});