// 1. Initialisation des listes & filtres
let credits = [];
let monnaies = [];
let currentUser = null;
let realtimeChannel = null;
let filtreActif = 'tous'; // 'tous', 'encours', 'soldes'
let isGuestMode = false; // ✅ Variable globale pour isGuest
let guestId = null; // ✅ Garder l'ID guest pour sync

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

// Synthèse vocale reliée au Robot
const parler = (texte) => {
    if (window.RobotAvatar) {
        RobotAvatar.parler(texte);
    } else if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
        const message = new SpeechSynthesisUtterance(texte);
        message.lang = "fr-FR";
        message.rate = 0.90;
        window.speechSynthesis.speak(message);
    }
};

// ==========================================
// 🎯 SYNCHRONISATION MODE INVITÉ → SUPABASE
// ==========================================
/**
 * Migrer les données du Mode Invité vers un compte Supabase
 * À appeler une fois que l'utilisateur se connecte après être en mode invité
 */
async function syncGuestDataToSupabase(supabaseUserId) {
    if (!guestId || !isGuestMode) return;
    
    try {
        console.log(`🔄 Sync: Transfert des données invité vers Supabase (user: ${supabaseUserId})`);
        
        if (!window.DB) return;
        
        // Charger toutes les opérations du guest depuis IndexedDB
        const guestOps = await DB.getAll();
        
        if (guestOps.length === 0) {
            console.log('✅ Aucune données invité à synchroniser');
            return;
        }
        
        // Transfert vers Supabase avec nouvel user_id
        for (const op of guestOps) {
            const transferOp = {
                ...op,
                user_id: supabaseUserId,
                synced: true,
                syncedAt: new Date().toISOString()
            };
            
            try {
                await SupabaseDB.saveOperation(transferOp, supabaseUserId);
                console.log(`✅ Op transférée: ${op.client} - ${op.montant} FCFA`);
            } catch (e) {
                console.warn(`⚠️ Erreur transfert op ${op.id}:`, e);
            }
        }
        
        console.log(`✅ Sync complètée: ${guestOps.length} opérations transférées`);
        parler(`Bienvenue ! J'ai récupéré vos ${guestOps.length} opérations précédentes.`);
        
    } catch (e) {
        console.error('❌ Erreur sync guest → Supabase:', e);
    }
}

/**
 * Vérifier la reconnexion & recharger les données si session expirée
 */
async function verifySessionAndReload() {
    if (isGuestMode) return; // Pas de vérification pour guest
    
    try {
        const session = await SupabaseDB.getSession();
        if (!session) {
            console.warn('⚠️ Session expirée, tentative de reload...');
            // Données toujours en IndexedDB, rediriger vers login
            window.location.href = './index.html';
        }
    } catch (e) {
        console.warn('⚠️ Vérification session échouée:', e);
    }
}

// Gestionnaire online/offline
window.addEventListener('online', async () => {
    console.log('✅ Connexion rétablie');
    if (!isGuestMode) {
        await verifySessionAndReload();
    }
});

window.addEventListener('offline', () => {
    console.log('⚠️ Connexion perdue - Mode offline activé');
});

// Initialisation DB et chargement des données
window.addEventListener('load', async () => {
    try {
        // Vérifier si en mode guest/invité
        isGuestMode = Auth.isGuestMode && Auth.isGuestMode();
        
        if (!isGuestMode) {
            // Mode normal : vérifier la session Supabase
            await SupabaseDB.init();
            try {
                const session = await SupabaseDB.getSession();
                if (!session) {
                    // ✅ Essayer de récupérer depuis IndexedDB avant de rediriger
                    if (window.DB) {
                        const ops = await DB.getAll();
                        if (ops.length > 0) {
                            console.warn('Session Supabase expirée, redirection login...');
                        }
                    }
                    window.location.href = './index.html';
                    return;
                }
                currentUser = session.user;
                
                // ✅ SYNC MODE INVITÉ → SUPABASE (détecter si l'utilisateur vient de guest mode)
                if (window.DB && currentUser.id) {
                    const guestIdStored = localStorage.getItem('guest_id');
                    if (guestIdStored) {
                        // L'utilisateur avait des données invité, faire la sync
                        console.log('🔄 Utilisateur précédemment en mode invité, sync...');
                        await syncGuestDataToSupabase(currentUser.id);
                        // Nettoyer les traces guest après sync
                        localStorage.removeItem('is_guest_mode');
                        localStorage.removeItem('guest_id');
                        sessionStorage.removeItem('guest_session');
                    }
                }
            } catch (e) {
                console.warn('Erreur Supabase init:', e);
                // Essayer IndexedDB comme fallback
                if (window.DB) {
                    const ops = await DB.getAll();
                    if (ops.length === 0) {
                        window.location.href = './index.html';
                        return;
                    }
                }
                // Sinon continuer en mode offline
                currentUser = { id: 'offline_user', email: 'offline@local' };
            }
        } else {
            // Mode guest : utiliser la session stockée localement
            const guestSession = Auth.getGuestSession && Auth.getGuestSession();
            if (!guestSession) {
                window.location.href = './index.html';
                return;
            }
            currentUser = guestSession.user;
            guestId = guestSession.user.id;
        }

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
                // ✅ Nettoyer le mode guest s'il y a (utilise la variable globale)
                if (isGuestMode) {
                    localStorage.removeItem('is_guest_mode');
                    localStorage.removeItem('guest_id');
                    sessionStorage.removeItem('guest_session');
                } else {
                    try {
                        await Auth.signOut();
                    } catch (e) {
                        console.warn('Erreur Auth.signOut():', e);
                    }
                }
                window.location.href = './index.html';
            });
        }

        if (window.DB) {
            await DB.init();
        }

        // Charger les opérations (Supabase si online + connected, sinon IndexedDB)
        if (!isGuestMode) {
            try {
                const supaOps = await SupabaseDB.fetchOperations(currentUser.id);
                if (Array.isArray(supaOps) && supaOps.length > 0) {
                    supaOps.forEach(o => {
                        if (o.type === 'credit') credits.push(o);
                        else if (o.type === 'monnaie') monnaies.push(o);
                    });
                }
            } catch (e) {
                console.warn('Erreur Supabase fetchOperations :', e);
                // Fallback sur IndexedDB
                if (window.DB) {
                    const ops = await DB.getAll();
                    ops.forEach(o => {
                        if (o.type === 'credit') credits.push(o);
                        else if (o.type === 'monnaie') monnaies.push(o);
                    });
                }
            }
        } else {
            // Mode guest : charger d'IndexedDB uniquement
            if (window.DB) {
                const ops = await DB.getAll();
                ops.forEach(o => {
                    if (o.type === 'credit') credits.push(o);
                    else if (o.type === 'monnaie') monnaies.push(o);
                });
            }
        }

        trierOperations();
        
        // Temps réel Supabase (si pas en mode guest)
        if (!isGuestMode) {
            try {
                realtimeChannel = await SupabaseDB.subscribeToOperations(currentUser.id, async () => {
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
                        console.warn('Erreur Realtime', e);
                    }
                });
            } catch (e) {
                console.warn('Abonnement Realtime impossible', e);
            }
        }
    } catch (err) {
        console.warn('Erreur Init', err);
        if (!currentUser) {
            window.location.href = './index.html';
            return;
        }
    } finally {
        afficherListes();
    }
});

// ==========================================
// ANALYSEUR VOCAL NLU (AVEC DÉTECTION DU RÈGLEMENT)
// ==========================================
function analyserPhrase(phrase) {
    const p = phrase.toLowerCase();
    
    // 1. Recherche du montant
    const matchMontant = p.match(/(\d+[\d\s]*)/);
    if (!matchMontant) {
        return { erreur: "Je n'ai pas compris le montant." };
    }
    const montant = parseInt(matchMontant[0].replace(/\s/g, ''), 10);

    // 2. Détection d'une action de RÈGLEMENT / REMBOURSEMENT
    const estUnReglement = p.includes('réglé') || p.includes('regle') || p.includes('payé') || p.includes('paye') || p.includes('remboursé');

    // 3. Détermination du type (Crédit vs Monnaie)
    let type = 'credit'; 
    if (p.includes('monnaie') || p.includes('je dois') || p.includes('rendre') || p.includes('rendu')) {
        type = 'monnaie';
    }

    // 4. Extraction du nom
    const motsExclus = ['me', 'doit', 'je', 'lui', 'dois', 'donné', 'donne', 'rendre', 'monnaie', 'francs', 'franc', 'fcfa', 'de', 'à', 'pour', 'crédit', 'le', 'la', 'les', 'a', 'réglé', 'regle', 'payé', 'remboursé'];
    const mots = p.replace(/[0-9]/g, '').split(/\s+/).filter(m => m.length > 2 && !motsExclus.includes(m));
    let client = mots.length > 0 ? mots[0].charAt(0).toUpperCase() + mots[0].slice(1) : "Inconnu";

    return { client, montant, type, estUnReglement };
}

// ==========================================
// RECONNAISSANCE VOCALE
// ==========================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && btnVocal) {
    const reconnaissance = new SpeechRecognition();
    reconnaissance.lang = "fr-FR";
    reconnaissance.interimResults = false;

    btnVocal.addEventListener('click', () => {
        try { reconnaissance.start(); } catch(e) { reconnaissance.stop(); }
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
        
        const res = analyserPhrase(phrase);

        if (res.erreur) {
            aiResponse.textContent = `⚠️ ${res.erreur}`;
            aiResponse.classList.add('ai-error');
            parler(res.erreur);
        } else if (res.estUnReglement) {
            await automatiserReglementVocal(res.client, res.montant, res.type);
        } else {
            await enregistrerOperationVocal(res.client, res.montant, res.type);
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
        statusText.textContent = "Appuyez pour répondre";
    };
} else if (btnVocal) {
    btnVocal.style.display = "none";
}

// ==========================================
// AUTOMATISATION DES RÈGLEMENTS
// ==========================================
async function automatiserReglementVocal(nom, somme, type) {
    const liste = type === 'credit' ? credits : monnaies;
    const opExistante = liste.find(o => o.client.toLowerCase() === nom.toLowerCase() && !o.paye);

    if (opExistante) {
        opExistante.paye = true;
        if (window.DB) DB.update(opExistante).catch(e => console.warn(e));
        if (currentUser) SupabaseDB.updateOperation(opExistante, currentUser.id).catch(e => console.warn(e));

        const msg = `Parfait ! Le règlement de ${nom} a été pris en compte. L'opération est marquée comme SOLDE.`;
        aiResponse.textContent = `✅ ${msg}`;
        parler(msg);
        afficherListes();
    } else {
        // Enregistre directement comme réglé si l'opération n'existait pas
        await enregistrerOperationVocal(nom, somme, type, true);
    }
}

// ==========================================
// ENREGISTREMENT EN BASE
// ==========================================
async function enregistrerOperationVocal(nom, somme, type, estPaye = false) {
    const maintenant = new Date().toISOString();
    const nouvelleOperation = {
        id: Date.now(), 
        client: nom, 
        montant: somme,
        paye: estPaye,
        type: type,
        createdat: maintenant,
        createdAt: maintenant 
    };

    try {
        if (window.DB) await DB.addOperation(nouvelleOperation);
        if (currentUser) SupabaseDB.saveOperation(nouvelleOperation, currentUser.id).catch(err => console.warn(err));

        let msg = "";
        if (estPaye) {
            msg = `Règlement de ${somme} francs pour ${nom} enregistré et soldé.`;
        } else if (type === 'credit') { 
            msg = `C'est noté. ${nom} vous doit ${somme} francs.`;
        } else {
            msg = `C'est noté. Vous devez rendre ${somme} francs à ${nom}.`;
        }

        if (type === 'credit') credits.push(nouvelleOperation);
        else monnaies.push(nouvelleOperation);

        aiResponse.textContent = `✅ ${msg}`;
        parler(msg);
        afficherListes();
    } catch (err) {
        console.warn('Erreur ajout', err);
        aiResponse.textContent = "⚠️ Erreur lors de l'enregistrement";
        parler("Erreur lors de l'enregistrement.");
    }
}

// ==========================================
// GESTION DU FILTRAGE & AFFICHAGE
// ==========================================
window.filtrerComptes = function(filtre) {
    filtreActif = filtre;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    
    if (filtre === 'tous') document.getElementById('filter-all').classList.add('active');
    if (filtre === 'encours') document.getElementById('filter-pending').classList.add('active');
    if (filtre === 'soldes') document.getElementById('filter-settled').classList.add('active');

    afficherListes();
};

function trouverOperation(id, type) {
    const liste = type === 'credit' ? credits : monnaies;
    return liste.find(element => element.id === id);
}

async function reglerOperation(id, type) {
    const operation = trouverOperation(id, type);
    if (!operation) return;

    operation.paye = !operation.paye;
    if (window.DB) DB.update(operation).catch(e => console.warn(e));
    if (currentUser) SupabaseDB.updateOperation(operation, currentUser.id).catch(e => console.warn(e));

    if (operation.paye) {
        parler(`Le compte de ${operation.client} est maintenant soldé.`);
    } else {
        parler(`L'opération de ${operation.client} est remise en attente.`);
    }

    afficherListes();
}

async function supprimerOperation(id, type) {
    const operation = trouverOperation(id, type);
    if (!operation) return;

    if (!confirm(`Supprimer l'opération de ${operation.client} ?`)) return;

    if (type === 'credit') credits = credits.filter(e => e.id !== id);
    else monnaies = monnaies.filter(e => e.id !== id);

    if (window.DB) DB.remove(id).catch(e => console.warn(e));
    if (currentUser) SupabaseDB.deleteOperation(id, currentUser.id).catch(e => console.warn(e));

    parler(`Opération de ${operation.client} supprimée.`);
    afficherListes();
}

function trierOperations() {
    const tri = (a, b) => (b.id || 0) - (a.id || 0);
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
        texteDate = " | Le " + d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    const statut = document.createElement('span');
    statut.className = 'operation-statut';
    statut.textContent = `${element.paye ? '✅ Soldé' : '⏳ En attente'}${texteDate}`;

    details.append(titre, montant, statut);

    const actions = document.createElement('div');
    actions.className = 'operation-actions';

    const boutonRegler = document.createElement('button');
    boutonRegler.type = 'button';
    boutonRegler.className = element.paye ? 'btn-secondaire' : 'btn-regler';
    boutonRegler.textContent = element.paye ? 'Réouvrir' : 'Régler';
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
    const resteCredits = credits.filter(c => !c.paye).reduce((t, c) => t + Number(c.montant), 0);
    const resteMonnaies = monnaies.filter(m => !m.paye).reduce((t, m) => t + Number(m.montant), 0);
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

    const filtrer = (liste) => {
        if (filtreActif === 'encours') return liste.filter(o => !o.paye);
        if (filtreActif === 'soldes') return liste.filter(o => o.paye);
        return liste;
    };

    const creditsAffiches = filtrer(credits);
    const monnaiesAffichees = filtrer(monnaies);

    if (creditsAffiches.length === 0) {
        affichageCredit.append(creerMessageVide("Aucun crédit à afficher."));
    } else {
        creditsAffiches.forEach(el => affichageCredit.append(creerLigneOperation(el, 'credit')));
    }

    if (monnaiesAffichees.length === 0) {
        affichageMonnaie.append(creerMessageVide("Aucune monnaie à afficher."));
    } else {
        monnaiesAffichees.forEach(el => affichageMonnaie.append(creerLigneOperation(el, 'monnaie')));
    }

    mettreAJourResume();
};

// ==========================================
// ACTIONS GLOBALES
// ==========================================
btnLireTout.addEventListener('click', () => {
    let lecture = "";
    const restantsCredits = credits.filter(c => !c.paye);
    const restantsMonnaies = monnaies.filter(m => !m.paye);

    if (restantsCredits.length > 0) {
        lecture += "Voici les crédits en attente. ";
        restantsCredits.forEach(c => lecture += `${c.client} vous doit ${c.montant} Francs. `);
    } else {
        lecture += "Aucun crédit en attente. ";
    }

    if (restantsMonnaies.length > 0) {
        lecture += "Et la monnaie à rendre. ";
        restantsMonnaies.forEach(m => lecture += `Vous devez rendre ${m.montant} Francs à ${m.client}. `);
    } else {
        lecture += "Aucune monnaie à rendre.";
    }

    parler(lecture);
});

btnEffacerRegles.addEventListener('click', async () => {
    const operationsReglees = [...credits, ...monnaies].filter(o => o.paye);
    if (operationsReglees.length === 0) {
        parler("Aucune opération réglée à effacer.");
        return;
    }

    if (!confirm(`Effacer définitivement ${operationsReglees.length} opération(s) soldée(s) ?`)) return;

    const ids = operationsReglees.map(o => o.id);
    credits = credits.filter(o => !o.paye);
    monnaies = monnaies.filter(o => !o.paye);

    if (window.DB) DB.removeMany(ids).catch(e => console.warn(e));
    if (currentUser) SupabaseDB.deleteOperations(ids, currentUser.id).catch(e => console.warn(e));

    parler("Les opérations réglées ont été supprimées.");
    afficherListes();
});