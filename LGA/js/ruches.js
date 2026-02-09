// ========================================
// GESTION DES RUCHES ET CONSOMMATION
// ========================================

let ruches = [];
let rucheActive = null;

// Prix moyen de référence pour le miel (€/kg)
const PRIX_MIEL_REFERENCE = 16;

// ========================================
// STORAGE
// ========================================

function sauvegarderRuches() {
    try {
        localStorage.setItem('lga_ruches', JSON.stringify(ruches));
        console.log('Ruches sauvegardées:', ruches.length);
    } catch (error) {
        console.error('Erreur sauvegarde ruches:', error);
    }
}

function chargerRuches() {
    try {
        const data = localStorage.getItem('lga_ruches');
        if (data) {
            ruches = JSON.parse(data);
            console.log('Ruches chargées:', ruches.length);
        }
    } catch (error) {
        console.error('Erreur chargement ruches:', error);
    }
}

// ========================================
// CALCULS
// ========================================

function calculerCoutsRuche(ruche) {
    const coutNourr = (ruche.nourrissement || []).reduce((sum, n) => sum + (n.quantite * n.coutUnitaire), 0);
    const coutTrait = (ruche.traitements || []).reduce((sum, t) => sum + t.cout, 0);
    const coutMat = (ruche.materiel || []).reduce((sum, m) => sum + m.cout, 0);
    const coutReines = (ruche.reines || []).reduce((sum, r) => sum + r.cout, 0);
    
    return {
        nourrissement: coutNourr,
        traitements: coutTrait,
        materiel: coutMat,
        reines: coutReines,
        total: coutNourr + coutTrait + coutMat + coutReines
    };
}

function calculerProductionRuche(ruche) {
    const productions = ruche.production || [];
    const totalKg = productions.reduce((sum, p) => sum + p.quantite, 0);
    const valeurEstimee = totalKg * PRIX_MIEL_REFERENCE;
    
    return { totalKg, valeurEstimee };
}

function calculerMargeRuche(ruche) {
    const couts = calculerCoutsRuche(ruche);
    const prod = calculerProductionRuche(ruche);
    const marge = prod.valeurEstimee - couts.total;
    const rentabilite = couts.total > 0 ? ((marge / couts.total) * 100) : 0;
    
    return { marge, rentabilite };
}

function calculerStatistiquesGlobales() {
    const totalRuches = ruches.length;
    const coutTotal = ruches.reduce((sum, r) => sum + calculerCoutsRuche(r).total, 0);
    const prodTotal = ruches.reduce((sum, r) => sum + calculerProductionRuche(r).totalKg, 0);
    const margeTotal = ruches.reduce((sum, r) => sum + calculerMargeRuche(r).marge, 0);
    const margeMoyenne = totalRuches > 0 ? margeTotal / totalRuches : 0;
    
    return { totalRuches, coutTotal, prodTotal, margeMoyenne };
}

// ========================================
// AFFICHAGE
// ========================================

function mettreAJourStatistiques() {
    const stats = calculerStatistiquesGlobales();
    
    document.getElementById('total-ruches').textContent = stats.totalRuches;
    document.getElementById('cout-total-ressources').textContent = stats.coutTotal.toFixed(2) + ' €';
    document.getElementById('production-totale').textContent = stats.prodTotal.toFixed(1) + ' kg';
    document.getElementById('marge-moyenne').textContent = stats.margeMoyenne.toFixed(2) + ' €';
}

function afficherRuches() {
    const container = document.getElementById('liste-ruches');
    
    if (ruches.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucune ruche enregistrée. Ajoutez votre première ruche ci-dessus.</p>';
        return;
    }
    
    container.innerHTML = ruches.map(ruche => {
        const couts = calculerCoutsRuche(ruche);
        const prod = calculerProductionRuche(ruche);
        const marge = calculerMargeRuche(ruche);
        const totalCadres = (ruche.materiel || []).reduce((sum, m) => sum + m.nbCadres, 0);
        
        return `
            <div class="ruche-card" onclick="ouvrirModalRuche('${ruche.id}')">
                <div class="ruche-header">
                    <div>
                        <div class="ruche-nom">${ruche.nom}</div>
                        <div class="ruche-rucher">📍 ${ruche.rucher} • ${ruche.type}</div>
                    </div>
                    <button class="ruche-delete" onclick="event.stopPropagation(); supprimerRuche('${ruche.id}')">
                        ✕
                    </button>
                </div>
                
                <div class="ruche-info">
                    <div class="ruche-info-item">
                        <span class="ruche-info-label">Coûts totaux :</span>
                        <span class="ruche-info-value">${couts.total.toFixed(2)} €</span>
                    </div>
                    <div class="ruche-info-item">
                        <span class="ruche-info-label">Production :</span>
                        <span class="ruche-info-value">${prod.totalKg.toFixed(1)} kg</span>
                    </div>
                    <div class="ruche-info-item">
                        <span class="ruche-info-label">Cadres installés :</span>
                        <span class="ruche-info-value">${totalCadres}</span>
                    </div>
                </div>
                
                <div class="ruche-marge ${marge.marge >= 0 ? 'positive' : 'negative'}">
                    Marge: ${marge.marge.toFixed(2)} € (${marge.rentabilite.toFixed(0)}%)
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// GESTION DES RUCHES
// ========================================

function initialiserFormulaireRuche() {
    const form = document.getElementById('form-ruche');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const ruche = {
            id: Date.now().toString(),
            nom: document.getElementById('ruche-nom').value,
            rucher: document.getElementById('ruche-rucher').value,
            type: document.getElementById('ruche-type').value,
            annee: document.getElementById('ruche-annee').value || new Date().getFullYear(),
            nourrissement: [],
            traitements: [],
            materiel: [],
            reines: [],
            production: []
        };
        
        ruches.push(ruche);
        sauvegarderRuches();
        afficherRuches();
        mettreAJourStatistiques();
        
        form.reset();
        alert('Ruche ajoutée avec succès !');
    });
}

function supprimerRuche(id) {
    if (confirm('Voulez-vous vraiment supprimer cette ruche et toutes ses données ?')) {
        ruches = ruches.filter(r => r.id !== id);
        sauvegarderRuches();
        afficherRuches();
        mettreAJourStatistiques();
    }
}

// ========================================
// MODAL
// ========================================

function ouvrirModalRuche(id) {
    const ruche = ruches.find(r => r.id === id);
    if (!ruche) return;
    
    rucheActive = ruche;
    document.getElementById('modal-titre').textContent = `${ruche.nom} - ${ruche.rucher}`;
    
    // Afficher les données
    afficherNourrissement();
    afficherTraitements();
    afficherMateriel();
    afficherReines();
    afficherProductionRuche();
    afficherBilan();
    
    // Ouvrir le modal
    document.getElementById('modal-ruche').classList.add('active');
    
    // Réinitialiser à l'onglet nourrissement
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="nourrissement"]').classList.add('active');
    document.getElementById('tab-nourrissement').classList.add('active');
}

function fermerModal() {
    document.getElementById('modal-ruche').classList.remove('active');
    rucheActive = null;
}

function initialiserNavigationModal() {
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });
}

// ========================================
// NOURRISSEMENT
// ========================================

function initialiserNourrissement() {
    const form = document.getElementById('form-nourrissement');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!rucheActive) return;
        
        const nourr = {
            id: Date.now(),
            type: document.getElementById('nourr-type').value,
            quantite: parseFloat(document.getElementById('nourr-quantite').value),
            coutUnitaire: parseFloat(document.getElementById('nourr-cout').value),
            date: document.getElementById('nourr-date').value
        };
        
        rucheActive.nourrissement.push(nourr);
        sauvegarderRuches();
        afficherNourrissement();
        afficherBilan();
        afficherRuches();
        mettreAJourStatistiques();
        
        form.reset();
    });
}

function afficherNourrissement() {
    if (!rucheActive) return;
    
    const tbody = document.querySelector('#table-nourrissement tbody');
    const nourrissements = rucheActive.nourrissement || [];
    
    if (nourrissements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Aucun nourrissement</td></tr>';
        document.getElementById('total-nourr').textContent = '0.00 €';
        return;
    }
    
    const total = nourrissements.reduce((sum, n) => sum + (n.quantite * n.coutUnitaire), 0);
    
    tbody.innerHTML = nourrissements.map(n => `
        <tr>
            <td>${new Date(n.date).toLocaleDateString('fr-FR')}</td>
            <td>${n.type}</td>
            <td>${n.quantite.toFixed(1)} kg</td>
            <td>${(n.quantite * n.coutUnitaire).toFixed(2)} €</td>
            <td>
                <button class="btn-delete" onclick="supprimerNourrissement(${n.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('total-nourr').textContent = total.toFixed(2) + ' €';
}

function supprimerNourrissement(id) {
    if (!rucheActive) return;
    rucheActive.nourrissement = rucheActive.nourrissement.filter(n => n.id !== id);
    sauvegarderRuches();
    afficherNourrissement();
    afficherBilan();
    afficherRuches();
    mettreAJourStatistiques();
}

// ========================================
// TRAITEMENTS
// ========================================

function initialiserTraitements() {
    const form = document.getElementById('form-traitement');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!rucheActive) return;
        
        const trait = {
            id: Date.now(),
            nom: document.getElementById('trait-nom').value,
            quantite: parseInt(document.getElementById('trait-quantite').value),
            cout: parseFloat(document.getElementById('trait-cout').value),
            date: document.getElementById('trait-date').value
        };
        
        rucheActive.traitements.push(trait);
        sauvegarderRuches();
        afficherTraitements();
        afficherBilan();
        afficherRuches();
        mettreAJourStatistiques();
        
        form.reset();
    });
}

function afficherTraitements() {
    if (!rucheActive) return;
    
    const tbody = document.querySelector('#table-traitements tbody');
    const traitements = rucheActive.traitements || [];
    
    if (traitements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Aucun traitement</td></tr>';
        document.getElementById('total-trait').textContent = '0.00 €';
        return;
    }
    
    const total = traitements.reduce((sum, t) => sum + t.cout, 0);
    
    tbody.innerHTML = traitements.map(t => `
        <tr>
            <td>${new Date(t.date).toLocaleDateString('fr-FR')}</td>
            <td>${t.nom}</td>
            <td>${t.quantite}</td>
            <td>${t.cout.toFixed(2)} €</td>
            <td>
                <button class="btn-delete" onclick="supprimerTraitement(${t.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('total-trait').textContent = total.toFixed(2) + ' €';
}

function supprimerTraitement(id) {
    if (!rucheActive) return;
    rucheActive.traitements = rucheActive.traitements.filter(t => t.id !== id);
    sauvegarderRuches();
    afficherTraitements();
    afficherBilan();
    afficherRuches();
    mettreAJourStatistiques();
}

// ========================================
// MATÉRIEL (CADRES)
// ========================================

function initialiserMateriel() {
    const form = document.getElementById('form-materiel');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!rucheActive) return;
        
        const mat = {
            id: Date.now(),
            nbCadres: parseInt(document.getElementById('mat-cadres').value),
            cout: parseFloat(document.getElementById('mat-cout').value),
            date: document.getElementById('mat-date').value
        };
        
        rucheActive.materiel.push(mat);
        sauvegarderRuches();
        afficherMateriel();
        afficherBilan();
        afficherRuches();
        mettreAJourStatistiques();
        
        form.reset();
    });
}

function afficherMateriel() {
    if (!rucheActive) return;
    
    const tbody = document.querySelector('#table-materiel tbody');
    const materiel = rucheActive.materiel || [];
    
    if (materiel.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Aucun matériel</td></tr>';
        document.getElementById('total-mat').textContent = '0.00 €';
        document.getElementById('total-cadres').textContent = '0';
        return;
    }
    
    const totalCout = materiel.reduce((sum, m) => sum + m.cout, 0);
    const totalCadres = materiel.reduce((sum, m) => sum + m.nbCadres, 0);
    
    tbody.innerHTML = materiel.map(m => `
        <tr>
            <td>${new Date(m.date).toLocaleDateString('fr-FR')}</td>
            <td>${m.nbCadres}</td>
            <td>${m.cout.toFixed(2)} €</td>
            <td>
                <button class="btn-delete" onclick="supprimerMateriel(${m.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('total-mat').textContent = totalCout.toFixed(2) + ' €';
    document.getElementById('total-cadres').textContent = totalCadres;
}

function supprimerMateriel(id) {
    if (!rucheActive) return;
    rucheActive.materiel = rucheActive.materiel.filter(m => m.id !== id);
    sauvegarderRuches();
    afficherMateriel();
    afficherBilan();
    afficherRuches();
    mettreAJourStatistiques();
}

// ========================================
// REINES
// ========================================

function initialiserReines() {
    const form = document.getElementById('form-reine');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!rucheActive) return;
        
        const reine = {
            id: Date.now(),
            action: document.getElementById('reine-action').value,
            cout: parseFloat(document.getElementById('reine-cout').value),
            date: document.getElementById('reine-date').value,
            origine: document.getElementById('reine-origine').value || '-'
        };
        
        rucheActive.reines.push(reine);
        sauvegarderRuches();
        afficherReines();
        afficherBilan();
        afficherRuches();
        mettreAJourStatistiques();
        
        form.reset();
    });
}

function afficherReines() {
    if (!rucheActive) return;
    
    const tbody = document.querySelector('#table-reines tbody');
    const reines = rucheActive.reines || [];
    
    if (reines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Aucune reine</td></tr>';
        document.getElementById('total-reines').textContent = '0.00 €';
        return;
    }
    
    const total = reines.reduce((sum, r) => sum + r.cout, 0);
    
    tbody.innerHTML = reines.map(r => `
        <tr>
            <td>${new Date(r.date).toLocaleDateString('fr-FR')}</td>
            <td>${r.action}</td>
            <td>${r.origine}</td>
            <td>${r.cout.toFixed(2)} €</td>
            <td>
                <button class="btn-delete" onclick="supprimerReine(${r.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('total-reines').textContent = total.toFixed(2) + ' €';
}

function supprimerReine(id) {
    if (!rucheActive) return;
    rucheActive.reines = rucheActive.reines.filter(r => r.id !== id);
    sauvegarderRuches();
    afficherReines();
    afficherBilan();
    afficherRuches();
    mettreAJourStatistiques();
}

// ========================================
// PRODUCTION
// ========================================

function initialiserProductionRuche() {
    const form = document.getElementById('form-production-ruche');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!rucheActive) return;
        
        const prod = {
            id: Date.now(),
            quantite: parseFloat(document.getElementById('prod-quantite').value),
            date: document.getElementById('prod-date').value,
            typeMiel: document.getElementById('prod-type-miel').value,
            lot: document.getElementById('prod-lot').value || '-'
        };
        
        rucheActive.production.push(prod);
        sauvegarderRuches();
        afficherProductionRuche();
        afficherBilan();
        afficherRuches();
        mettreAJourStatistiques();
        
        form.reset();
    });
}

function afficherProductionRuche() {
    if (!rucheActive) return;
    
    const tbody = document.querySelector('#table-production-ruche tbody');
    const productions = rucheActive.production || [];
    
    if (productions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Aucune production</td></tr>';
        document.getElementById('total-prod').textContent = '0 kg';
        return;
    }
    
    const total = productions.reduce((sum, p) => sum + p.quantite, 0);
    
    tbody.innerHTML = productions.map(p => `
        <tr>
            <td>${new Date(p.date).toLocaleDateString('fr-FR')}</td>
            <td>${p.typeMiel}</td>
            <td>${p.quantite.toFixed(1)} kg</td>
            <td>${p.lot}</td>
            <td>
                <button class="btn-delete" onclick="supprimerProduction(${p.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('total-prod').textContent = total.toFixed(1) + ' kg';
}

function supprimerProduction(id) {
    if (!rucheActive) return;
    rucheActive.production = rucheActive.production.filter(p => p.id !== id);
    sauvegarderRuches();
    afficherProductionRuche();
    afficherBilan();
    afficherRuches();
    mettreAJourStatistiques();
}

// ========================================
// BILAN
// ========================================

function afficherBilan() {
    if (!rucheActive) return;
    
    const couts = calculerCoutsRuche(rucheActive);
    const prod = calculerProductionRuche(rucheActive);
    const marge = calculerMargeRuche(rucheActive);
    
    // Coûts
    document.getElementById('bilan-nourr').textContent = couts.nourrissement.toFixed(2) + ' €';
    document.getElementById('bilan-trait').textContent = couts.traitements.toFixed(2) + ' €';
    document.getElementById('bilan-mat').textContent = couts.materiel.toFixed(2) + ' €';
    document.getElementById('bilan-reines').textContent = couts.reines.toFixed(2) + ' €';
    document.getElementById('bilan-total-depenses').textContent = couts.total.toFixed(2) + ' €';
    
    // Production
    document.getElementById('bilan-prod-kg').textContent = prod.totalKg.toFixed(1) + ' kg';
    document.getElementById('bilan-prod-valeur').textContent = prod.valeurEstimee.toFixed(2) + ' €';
    
    // Résultat
    const margeElement = document.getElementById('bilan-marge');
    margeElement.textContent = marge.marge.toFixed(2) + ' €';
    margeElement.className = marge.marge >= 0 ? 'marge-positive' : 'marge-negative';
    
    document.getElementById('bilan-rentabilite').textContent = marge.rentabilite.toFixed(1) + ' %';
}

// ========================================
// INITIALISATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🐝 Module Ruches - Démarrage...');
    
    chargerRuches();
    
    initialiserFormulaireRuche();
    initialiserNavigationModal();
    initialiserNourrissement();
    initialiserTraitements();
    initialiserMateriel();
    initialiserReines();
    initialiserProductionRuche();
    
    afficherRuches();
    mettreAJourStatistiques();
    
    // Fermer le modal en cliquant en dehors
    document.getElementById('modal-ruche').addEventListener('click', (e) => {
        if (e.target.id === 'modal-ruche') {
            fermerModal();
        }
    });
    
    console.log('✅ Module Ruches initialisé');
});