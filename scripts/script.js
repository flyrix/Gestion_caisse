// 1. Initialisation des listes (Tableaux d'objets)
let credits = [];
let monnaies = [];
let currentUser = null;
let realtimeChannel = null;

// 2. Sélection des éléments du DOM
const btnVocal = document.querySelector('#btn-vocal-main');
const statusText = document.querySelector('#mic-status');
const transcriptText = document.querySelector('#transcript-text');
const aiResponse = document.querySelector('#ai-response');

const btnLireTout = document.querySelector('#btn-lire-tout');
const btnEffacerRegles = document.querySelector('#btn-effacer-regles');
const btnDeconnexion = document.querySelector('#btn-deconnexion');

const affichageCredit = document.querySelector('#affichage-credits');
const affichageMonnaie = document.querySelector('#affichage-monnaies');
const totalCredits = document.querySelector('#total-credits');
const totalMonnaies = document.querySelector('#total-monnaies');
const soldeNet = document.querySelector('#solde-net');
const userEmailDisplay = document.querySelector('#user-email');
const authBar = document.querySelector('#auth-bar');

const formatMontant = (montant) => `${Number(montant).toLocaleString('fr-FR')} FCFA`;

// Initialisation DB et chargement des opérations persistées
window.addEventListener('load', async () => {
    try {
        await SupabaseDB.init();
        const session = await SupabaseDB.getSession();
        if (!session) {
            window.location.href = './index.html';
            return;
        }

        currentUser = session.user;
        if (userEmailDisplay) {
            userEmailDisplay.textContent = currentUser.email || 'Utilisateur';
            authBar.hidden = false;
        }

        if (btnDeconnexion) {
            btnDeconnexion.addEventListener('click', async () => {
                if (realtimeChannel) {
                    SupabaseDB.unsubscribeChannel(realtimeChannel);
                    realtimeChannel = null;
                }
                await Auth.signOut();
                window.location.href = './index.html';
            });
        }

        if (window.DB) {
            await DB.init();
        }

        const supaOps = await SupabaseDB.fetchOperations(currentUser.id);
        if (Array.isArray(supaOps) && supaOps.length > 0) {
            supaOps.forEach(o => {
                if (o.type === 'credit') credits.push(o);
                else if (o.type === 'monnaie') monnaies.push(o);
            });
        } else if (window.DB) {
            const ops = await DB.getAll();
            ops.forEach(o => {
                if (o.type === 'credit') credits.push(o);
                else if (o.type === 'monnaie') monnaies.push(o);
            });
        }

        trierOperations();
        
        // Flux Temps Réel (Websocket)
        try {
            realtimeChannel = await SupabaseDB.subscribeToOperations(currentUser.id, async (payload) => {
                try {
                    const fresh = await SupabaseDB.fetchOperations(currentUser.id);
                    credits = [];
                    monnaies = [];
                    fresh.forEach(o => {
                        if (o.type === 'credit') credits.push(o);
                        else if (o.type === 'monnaie') monnaies.push(o);
                    });
                    trierOperations();
                    afficherListes();
                } catch (e) {
                    console.warn('Realtime handler error', e);
                }
            });
        } catch (e) {
            console.warn('Could not subscribe realtime', e);
        }
    } catch (err) {
        console.warn('Init error', err);
        if (!currentUser) {
            window.location.href = './index.html';
            return;
        }
    } finally {
        afficherListes();
    }
});

// ==========================================
// FONCTION VOCALE : FAIRE PARLER L'APPLICATION
// ==========================================
const parler = (texte) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); 
    const message = new SpeechSynthesisUtterance(texte);
    message.lang = "fr-FR";
    message.rate = 0.90; // Un peu plus lent pour la clarté
    window.speechSynthesis.speak(message);
};

// ==========================================
// ANALYSEUR LOCAL (IA Basique - NLU)
// ==========================================
function analyserPhrase(phrase) {
    const p = phrase.toLowerCase();
    
    // 1. Chercher un montant (chiffres avec ou sans espaces)
    const matchMontant = p.match(/(\d+[\d\s]*)/);
    if (!matchMontant) {
        return { erreur: "Je n'ai pas compris le montant." };
    }
    const montant = parseInt(matchMontant[0].replace(/\s/g, ''), 10);

    // 2. Déterminer le type (Crédit vs Monnaie)
    let type = 'credit'; 
    if (p.includes('monnaie') || p.includes('je dois') || p.includes('rendre') || p.includes('rendu')) {
        type = 'monnaie';
    } else if (p.includes('doit') || p.includes('crédit') || p.includes('pris')) {
        type = 'credit';
    }

    // 3. Trouver le nom (On supprime les mots de liaison)
    const motsExclus = ['me', 'doit', 'je', 'lui', 'dois', 'donné', 'rendre', 'monnaie', 'francs', 'franc', 'fcfa', 'de', 'à', 'pour', 'crédit', 'le', 'la', 'les'];
    const mots = p.replace(/[0-9]/g, '').split(/\s+/).filter(m => m.length > 2 && !motsExclus.includes(m));
    
    // Le premier mot restant pertinent est considéré comme le nom
    let client = mots.length > 0 ? mots[0].charAt(0).toUpperCase() + mots[0].slice(1) : "Inconnu";

    return { client, montant, type };
}

// ==========================================
// CONFIGURATION DU MICRO (RECONNAISSANCE GLOBALE)
// ==========================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && btnVocal) {
    const reconnaissance = new SpeechRecognition();
    reconnaissance.lang = "fr-FR";
    reconnaissance.interimResults = false;

    btnVocal.addEventListener('click', () => {
        try {
            reconnaissance.start();
        } catch(e) {
            reconnaissance.stop();
        }
    });

    reconnaissance.onstart = () => {
        btnVocal.classList.add('recording');
        statusText.textContent = "Je vous écoute...";
        transcriptText.innerHTML = "<em>Parlez maintenant...</em>";
        aiResponse.textContent = "";
        aiResponse.className = "ai-status";
    };

    reconnaissance.onresult = async (event) => {
        const phrase = event.results[0][0].transcript;
        transcriptText.innerHTML = `<strong>Compris :</strong> "${phrase}"`;
        
        // Analyse de la phrase
        const resultat = analyserPhrase(phrase);

        if (resultat.erreur) {
            aiResponse.textContent = `⚠️ ${resultat.erreur}`;
            aiResponse.classList.add('ai-error');
            parler(resultat.erreur);
        } else {
            // Si l'analyse est bonne, on enregistre
            await enregistrerOperationVocal(resultat.client, resultat.montant, resultat.type);
        }
    };

    reconnaissance.onerror = () => {
        transcriptText.innerHTML = "<em>Je n'ai pas bien entendu.</em>";
        aiResponse.textContent = "Veuillez réessayer.";
        aiResponse.classList.add('ai-error');
        parler("Je n'ai pas bien entendu. Réessayez.");
    };
    
    reconnaissance.onend = () => {
        btnVocal.classList.remove('recording');
        statusText.textContent = "Appuyez et parlez";
    };
} else if (btnVocal) {
    btnVocal.style.display = "none";
    alert("Votre navigateur ne supporte pas la reconnaissance vocale.");
}

// ==========================================
// ENREGISTREMENT EN BASE (Remplaçant l'ancien btn-ajouter)
// ==========================================
async function enregistrerOperationVocal(nom, somme, type) {
    const maintenant = new Date().toISOString();
    const nouvelleOperation = {
        id: Date.now(), 
        client: nom, 
        montant: somme,
        paye: false,
        type: type,
        createdat: maintenant,
        createdAt: maintenant 
    };

    try {
        if (window.DB) {
            await DB.addOperation(nouvelleOperation);
        }
        if (currentUser) {
            SupabaseDB.saveOperation(nouvelleOperation, currentUser.id).catch(err => console.warn('Supabase save error', err));
        }

        let messageConfirmation = "";
        if (type === 'credit') { 
            credits.push(nouvelleOperation);
            messageConfirmation = `C'est noté. ${nom} vous doit ${somme} francs.`;
        } else {
            monnaies.push(nouvelleOperation);
            messageConfirmation = `C'est noté. Vous devez rendre ${somme} francs à ${nom}.`;
        }

        aiResponse.textContent = `✅ ${messageConfirmation}`;
        parler(messageConfirmation);
        
        afficherListes();
    } catch (err) {
        console.warn('Erreur ajout operation', err);
        aiResponse.textContent = "⚠️ Erreur lors de l'enregistrement";
        parler("Erreur lors de l'enregistrement de l'opération.");
    }
}

// ==========================================
// FONCTIONS DE MISE À JOUR ET SUPPRESSION
// ==========================================
function trouverOperation(id, type) {
    const liste = type === 'credit' ? credits : monnaies;
    return liste.find(element => element.id === id);
}

async function reglerOperation(id, type) {
    const operation = trouverOperation(id, type);
    if (!operation) return;

    operation.paye = !operation.paye;
    if (window.DB) {
        DB.update(operation).catch(e => console.warn(e));
    }
    if (currentUser) {
        SupabaseDB.updateOperation(operation, currentUser.id).catch(e => console.warn(e));
    }

    if (operation.paye) {
        parler(type === 'credit'
            ? `Le crédit de ${operation.client} est réglé.`
            : `La monnaie de ${operation.client} est rendue.`);
    } else {
        parler(`L'opération de ${operation.client} est remise en attente.`);
    }

    afficherListes();
}

async function supprimerOperation(id, type) {
    const operation = trouverOperation(id, type);
    if (!operation) return;

    const ok = confirm(`Supprimer l'opération de ${operation.client} ?`);
    if (!ok) return;

    if (type === 'credit') {
        credits = credits.filter(element => element.id !== id);
    } else {
        monnaies = monnaies.filter(element => element.id !== id);
    }

    if (window.DB) {
        DB.remove(id).catch(e => console.warn(e));
    }
    if (currentUser) {
        SupabaseDB.deleteOperation(id, currentUser.id).catch(e => console.warn(e));
    }

    parler(`Opération de ${operation.client} supprimée.`);
    afficherListes();
}

function trierOperations() {
    const tri = (a, b) => {
        if (a.paye !== b.paye) return a.paye ? 1 : -1;
        return (b.id || 0) - (a.id || 0);
    };
    credits.sort(tri);
    monnaies.sort(tri);
}

function creerMessageVide(texte) {
    const item = document.createElement('li');
    item.className = 'etat-vide';
    item.textContent = texte;
    return item;
}

function creerLigneOperation(element, type) {
    const item = document.createElement('li');
    item.className = element.paye ? 'operation reglee' : 'operation';

    const details = document.createElement('div');
    details.className = 'operation-details';

    const titre = document.createElement('span');
    titre.className = 'operation-client';
    titre.textContent = element.client;

    const montant = document.createElement('strong');
    montant.textContent = formatMontant(element.montant);

    const dateSource = element.createdat || element.createdAt;
    let texteDate = "";
    if (dateSource) {
        const d = new Date(dateSource);
        texteDate = " | Le " + d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
                    " à " + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    const statut = document.createElement('span');
    statut.className = 'operation-statut';
    
    const etatActuel = element.paye ? (type === 'credit' ? 'Réglé' : 'Rendu') : 'En attente';
    statut.textContent = `${etatActuel}${texteDate}`;

    details.append(titre, montant, statut);

    const actions = document.createElement('div');
    actions.className = 'operation-actions';

    const boutonRegler = document.createElement('button');
    boutonRegler.type = 'button';
    boutonRegler.className = element.paye ? 'btn-secondaire' : 'btn-regler';
    boutonRegler.textContent = element.paye ? 'Annuler' : 'Régler';
    boutonRegler.addEventListener('click', () => reglerOperation(element.id, type));

    const boutonSupprimer = document.createElement('button');
    boutonSupprimer.type = 'button';
    boutonSupprimer.className = 'btn-supprimer';
    boutonSupprimer.textContent = 'Supprimer';
    boutonSupprimer.addEventListener('click', () => supprimerOperation(element.id, type));

    actions.append(boutonRegler, boutonSupprimer);
    item.append(details, actions);
    return item;
}

function mettreAJourResume() {
    const resteCredits = credits.filter(c => !c.paye).reduce((total, c) => total + Number(c.montant), 0);
    const resteMonnaies = monnaies.filter(m => !m.paye).reduce((total, m) => total + Number(m.montant), 0);
    const solde = resteCredits - resteMonnaies;

    totalCredits.textContent = formatMontant(resteCredits);
    totalMonnaies.textContent = formatMontant(resteMonnaies);
    soldeNet.textContent = formatMontant(solde);
    soldeNet.className = solde >= 0 ? 'positif' : 'negatif';
}

const afficherListes = () => {
    trierOperations();
    affichageCredit.innerHTML = "";
    affichageMonnaie.innerHTML = "";

    if (credits.length === 0) {
        affichageCredit.append(creerMessageVide("Aucun crédit enregistré."));
    } else {
        credits.forEach(element => affichageCredit.append(creerLigneOperation(element, 'credit')));
    }

    if (monnaies.length === 0) {
        affichageMonnaie.append(creerMessageVide("Aucune monnaie enregistrée."));
    } else {
        monnaies.forEach(element => affichageMonnaie.append(creerLigneOperation(element, 'monnaie')));
    }

    mettreAJourResume();
};

// ==========================================
// LECTURE AUDIO COMPLÈTE DU CARNET
// ==========================================
btnLireTout.addEventListener('click', () => {
    let lecture = "";
    const restantsCredits = credits.filter(c => !c.paye);
    const restantsMonnaies = monnaies.filter(m => !m.paye);

    if (restantsCredits.length > 0) {
        lecture += "Voici les personnes qui vous doivent de l'argent. ";
        restantsCredits.forEach(c => {
            lecture += `${c.client} vous doit ${c.montant} Francs. `;
        });
    } else {
        lecture += "Personne ne vous doit d'argent. ";
    }

    if (restantsMonnaies.length > 0) {
        lecture += "Voici la monnaie que vous devez rendre. ";
        restantsMonnaies.forEach(m => {
            lecture += `Vous devez rendre ${m.montant} Francs à ${m.client}. `;
        });
    } else {
        lecture += "Vous ne devez de monnaie à personne.";
    }

    parler(lecture);
});

// Nettoyage en lot
btnEffacerRegles.addEventListener('click', async () => {
    const operationsReglees = [...credits, ...monnaies].filter(operation => operation.paye);
    if (operationsReglees.length === 0) {
        parler("Aucune opération réglée à effacer.");
        return;
    }

    const ok = confirm(`Effacer ${operationsReglees.length} opération(s) réglée(s) ?`);
    if (!ok) return;

    const ids = operationsReglees.map(operation => operation.id);
    credits = credits.filter(operation => !operation.paye);
    monnaies = monnaies.filter(operation => !operation.paye);

    if (window.DB) {
        DB.removeMany(ids).catch(e => console.warn(e));
    }
    if (currentUser) {
        SupabaseDB.deleteOperations(ids, currentUser.id).catch(e => console.warn(e));
    }

    parler("Les opérations réglées ont été effacées.");
    afficherListes();
});