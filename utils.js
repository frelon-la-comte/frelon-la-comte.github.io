(function() {
    const maintenant = new Date();

    // Chaque badge porte ses propres métadonnées via data-publication et data-validite
    // Exemple : <span class="badge-nouveau" data-publication="2026-04-15" data-validite="5">Nouveau</span>
    //
    // Fallback : si les attributs sont absents, on utilise les valeurs ci-dessous
    const DATE_DEFAUT    = "2026-04-15"; // Date du dernier ajout (AAAA-MM-JJ)
    const VALIDITE_DEFAUT = 5;           // Nombre de jours d'affichage par défaut

    document.querySelectorAll('.badge-nouveau').forEach(badge => {
        const dateStr  = badge.dataset.publication || DATE_DEFAUT;
        const validite = parseInt(badge.dataset.validite, 10) || VALIDITE_DEFAUT;

        const datePublication = new Date(dateStr);
        const joursEcoules = (maintenant - datePublication) / (1000 * 60 * 60 * 24);

        badge.style.display = (joursEcoules >= 0 && joursEcoules <= validite)
            ? 'inline-block'
            : 'none';
    });
})();