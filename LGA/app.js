// Vérifier l'authentification au chargement
if (!checkAuth()) {
    window.location.href = 'index.html';
}

// Initialisation des champs par défaut
const username = sessionStorage.getItem('username');
if (username) document.getElementById('operator').value = username;

const now = new Date();
document.getElementById('date').value = now.toISOString().slice(0, 16);

// URL de votre déploiement Google Apps Script (À REMPLACER)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzY3Dbu7t6NDTsyAKUhWVJnYZl0k3bv7Q2NeenLY_Tx-gWhDP8NNvyvfLhlpePrurW3/exec';

document.getElementById('interventionForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "Envoi en cours...";

    const form = e.target;
    
    // Récupération des types d'interventions (cases à cocher)
    const interventions = Array.from(document.querySelectorAll('input[name="intervention_type"]:checked'))
                               .map(cb => cb.value)
                               .join(', ');

    // Construction de l'objet JSON propre
    const payload = {
        date: form.date.value,
        operator: form.operator.value,
        temperature: form.temperature.value,
        weather: form.weather.value,
        intervention_types: interventions,
        population: form.population.value,
        queen_seen: form.queen_seen.value,
        behavior: form.behavior.value,
        honey_reserves: form.honey_reserves.value,
        brood_pattern: form.brood_pattern.value,
        actions_performed: form.actions_performed.value,
        observations: form.observations.value,
        next_actions: form.next_actions.value
    };

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Nécessaire pour Google Apps Script
            body: JSON.stringify(payload)
        });

        // Succès
        document.getElementById('successMessage').style.display = 'block';
        form.reset();
        setTimeout(() => {
            document.getElementById('successMessage').style.display = 'none';
            btn.disabled = false;
            btn.innerText = "📤 Envoyer la fiche";
        }, 3000);

    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('errorMessage').style.display = 'block';
        btn.disabled = false;
        btn.innerText = "Réessayer l'envoi";
    }
});