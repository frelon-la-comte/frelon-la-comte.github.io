// Vérifier l'authentification au chargement de la page
if (!checkAuth()) {
    window.location.href = 'index.html';
}

// Afficher le nom de l'utilisateur connecté
const username = sessionStorage.getItem('username');
if (username) {
    document.getElementById('operator').value = username;
}

// Définir la date actuelle par défaut
const now = new Date();
const dateString = now.toISOString().slice(0, 16);
document.getElementById('date').value = dateString;

// Configuration Google Forms
// IMPORTANT: Remplacez ces valeurs par vos propres entry IDs de Google Forms
const GOOGLE_FORM_CONFIG = {
    formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfxXbKg4RaU20T0mw7nxoh36VRPYyqwYmoYwrK6r3HDSVQfKA/viewform?',
    
    // Entry IDs pour chaque champ - À REMPLACER
    // Pour trouver les entry IDs de votre Google Form:
    // 1. Créez votre Google Form
    // 2. Cliquez sur "Envoyer" puis sur l'icône de lien
    // 3. Copiez le lien
    // 4. Ouvrez le lien dans votre navigateur
    // 5. Faites clic droit > "Inspecter l'élément" sur chaque champ
    // 6. Cherchez "entry.XXXXXXXXX" dans le code HTML
    
    entries: {
        date: 'entry.730477153',           // Date de la visite
        operator: 'entry.299807282',       // Nom de l'opérateur
        temperature: 'entry.1481629560',    // Température
        weather: 'entry.365064024',        // Conditions météo
        intervention_types: 'entry.1464690425', // Types d'intervention
        population: 'entry.754428857',     // Population
        queen_seen: 'entry.1169233877',     // Reine vue
        behavior: 'entry.1468377828',       // Comportement
        honey_reserves: 'entry.1135154112', // Réserves de miel
        brood_pattern: 'entry.1568770202',  // Couvain
        actions_performed: 'entry.342474788', // Actions réalisées
        observations: 'entry.2030025628',   // Observations
        next_actions: 'entry.210665583'    // Actions à prévoir
    }
};

// Gestion du formulaire
document.getElementById('interventionForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData();
    
    // Récupérer tous les types d'intervention sélectionnés
    const selectedInterventions = Array.from(
        document.querySelectorAll('input[name="intervention_type"]:checked')
    ).map(cb => cb.value).join(', ');
    
    // Préparer les données pour Google Forms
    const data = {
        [GOOGLE_FORM_CONFIG.entries.date]: form.date.value,
        [GOOGLE_FORM_CONFIG.entries.operator]: form.operator.value,
        [GOOGLE_FORM_CONFIG.entries.temperature]: form.temperature.value,
        [GOOGLE_FORM_CONFIG.entries.weather]: form.weather.value,
        [GOOGLE_FORM_CONFIG.entries.intervention_types]: selectedInterventions,
        [GOOGLE_FORM_CONFIG.entries.population]: form.population.value,
        [GOOGLE_FORM_CONFIG.entries.queen_seen]: form.queen_seen.value,
        [GOOGLE_FORM_CONFIG.entries.behavior]: form.behavior.value,
        [GOOGLE_FORM_CONFIG.entries.honey_reserves]: form.honey_reserves.value,
        [GOOGLE_FORM_CONFIG.entries.brood_pattern]: form.brood_pattern.value,
        [GOOGLE_FORM_CONFIG.entries.actions_performed]: form.actions_performed.value,
        [GOOGLE_FORM_CONFIG.entries.observations]: form.observations.value,
        [GOOGLE_FORM_CONFIG.entries.next_actions]: form.next_actions.value
    };
    
    // Ajouter les données au FormData
    for (const [key, value] of Object.entries(data)) {
        if (value) {
            formData.append(key, value);
        }
    }
    
    try {
        // Envoyer les données à Google Forms
        await fetch(GOOGLE_FORM_CONFIG.formUrl, {
            method: 'POST',
            mode: 'no-cors', // Important pour éviter les erreurs CORS
            body: formData
        });
        
        // Afficher le message de succès
        showSuccess();
        
        // Réinitialiser le formulaire après 2 secondes
        setTimeout(() => {
            form.reset();
            // Remettre la date et l'opérateur
            document.getElementById('date').value = dateString;
            document.getElementById('operator').value = username;
            hideMessages();
        }, 2000);
        
    } catch (error) {
        console.error('Erreur:', error);
        showError();
    }
});

function showSuccess() {
    document.getElementById('successMessage').style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
}

function showError() {
    document.getElementById('successMessage').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'block';
}

function hideMessages() {
    document.getElementById('successMessage').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}

// Fonction utilitaire pour formater la date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
