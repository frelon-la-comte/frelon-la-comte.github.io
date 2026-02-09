// ===========================
// LOGICIEL DE GESTION APICOLE
// ===========================

// Variables globales
let ventes = [];
let depenses = [];
let stockPots = [];
let stockFournitures = [];
let lotsProduction = [];
let soldeInitial = 0;

const REDUCTION_PAR_POT = 0.50; // € par pot rendu

// ===========================
// GESTION DU STORAGE (LocalStorage)
// ===========================

function sauvegarderDonnees() {
    try {
        localStorage.setItem('lga_ventes', JSON.stringify(ventes));
        localStorage.setItem('lga_depenses', JSON.stringify(depenses));
        localStorage.setItem('lga_stock_pots', JSON.stringify(stockPots));
        localStorage.setItem('lga_stock_fournitures', JSON.stringify(stockFournitures));
        localStorage.setItem('lga_lots_production', JSON.stringify(lotsProduction));
        localStorage.setItem('lga_solde_initial', soldeInitial.toString());
        
        // Sauvegarde dans le dossier data (log)
        const timestamp = new Date().toISOString();
        const logData = {
            timestamp: timestamp,
            ventes: ventes.length,
            depenses: depenses.length,
            stocks: {
                pots: stockPots.length,
                fournitures: stockFournitures.length
            },
            lots: lotsProduction.length,
            soldeInitial: soldeInitial
        };
        
        console.log('Données sauvegardées:', logData);
        localStorage.setItem('lga_last_save', JSON.stringify(logData));
        
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        alert('Erreur lors de la sauvegarde des données');
    }
}

function chargerDonnees() {
    try {
        const ventesData = localStorage.getItem('lga_ventes');
        const depensesData = localStorage.getItem('lga_depenses');
        const potsData = localStorage.getItem('lga_stock_pots');
        const fournData = localStorage.getItem('lga_stock_fournitures');
        const lotsData = localStorage.getItem('lga_lots_production');
        const soldeInitialData = localStorage.getItem('lga_solde_initial');
        
        if (ventesData) ventes = JSON.parse(ventesData);
        if (depensesData) depenses = JSON.parse(depensesData);
        if (potsData) stockPots = JSON.parse(potsData);
        if (fournData) stockFournitures = JSON.parse(fournData);
        if (lotsData) lotsProduction = JSON.parse(lotsData);
        if (soldeInitialData) soldeInitial = parseFloat(soldeInitialData);
        
        console.log('Données chargées avec succès');
    } catch (error) {
        console.error('Erreur lors du chargement:', error);
    }
}

function exporterDonnees() {
    const data = {
        ventes: ventes,
        depenses: depenses,
        stockPots: stockPots,
        stockFournitures: stockFournitures,
        lotsProduction: lotsProduction,
        dateExport: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lga_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

// ===========================
// GESTION DE LA NAVIGATION
// ===========================

function initialiserNavigation() {
    // Navigation principale
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // Mise à jour des boutons
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Mise à jour du contenu
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tab).classList.add('active');
        });
    });
    
    // Sous-navigation (stocks)
    const subNavBtns = document.querySelectorAll('.sub-nav-btn');
    subNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const subtab = btn.dataset.subtab;
            
            subNavBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.sub-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(subtab).classList.add('active');
        });
    });
}

// ===========================
// CALCULS FINANCIERS
// ===========================

function calculerStatistiques() {
    const totalVentes = ventes.reduce((sum, v) => sum + v.montant, 0);
    const totalDepenses = depenses.reduce((sum, d) => sum + d.montant, 0);
    const solde = soldeInitial + totalVentes - totalDepenses;
    
    return { totalVentes, totalDepenses, solde };
}

function mettreAJourDashboard() {
    const stats = calculerStatistiques();
    
    // Mise à jour des statistiques
    document.getElementById('total-recettes').textContent = stats.totalVentes.toFixed(2) + ' €';
    document.getElementById('total-depenses').textContent = stats.totalDepenses.toFixed(2) + ' €';
    document.getElementById('total-solde').textContent = stats.solde.toFixed(2) + ' €';
    
    // Valeur du stock
    const valeurStock = calculerValeurStock();
    document.getElementById('valeur-stock').textContent = valeurStock.toFixed(2) + ' €';
    
    // Mise à jour du label et style du solde
    const soldeCard = document.querySelector('.stat-solde');
    const soldeLabel = document.getElementById('solde-label');
    
    if (stats.solde >= 0) {
        soldeLabel.textContent = 'Crédit';
        soldeCard.classList.remove('deficit');
    } else {
        soldeLabel.textContent = 'Déficit';
        soldeCard.classList.add('deficit');
    }
    
    // Vérification péremption
    const nbPerimes = verifierPeremption();
    const alertPeremption = document.getElementById('alert-peremption');
    if (nbPerimes > 0) {
        alertPeremption.style.display = 'flex';
        document.getElementById('nb-perimes').textContent = nbPerimes;
    } else {
        alertPeremption.style.display = 'none';
    }
    
    // Dernières ventes
    const dernieresVentesDiv = document.getElementById('dernieres-ventes');
    if (ventes.length === 0) {
        dernieresVentesDiv.innerHTML = '<p class="empty-message">Aucune vente enregistrée</p>';
    } else {
        const derniers5 = ventes.slice(-5).reverse();
        dernieresVentesDiv.innerHTML = derniers5.map(v => `
            <div class="vente-item">
                <span>${v.produit} (x${v.quantite})</span>
                <span class="vente-montant">${v.montant.toFixed(2)} €</span>
            </div>
        `).join('');
    }
    
    // État des stocks
    const totalPots = stockPots.reduce((sum, p) => sum + p.quantite, 0);
    document.getElementById('total-pots').textContent = totalPots + ' unités';
    document.getElementById('total-fournitures').textContent = stockFournitures.length + ' références';
    document.getElementById('total-lots').textContent = lotsProduction.length + ' lots';
}

// ===========================
// GESTION DES VENTES
// ===========================

function initialiserVentes() {
    const form = document.getElementById('form-vente');
    const selectProduit = document.getElementById('vente-produit');
    const inputPrix = document.getElementById('vente-prix');
    const inputQuantite = document.getElementById('vente-quantite');
    const inputPotsRendus = document.getElementById('vente-pots-rendus');
    const totalDiv = document.getElementById('vente-total');
    const reductionDiv = document.getElementById('vente-reduction');
    
    // Charger la liste des clients
    chargerListeClients();
    
    // Mise à jour automatique du prix
    selectProduit.addEventListener('change', (e) => {
        const option = e.target.selectedOptions[0];
        const prix = option.dataset.prix;
        if (prix) {
            inputPrix.value = prix;
            calculerTotalVente();
        }
    });
    
    inputQuantite.addEventListener('input', calculerTotalVente);
    inputPrix.addEventListener('input', calculerTotalVente);
    inputPotsRendus.addEventListener('input', calculerTotalVente);
    
    function calculerTotalVente() {
        const qte = parseFloat(inputQuantite.value) || 0;
        const prix = parseFloat(inputPrix.value) || 0;
        const potsRendus = parseInt(inputPotsRendus.value) || 0;
        const reduction = potsRendus * REDUCTION_PAR_POT;
        const sousTotal = qte * prix;
        const total = sousTotal - reduction;
        
        if (sousTotal > 0) {
            totalDiv.textContent = `Sous-total: ${sousTotal.toFixed(2)} €`;
            totalDiv.style.display = 'block';
            
            if (reduction > 0) {
                reductionDiv.textContent = `Réduction consignes (${potsRendus} pots) : -${reduction.toFixed(2)} € → Total: ${total.toFixed(2)} €`;
                reductionDiv.style.display = 'block';
            } else {
                reductionDiv.style.display = 'none';
            }
        } else {
            totalDiv.style.display = 'none';
            reductionDiv.style.display = 'none';
        }
    }
    
    // Soumission du formulaire
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const quantite = parseInt(inputQuantite.value);
        const prixUnit = parseFloat(inputPrix.value);
        const potsRendus = parseInt(inputPotsRendus.value) || 0;
        const reduction = potsRendus * REDUCTION_PAR_POT;
        const montantBrut = quantite * prixUnit;
        const montantNet = montantBrut - reduction;
        
        const vente = {
            id: Date.now(),
            date: new Date().toISOString(),
            clientId: document.getElementById('vente-client').value || null,
            produit: selectProduit.value,
            quantite: quantite,
            prixUnit: prixUnit,
            potsRendus: potsRendus,
            reduction: reduction,
            montant: montantNet,
            montantBrut: montantBrut,
            lotProduction: document.getElementById('vente-lot').value
        };
        
        ventes.push(vente);
        
        // Si vente associée à un client, l'enregistrer dans son historique
        if (vente.clientId) {
            enregistrerVenteClient(vente);
        }
        
        sauvegarderDonnees();
        afficherVentes();
        mettreAJourDashboard();
        mettreAJourLotsSelect();
        
        form.reset();
        document.getElementById('vente-pots-rendus').value = 0;
        totalDiv.style.display = 'none';
        reductionDiv.style.display = 'none';
        
        const msg = reduction > 0 
            ? `Vente enregistrée avec réduction de ${reduction.toFixed(2)}€ pour ${potsRendus} pots rendus !`
            : 'Vente enregistrée avec succès !';
        alert(msg);
    });
    
    afficherVentes();
}

function chargerListeClients() {
    try {
        const clientsData = localStorage.getItem('lga_clients');
        if (clientsData) {
            const clients = JSON.parse(clientsData);
            const select = document.getElementById('vente-client');
            
            select.innerHTML = '<option value="">Client (optionnel)</option>' + 
                clients.map(c => `<option value="${c.id}">${c.prenom} ${c.nom}</option>`).join('');
        }
    } catch (error) {
        console.error('Erreur chargement clients:', error);
    }
}

function enregistrerVenteClient(vente) {
    try {
        const clientsData = localStorage.getItem('lga_clients');
        if (!clientsData) return;
        
        const clients = JSON.parse(clientsData);
        const client = clients.find(c => c.id === vente.clientId);
        
        if (client) {
            if (!client.achats) client.achats = [];
            
            client.achats.push({
                date: vente.date,
                produit: vente.produit,
                quantite: vente.quantite,
                prixUnitaire: vente.prixUnit,
                reduction: vente.reduction,
                montantTotal: vente.montant
            });
            
            // Si pots rendus, ajouter dans les consignes
            if (vente.potsRendus > 0) {
                if (!client.consignes) client.consignes = [];
                client.consignes.push({
                    id: Date.now(),
                    action: 'Rendu',
                    type: 'Divers',
                    quantite: vente.potsRendus,
                    date: vente.date.split('T')[0],
                    reduction: vente.reduction
                });
            }
            
            localStorage.setItem('lga_clients', JSON.stringify(clients));
        }
    } catch (error) {
        console.error('Erreur enregistrement vente client:', error);
    }
}

function afficherVentes() {
    const tbody = document.querySelector('#table-ventes tbody');
    
    if (ventes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-message">Aucune vente enregistrée</td></tr>';
        return;
    }
    
    // Charger les clients pour afficher les noms
    let clients = [];
    try {
        const clientsData = localStorage.getItem('lga_clients');
        if (clientsData) clients = JSON.parse(clientsData);
    } catch (e) {}
    
    tbody.innerHTML = ventes.map(v => {
        const client = v.clientId ? clients.find(c => c.id === v.clientId) : null;
        const nomClient = client ? `${client.prenom} ${client.nom}` : '-';
        
        return `
        <tr>
            <td>${new Date(v.date).toLocaleDateString('fr-FR')}</td>
            <td>${nomClient}</td>
            <td>${v.produit}</td>
            <td>${v.quantite}</td>
            <td>${v.prixUnit.toFixed(2)} €</td>
            <td style="color: ${v.reduction > 0 ? '#f44336' : '#666'}; font-weight: ${v.reduction > 0 ? 'bold' : 'normal'};">
                ${v.reduction > 0 ? '-' + v.reduction.toFixed(2) + ' €' : '-'}
            </td>
            <td>${v.lotProduction || '-'}</td>
            <td style="font-weight: bold; color: #28a745;">${v.montant.toFixed(2)} €</td>
            <td>
                <button class="btn-delete" onclick="supprimerVente(${v.id})">Supprimer</button>
            </td>
        </tr>
    `;
    }).join('');
}

function supprimerVente(id) {
    if (confirm('Voulez-vous vraiment supprimer cette vente ?')) {
        ventes = ventes.filter(v => v.id !== id);
        sauvegarderDonnees();
        afficherVentes();
        mettreAJourDashboard();
    }
}

// ===========================
// GESTION DES DÉPENSES
// ===========================

function initialiserDepenses() {
    const form = document.getElementById('form-depense');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const depense = {
            id: Date.now(),
            date: new Date().toISOString(),
            description: document.getElementById('depense-description').value,
            montant: parseFloat(document.getElementById('depense-montant').value)
        };
        
        depenses.push(depense);
        sauvegarderDonnees();
        afficherDepenses();
        mettreAJourDashboard();
        
        form.reset();
        alert('Dépense enregistrée avec succès !');
    });
    
    afficherDepenses();
}

function afficherDepenses() {
    const tbody = document.querySelector('#table-depenses tbody');
    
    if (depenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Aucune dépense enregistrée</td></tr>';
        return;
    }
    
    tbody.innerHTML = depenses.map(d => `
        <tr>
            <td>${new Date(d.date).toLocaleDateString('fr-FR')}</td>
            <td>${d.description}</td>
            <td style="font-weight: bold; color: #dc3545;">${d.montant.toFixed(2)} €</td>
            <td>
                <button class="btn-delete" onclick="supprimerDepense(${d.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
}

function supprimerDepense(id) {
    if (confirm('Voulez-vous vraiment supprimer cette dépense ?')) {
        depenses = depenses.filter(d => d.id !== id);
        sauvegarderDonnees();
        afficherDepenses();
        mettreAJourDashboard();
    }
}

// ===========================
// GESTION DES STOCKS
// ===========================

function initialiserStocks() {
    // Formulaire pots
    const formPot = document.getElementById('form-pot');
    formPot.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const pot = {
            id: Date.now(),
            type: document.getElementById('pot-type').value,
            quantite: parseInt(document.getElementById('pot-quantite').value),
            numeroLot: document.getElementById('pot-lot').value
        };
        
        stockPots.push(pot);
        sauvegarderDonnees();
        afficherStockPots();
        mettreAJourDashboard();
        
        formPot.reset();
        alert('Pots ajoutés au stock !');
    });
    
    // Formulaire fournitures
    const formFourniture = document.getElementById('form-fourniture');
    formFourniture.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const fourniture = {
            id: Date.now(),
            nom: document.getElementById('fourniture-nom').value,
            quantite: parseInt(document.getElementById('fourniture-quantite').value),
            unite: document.getElementById('fourniture-unite').value,
            numeroLot: document.getElementById('fourniture-lot').value
        };
        
        stockFournitures.push(fourniture);
        sauvegarderDonnees();
        afficherStockFournitures();
        mettreAJourDashboard();
        
        formFourniture.reset();
        alert('Fourniture ajoutée au stock !');
    });
    
    afficherStockPots();
    afficherStockFournitures();
}

function afficherStockPots() {
    const tbody = document.querySelector('#table-pots tbody');
    
    if (stockPots.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Aucun pot en stock</td></tr>';
        return;
    }
    
    tbody.innerHTML = stockPots.map(p => `
        <tr>
            <td>${p.type}</td>
            <td style="font-weight: bold;">${p.quantite}</td>
            <td>${p.numeroLot}</td>
            <td>
                <button class="btn-delete" onclick="supprimerPot(${p.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
}

function supprimerPot(id) {
    if (confirm('Voulez-vous vraiment supprimer ce stock de pots ?')) {
        stockPots = stockPots.filter(p => p.id !== id);
        sauvegarderDonnees();
        afficherStockPots();
        mettreAJourDashboard();
    }
}

function afficherStockFournitures() {
    const tbody = document.querySelector('#table-fournitures tbody');
    
    if (stockFournitures.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Aucune fourniture en stock</td></tr>';
        return;
    }
    
    tbody.innerHTML = stockFournitures.map(f => `
        <tr>
            <td>${f.nom}</td>
            <td style="font-weight: bold;">${f.quantite} ${f.unite}</td>
            <td>${f.numeroLot}</td>
            <td>
                <button class="btn-delete" onclick="supprimerFourniture(${f.id})">Supprimer</button>
            </td>
        </tr>
    `).join('');
}

function supprimerFourniture(id) {
    if (confirm('Voulez-vous vraiment supprimer cette fourniture ?')) {
        stockFournitures = stockFournitures.filter(f => f.id !== id);
        sauvegarderDonnees();
        afficherStockFournitures();
        mettreAJourDashboard();
    }
}

// ===========================
// GESTION DE LA PRODUCTION
// ===========================

function initialiserProduction() {
    const form = document.getElementById('form-production');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const lot = {
            id: Date.now(),
            numero: document.getElementById('prod-numero').value,
            type: document.getElementById('prod-type').value,
            quantite: parseFloat(document.getElementById('prod-quantite').value),
            dateRecolte: document.getElementById('prod-date').value,
            rucher: document.getElementById('prod-rucher').value,
            prixKg: parseFloat(document.getElementById('prod-prix-kg').value) || 16
        };
        
        lotsProduction.push(lot);
        sauvegarderDonnees();
        afficherProduction();
        mettreAJourDashboard();
        mettreAJourLotsSelect();
        
        form.reset();
        // Réinitialiser le prix par défaut
        document.getElementById('prod-prix-kg').value = 16;
        alert('Lot de production ajouté !');
    });
    
    afficherProduction();
    mettreAJourLotsSelect();
}

function afficherProduction() {
    const tbody = document.querySelector('#table-production tbody');
    
    if (lotsProduction.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-message">Aucun lot de production</td></tr>';
        return;
    }
    
    const anneeActuelle = new Date().getFullYear();
    
    tbody.innerHTML = lotsProduction.map(lot => {
        const anneeRecolte = new Date(lot.dateRecolte).getFullYear();
        const anneePeremption = anneeRecolte + 2;
        const datePeremption = new Date(anneePeremption, 11, 31).toLocaleDateString('fr-FR');
        const prixKg = lot.prixKg || 16;
        const valeurTotale = lot.quantite * prixKg;
        
        let classPeremption = '';
        let statutPeremption = datePeremption;
        
        if (anneeActuelle > anneePeremption) {
            classPeremption = 'lot-perime';
            statutPeremption = '⚠️ PÉRIMÉ';
        } else if (anneeActuelle === anneePeremption) {
            classPeremption = 'lot-bientot-perime';
            statutPeremption = '⏰ ' + datePeremption;
        }
        
        return `
        <tr class="${classPeremption}">
            <td style="font-weight: bold;">${lot.numero}</td>
            <td>${lot.type}</td>
            <td>${lot.quantite.toFixed(1)} kg</td>
            <td>${new Date(lot.dateRecolte).toLocaleDateString('fr-FR')}</td>
            <td>${statutPeremption}</td>
            <td>${prixKg.toFixed(2)} €</td>
            <td style="font-weight: bold; color: #28a745;">${valeurTotale.toFixed(2)} €</td>
            <td>${lot.rucher}</td>
            <td>
                <button class="btn-delete" onclick="supprimerLot(${lot.id})">Supprimer</button>
            </td>
        </tr>
    `;
    }).join('');
}

function supprimerLot(id) {
    if (confirm('Voulez-vous vraiment supprimer ce lot de production ?')) {
        lotsProduction = lotsProduction.filter(lot => lot.id !== id);
        sauvegarderDonnees();
        afficherProduction();
        mettreAJourDashboard();
        mettreAJourLotsSelect();
    }
}

function mettreAJourLotsSelect() {
    const select = document.getElementById('vente-lot');
    
    select.innerHTML = '<option value="">Lot (optionnel)</option>' + 
        lotsProduction.map(lot => 
            `<option value="${lot.numero}">${lot.numero} - ${lot.type}</option>`
        ).join('');
}

// ===========================
// GESTION DU SOLDE INITIAL
// ===========================

function sauvegarderSoldeInitial() {
    const input = document.getElementById('solde-initial');
    soldeInitial = parseFloat(input.value) || 0;
    
    sauvegarderDonnees();
    mettreAJourDashboard();
    afficherSoldeInitial();
    
    alert(`Solde initial enregistré : ${soldeInitial.toFixed(2)} €`);
}

function afficherSoldeInitial() {
    const info = document.getElementById('solde-initial-info');
    if (soldeInitial !== 0) {
        info.textContent = `Solde initial : ${soldeInitial.toFixed(2)} €`;
        info.style.display = 'inline';
    } else {
        info.style.display = 'none';
    }
}

// ===========================
// INITIALISATION
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🐝 LGA - Logiciel de Gestion Apicole - Démarrage...');
    
    // Chargement des données
    chargerDonnees();
    
    // Initialisation des modules
    initialiserNavigation();
    initialiserVentes();
    initialiserDepenses();
    initialiserStocks();
    initialiserProduction();
    
    // Mise à jour du dashboard
    mettreAJourDashboard();
    
    console.log('✅ Application initialisée avec succès');
    
    // Charger le solde initial dans l'input
    document.getElementById('solde-initial').value = soldeInitial;
    afficherSoldeInitial();
    
    // Ajout d'un raccourci clavier pour exporter les données (Ctrl+E)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            exporterDonnees();
            alert('Données exportées !');
        }
    });
});