window.formHandler = (event) => {
    event.preventDefault();
    
    const btn = document.getElementById('btn-submit');
    const status = document.getElementById('form-status');
    
    btn.disabled = true;
    btn.innerText = "Envoi en cours...";

    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);

    // Ton URL Google Apps Script
    const url = 'https://script.google.com/macros/s/AKfycbydLYfaOC2nkVheuFZv1AWRgUILUMwF2la8YMGfq0qPpFarV_GW1CAWEn74huVCqlPA/exec';

    fetch(url, {
        method: 'POST',
        mode: 'no-cors', // Indispensable pour Google Apps Script
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(() => {
        // Redirection vers la page de remerciement
        window.location.href = 'merci.html';
    })
    .catch((error) => {
        console.error('Erreur:', error);
        status.innerText = "Erreur de connexion. Vérifiez votre accès internet.";
        status.style.display = "block";
        status.style.color = "red";
        btn.disabled = false;
        btn.innerText = "Réessayer l'envoi";
    });
};