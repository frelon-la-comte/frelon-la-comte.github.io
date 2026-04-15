(function() {
        // --- CONFIGURATION ---
        const datePublication = new Date("2026-04-15"); // Date du dernier ajout (AAAA-MM-JJ)
        const dureeValiditeJours = 5; // Nombre de jours d'affichage
        // ---------------------

        const maintenant = new Date();
        const badge = document.querySelector('.badge-nouveau');

        if (badge) {
            // Calcul de la différence en millisecondes
            const difference = maintenant - datePublication;
            // Conversion en jours
            const joursEcoules = difference / (1000 * 60 * 60 * 24);

            if (joursEcoules >= 0 && joursEcoules <= dureeValiditeJours) {
                badge.style.display = 'inline-block'; // On affiche si c'est récent
            } else {
                badge.style.display = 'none'; // On cache si c'est trop vieux
            }
        }
    })();