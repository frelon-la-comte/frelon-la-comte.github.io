// ========================================
// GESTION DES CLIENTS ET CONSIGNES
// ========================================

let clients = [];
let clientActif = null;

const REDUCTION_PAR_POT = 0.50; // Réduction en € par pot rendu

// ========================================
// STORAGE
// ========================================

function sauvegarderClients() {
    try {
        localStorage.setItem('lga_clients', JSON.stringify(clients));
        console.log('Clients sauvegardés:', clients.length);
    } catch (error) {
        console.error('Erreur sauvegarde clients:', error);
    }
}

function chargerClients() {
    try {
        const data = localStorage.getItem('lga_clients');
        if (data) {
            clients = JSON.parse(data);
            console.log('Clients chargés:', clients.length);
        }
    } catch (error) {
        console.error('Erreur chargement clients:', error);
    }
}

// ========================================
// CALCULS
// ========================================

function calculerStatsClient(client) {
    const commandes = client.commandes || [];
    const consignes = client.consignes || [];
    const achats = client.achats || [];
    
    // Commandes en cours
    const commandesEnCours = commandes.filter(c => c.statut !== 'Livrée').length;
    
    // Consignes actuelles
    const potsConsignes = consignes.reduce((sum, c) => {
        return sum + (c.action === 'Donné' ? c.quantite : -c.quantite);
    }, 0);
    
    // Pots rendus total
    const potsRendus = consignes.filter(c => c.action === 'Rendu')
        .reduce((sum, c) => sum + c.quantite, 0);
    
    // Chiffre d'affaires
    const ca = achats.reduce((sum, a) => sum + a.montantTotal, 0);
    
    // Total réductions accordées
    const reductions = achats.reduce((sum, a) => sum + (a.reduction || 0), 0);
    
    return { commandesEnCours, potsConsignes, potsRendus, ca, reductions, nbAchats: achats.length };
}

function calculerStatistiquesGlobales() {
    const totalClients = clients.length;
    const totalCommandes = clients.reduce((sum, c) => {
        const cmd = (c.commandes || []).filter(cmd => cmd.statut !== 'Livrée');
        return sum + cmd.length;
    }, 0);
    
    const totalConsignes = clients.reduce((sum, c) => {
        const stats = calculerStatsClient(c);
        return sum + stats.potsConsignes;
    }, 0);
    
    const impactConsignes = clients.reduce((sum, c) => {
        const stats = calculerStatsClient(c);
        return sum + stats.reductions;
    }, 0);
    
    return { totalClients, totalCommandes, totalConsignes, impactConsignes };
}

// ========================================
// ANALYSE HABITUDES
// ========================================

function analyserHabitudes(client) {
    const achats = client.achats || [];
    
    if (achats.length === 0) {
        return { produitsPreferes: [], frequence: null, recommandations: [] };
    }
    
    // Produits préférés
    const produitsCount = {};
    achats.forEach(a => {
        produitsCount[a.produit] = (produitsCount[a.produit] || 0) + a.quantite;
    });
    
    const produitsPreferes = Object.entries(produitsCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([produit, quantite]) => ({ produit, quantite }));
    
    // Fréquence
    const dates = achats.map(a => new Date(a.date)).sort((a, b) => a - b);
    const premierAchat = dates[0];
    const dernierAchat = dates[dates.length - 1];
    const nbAchats = achats.length;
    const panierMoyen = achats.reduce((sum, a) => sum + a.montantTotal, 0) / nbAchats;
    
    // Recommandations
    const recommandations = [];
    
    // Si client fidèle (3+ achats)
    if (nbAchats >= 3) {
        recommandations.push('Client fidèle ! Proposez une offre spéciale.');
    }
    
    // Si beaucoup de miel 500g
    if (produitsCount['Miel 500g'] >= 5) {
        recommandations.push('Propose régulièrement du miel 500g - Prévoir stock.');
    }
    
    // Si dernier achat > 3 mois
    const joursDepuisDernierAchat = (new Date() - dernierAchat) / (1000 * 60 * 60 * 24);
    if (joursDepuisDernierAchat > 90) {
        recommandations.push('Pas d\'achat depuis 3+ mois - Relancer ?');
    }
    
    // Si gros panier moyen
    if (panierMoyen > 50) {
        recommandations.push('Gros panier moyen - Client potentiel pour commandes spéciales.');
    }
    
    return {
        produitsPreferes,
        frequence: { premierAchat, dernierAchat, nbAchats, panierMoyen },
        recommandations
    };
}

// ========================================
// AFFICHAGE
// ========================================

function mettreAJourStatistiques() {
    const stats = calculerStatistiquesGlobales();
    
    document.getElementById('total-clients').textContent = stats.totalClients;
    document.getElementById('total-commandes').textContent = stats.totalCommandes;
    document.getElementById('total-consignes').textContent = stats.totalConsignes;
    document.getElementById('impact-consignes').textContent = stats.impactConsignes.toFixed(2) + ' €';
}

function afficherClients(filtreRecherche = '') {
    const container = document.getElementById('liste-clients');
    
    let clientsFiltres = clients;
    if (filtreRecherche) {
        const recherche = filtreRecherche.toLowerCase();
        clientsFiltres = clients.filter(c => 
            c.nom.toLowerCase().includes(recherche) ||
            c.prenom.toLowerCase().includes(recherche) ||
            (c.email && c.email.toLowerCase().includes(recherche))
        );
    }
    
    if (clientsFiltres.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucun client trouvé.</p>';
        return;
    }
    
    container.innerHTML = clientsFiltres.map(client => {
        const stats = calculerStatsClient(client);
        
        let badges = '';
        if (stats.commandesEnCours > 0) {
            badges += `<span class="badge badge-commande">${stats.commandesEnCours} commande(s)</span>`;
        }
        if (stats.potsConsignes > 0) {
            badges += `<span class="badge badge-consigne">${stats.potsConsignes} pot(s)</span>`;
        }
        if (stats.nbAchats >= 5) {
            badges += `<span class="badge badge-vip">VIP</span>`;
        }
        
        return `
            <div class="client-card" onclick="ouvrirModalClient('${client.id}')">
                <div class="client-header">
                    <div>
                        <div class="client-nom">${client.prenom} ${client.nom}</div>
                        <div class="client-email">${client.email || 'Pas d\'email'}</div>
                    </div>
                </div>
                
                <div class="client-badges">
                    ${badges}
                </div>
                
                <div class="client-stats">
                    <div class="client-stat-row">
                        <span class="client-stat-label">CA total:</span>
                        <span class="client-stat-value">${stats.ca.toFixed(2)} €</span>
                    </div>
                    <div class="client-stat-row">
                        <span class="client-stat-label">Achats:</span>
                        <span class="client-stat-value">${stats.nbAchats}</span>
                    </div>
                    <div class="client-stat-row">
                        <span class="client-stat-label">Réductions:</span>
                        <span class="client-stat-value" style="color: #f44336;">-${stats.reductions.toFixed(2)} €</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// GESTION DES CLIENTS
// ========================================

function initialiserFormulaireClient() {
    const form = document.getElementById('form-client');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const client = {
            id: Date.now().toString(),
            nom: document.getElementById('client-nom').value,
            prenom: document.getElementById('client-prenom').value,
            email: document.getElementById('client-email').value || '',
            tel: document.getElementById('client-tel').value || '',
            notes: document.getElementById('client-notes').value || '',
            commandes: [],
            consignes: [],
            achats: [],
            dateCreation: new Date().toISOString()
        };
        
        clients.push(client);
        sauvegarderClients();
        afficherClients();
        mettreAJourStatistiques();
        
        form.reset();
        alert('Client ajouté avec succès !');
    });
}

function supprimerClientActif() {
    if (!clientActif) return;
    
    if (confirm(`Voulez-vous vraiment supprimer ${clientActif.prenom} ${clientActif.nom} et toutes ses données ?`)) {
        clients = clients.filter(c => c.id !== clientActif.id);
        sauvegarderClients();
        fermerModalClient();
        afficherClients();
        mettreAJourStatistiques();
    }
}

// Recherche
function initialiserRecherche() {
    const searchInput = document.getElementById('search-client');
    searchInput.addEventListener('input', (e) => {
        afficherClients(e.target.value);
    });
}

// ========================================
// MODAL CLIENT
// ========================================

function ouvrirModalClient(id) {
    const client = clients.find(c => c.id === id);
    if (!client) return;
    
    clientActif = client;
    document.getElementById('modal-titre-client').textContent = `${client.prenom} ${client.nom}`;
    
    // Infos client
    document.getElementById('info-email').textContent = client.email || '-';
    document.getElementById('info-tel').textContent = client.tel || '-';
    document.getElementById('info-notes').textContent = client.notes || '-';
    
    // Stats
    const stats = calculerStatsClient(client);
    document.getElementById('stat-commandes-total').textContent = (client.commandes || []).length;
    document.getElementById('stat-ca-client').textContent = stats.ca.toFixed(2) + ' €';
    document.getElementById('stat-consignes-client').textContent = stats.potsConsignes;
    document.getElementById('stat-rendus-client').textContent = stats.potsRendus;
    
    // Afficher les données
    afficherCommandesClient();
    afficherConsignesClient();
    afficherHistoriqueClient();
    afficherHabitudesClient();
    
    // Ouvrir le modal
    document.getElementById('modal-client').classList.add('active');
    
    // Réinitialiser à l'onglet commandes
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="commandes"]').classList.add('active');
    document.getElementById('tab-commandes-client').classList.add('active');
}

function fermerModalClient() {
    document.getElementById('modal-client').classList.remove('active');
    clientActif = null;
}

function initialiserNavigationModal() {
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`tab-${targetTab}-client`).classList.add('active');
        });
    });
}

// ========================================
// COMMANDES
// ========================================

function initialiserCommandes() {
    const form = document.getElementById('form-commande');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!clientActif) return;
        
        const commande = {
            id: Date.now(),
            produit: document.getElementById('cmd-produit').value,
            quantite: parseInt(document.getElementById('cmd-quantite').value),
            dateLivraison: document.getElementById('cmd-date-livraison').value || null,
            statut: document.getElementById('cmd-statut').value,
            notes: document.getElementById('cmd-notes').value || '',
            dateCreation: new Date().toISOString()
        };
        
        if (!clientActif.commandes) clientActif.commandes = [];
        clientActif.commandes.push(commande);
        
        sauvegarderClients();
        afficherCommandesClient();
        afficherClients();
        mettreAJourStatistiques();
        
        form.reset();
    });
}

function afficherCommandesClient() {
    if (!clientActif) return;
    
    const tbody = document.querySelector('#table-commandes-client tbody');
    const commandes = clientActif.commandes || [];
    
    if (commandes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-message">Aucune commande</td></tr>';
        return;
    }
    
    tbody.innerHTML = commandes.map(cmd => {
        const statutClass = `statut-${cmd.statut.toLowerCase().replace(' ', '-')}`;
        return `
        <tr>
            <td>${new Date(cmd.dateCreation).toLocaleDateString('fr-FR')}</td>
            <td>${cmd.produit}</td>
            <td>${cmd.quantite}</td>
            <td>${cmd.dateLivraison ? new Date(cmd.dateLivraison).toLocaleDateString('fr-FR') : '-'}</td>
            <td><span class="statut-badge ${statutClass}">${cmd.statut}</span></td>
            <td>${cmd.notes || '-'}</td>
            <td>
                <button class="btn-delete" onclick="supprimerCommande(${cmd.id})">Supprimer</button>
            </td>
        </tr>
    `;
    }).join('');
}

function supprimerCommande(id) {
    if (!clientActif) return;
    clientActif.commandes = clientActif.commandes.filter(c => c.id !== id);
    sauvegarderClients();
    afficherCommandesClient();
    afficherClients();
    mettreAJourStatistiques();
}

// ========================================
// CONSIGNES
// ========================================

function initialiserConsignes() {
    const formDonner = document.getElementById('form-donner-consigne');
    const formRendre = document.getElementById('form-rendre-consigne');
    
    formDonner.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!clientActif) return;
        
        const consigne = {
            id: Date.now(),
            action: 'Donné',
            type: document.getElementById('consigne-donner-type').value,
            quantite: parseInt(document.getElementById('consigne-donner-nb').value),
            date: document.getElementById('consigne-donner-date').value,
            reduction: 0
        };
        
        if (!clientActif.consignes) clientActif.consignes = [];
        clientActif.consignes.push(consigne);
        
        sauvegarderClients();
        afficherConsignesClient();
        afficherClients();
        mettreAJourStatistiques();
        
        formDonner.reset();
        alert('Pots donnés en consigne !');
    });
    
    formRendre.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!clientActif) return;
        
        const quantite = parseInt(document.getElementById('consigne-rendre-nb').value);
        const reduction = quantite * REDUCTION_PAR_POT;
        
        const consigne = {
            id: Date.now(),
            action: 'Rendu',
            type: document.getElementById('consigne-rendre-type').value,
            quantite: quantite,
            date: document.getElementById('consigne-rendre-date').value,
            reduction: reduction
        };
        
        if (!clientActif.consignes) clientActif.consignes = [];
        clientActif.consignes.push(consigne);
        
        sauvegarderClients();
        afficherConsignesClient();
        afficherClients();
        mettreAJourStatistiques();
        
        // Afficher la réduction
        document.getElementById('reduction-montant').textContent = reduction.toFixed(2) + ' €';
        document.getElementById('reduction-info').style.display = 'block';
        
        formRendre.reset();
        
        setTimeout(() => {
            document.getElementById('reduction-info').style.display = 'none';
        }, 5000);
    });
}

function afficherConsignesClient() {
    if (!clientActif) return;
    
    const tbody = document.querySelector('#table-consignes-client tbody');
    const consignes = clientActif.consignes || [];
    
    if (consignes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Aucune consigne</td></tr>';
    } else {
        tbody.innerHTML = consignes.map(c => `
            <tr>
                <td>${new Date(c.date).toLocaleDateString('fr-FR')}</td>
                <td><strong>${c.action}</strong></td>
                <td>${c.type}</td>
                <td>${c.quantite}</td>
                <td style="color: ${c.reduction > 0 ? '#f44336' : '#666'}; font-weight: bold;">
                    ${c.reduction > 0 ? '-' + c.reduction.toFixed(2) + ' €' : '-'}
                </td>
            </tr>
        `).join('');
    }
    
    // Total actuel
    const stats = calculerStatsClient(clientActif);
    document.getElementById('total-consigne-client').textContent = stats.potsConsignes;
}

// ========================================
// HISTORIQUE
// ========================================

function afficherHistoriqueClient() {
    if (!clientActif) return;
    
    const tbody = document.querySelector('#table-historique-client tbody');
    const achats = clientActif.achats || [];
    
    if (achats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Aucun achat enregistré</td></tr>';
        document.getElementById('total-depense-client').textContent = '0.00 €';
        document.getElementById('total-reductions-client').textContent = '0.00 €';
        return;
    }
    
    const totalDepense = achats.reduce((sum, a) => sum + a.montantTotal, 0);
    const totalReductions = achats.reduce((sum, a) => sum + (a.reduction || 0), 0);
    
    tbody.innerHTML = achats.map(a => `
        <tr>
            <td>${new Date(a.date).toLocaleDateString('fr-FR')}</td>
            <td>${a.produit}</td>
            <td>${a.quantite}</td>
            <td>${a.prixUnitaire.toFixed(2)} €</td>
            <td style="color: #f44336; font-weight: bold;">
                ${a.reduction ? '-' + a.reduction.toFixed(2) + ' €' : '-'}
            </td>
            <td style="font-weight: bold; color: #28a745;">${a.montantTotal.toFixed(2)} €</td>
        </tr>
    `).join('');
    
    document.getElementById('total-depense-client').textContent = totalDepense.toFixed(2) + ' €';
    document.getElementById('total-reductions-client').textContent = totalReductions.toFixed(2) + ' €';
}

// ========================================
// HABITUDES
// ========================================

function afficherHabitudesClient() {
    if (!clientActif) return;
    
    const habitudes = analyserHabitudes(clientActif);
    
    // Produits préférés
    const divProduits = document.getElementById('produits-preferes');
    if (habitudes.produitsPreferes.length === 0) {
        divProduits.innerHTML = '<p class="empty-message">Aucun achat enregistré</p>';
    } else {
        divProduits.innerHTML = habitudes.produitsPreferes.map(p => `
            <div class="habitude-item">
                <span class="habitude-produit">${p.produit}</span>
                <span class="habitude-quantite">${p.quantite} unités</span>
            </div>
        `).join('');
    }
    
    // Fréquence
    if (habitudes.frequence) {
        document.getElementById('premier-achat').textContent = 
            new Date(habitudes.frequence.premierAchat).toLocaleDateString('fr-FR');
        document.getElementById('dernier-achat').textContent = 
            new Date(habitudes.frequence.dernierAchat).toLocaleDateString('fr-FR');
        document.getElementById('nb-achats').textContent = habitudes.frequence.nbAchats;
        document.getElementById('panier-moyen').textContent = 
            habitudes.frequence.panierMoyen.toFixed(2) + ' €';
    }
    
    // Recommandations
    const divReco = document.getElementById('recommandations');
    if (habitudes.recommandations.length === 0) {
        divReco.innerHTML = '<p class="empty-message">Les recommandations apparaîtront après quelques achats</p>';
    } else {
        divReco.innerHTML = habitudes.recommandations.map(r => `
            <div class="recommandation-item">💡 ${r}</div>
        `).join('');
    }
}

// ========================================
// INTÉGRATION AVEC VENTES
// ========================================

// Cette fonction sera appelée depuis app.js lors d'une vente
function enregistrerVenteClient(clientId, vente) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    if (!client.achats) client.achats = [];
    client.achats.push(vente);
    
    sauvegarderClients();
}

// ========================================
// INITIALISATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('👥 Module Clients - Démarrage...');
    
    chargerClients();
    
    initialiserFormulaireClient();
    initialiserRecherche();
    initialiserNavigationModal();
    initialiserCommandes();
    initialiserConsignes();
    
    afficherClients();
    mettreAJourStatistiques();
    
    // Fermer le modal en cliquant en dehors
    document.getElementById('modal-client').addEventListener('click', (e) => {
        if (e.target.id === 'modal-client') {
            fermerModalClient();
        }
    });
    
    console.log('✅ Module Clients initialisé');
});