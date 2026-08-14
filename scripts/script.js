// 1. Initialisation des listes & filtres
let credits = [];
let monnaies = [];
let currentUser = null;
let realtimeChannel = null;
let filtreActif = 'tous'; // 'tous', 'encours', 'soldes'
let isGuestMode = false;  // Variable globale pour isGuest
let guestId = null;       // ID guest pour la synchronisation

// 2. Enregistrement du Service Worker (sw.js)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ Service Worker (sw.js) enregistré avec succès:', reg.scope))
            .catch(err => console.warn('⚠️ Échec d\'enregistrement du Service Worker:', err));
    });
}

// 3. Sélection des éléments du DOM
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

// Synthèse vocale reliée au Robot ou à l'API système
const parler = (texte) => {
    if (window.RobotAvatar && typeof window.RobotAvatar.parler === 'function') {
        window.RobotAvatar.parler(texte);
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
 * Transfère les opérations locales créées en Mode Invité vers Supabase
 */
async function syncGuestDataToSupabase(supabaseUserId) {
    if (!isGuestMode && !localStorage.getItem('guest_id')) return;
    if (!navigator.onLine) return;
    
    try {
        console.log(`🔄 Sync: Transfert des données invité vers Supabase (User ID: ${supabaseUserId})`);
        
        if (!window.DB) return;
        
        // Charger toutes les opérations enregistrées localement
        const guestOps = await DB.getAll();
        
        if (!guestOps || guestOps.length === 0) {
            console.log('✅ Aucune donnée invité à synchroniser.');
            return;
        }
        
        let syncedCount = 0;
        for (const op of guestOps) {
            const transferOp = {
                ...op,
                user_id: supabaseUserId,
                synced: true,
                syncedAt: new Date().toISOString()
            };
            
            try {
                if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.saveOperation === 'function') {
                    await SupabaseDB.saveOperation(transferOp, supabaseUserId);
                    syncedCount++;
                }
            } catch (e) {
                console.warn(`⚠️ Erreur transfert opération ${op.id}:`, e);
            }
        }
        
        if (syncedCount > 0) {
            console.log(`✅ Synchronisation réussie : ${syncedCount} opérations transférées.`);
            parler(`Bienvenue ! J'ai récupéré vos ${syncedCount} opérations du mode hors-ligne.`);
        }
        
    } catch (e) {
        console.error('❌ Erreur globale lors de la synchronisation invité → Supabase:', e);
    }
}

/**
 * Vérifier la session et recharger les données si nécessaire
 */
async function verifySessionAndReload() {
    if (isGuestMode || !navigator.onLine) return;
    
    try {
        if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.getSession === 'function') {
            const session = await SupabaseDB.getSession();
            if (!session) {
                console.warn('⚠️ Session expirée, redirection vers index.html...');
                window.location.href = './index.html';
            }
        }
    } catch (e) {
        console.warn('⚠️ Erreur lors de la vérification de la session:', e);
    }
}

// Gestionnaires des événements Online / Offline
window.addEventListener('online', async () => {
    console.log('✅ Connexion réseau rétablie');
    if (!isGuestMode) {
        await verifySessionAndReload();
        if (currentUser && currentUser.id) {
            await syncGuestDataToSupabase(currentUser.id);
        }
    }
});

window.addEventListener('offline', () => {
    console.log('⚠️ Connexion réseau perdue - Mode offline activé');
});

// ==========================================
// INITIALISATION DE LA PAGE & CHARGEMENT
// ==========================================
window.addEventListener('load', async () => {
    try {
        // Initialiser IndexedDB en premier pour garantir l'accès hors-ligne
        if (window.DB && typeof DB.init === 'function') {
            await DB.init();
        }

        // Vérifier si nous sommes en Mode Invité
        isGuestMode = typeof Auth !== 'undefined' && Auth.isGuestMode && Auth.isGuestMode();
        
        if (!isGuestMode) {
            // Mode Normal (Supabase)
            if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.init === 'function') {
                await SupabaseDB.init();
            }
            
            let session = null;
            if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.getSession === 'function') {
                session = await SupabaseDB.getSession();
            }

            if (!session) {
                // Tentative de récupération locale avant redirection
                if (window.DB) {
                    const localOps = await DB.getAll();
                    if (localOps && localOps.length > 0) {
                        console.warn('Session expirée mais données locales détectées.');
                    }
                }
                window.location.href = './index.html';
                return;
            }

            currentUser = session.user;

            // Détection de la fin du mode invité pour déclencher la synchronisation
            const previousGuestId = localStorage.getItem('guest_id');
            if (previousGuestId && currentUser && currentUser.id) {
                await syncGuestDataToSupabase(currentUser.id);
                // Nettoyage des flags invité
                localStorage.removeItem('is_guest_mode');
                localStorage.removeItem('guest_id');
                sessionStorage.removeItem('guest_session');
            }

        } else {
            // Mode Invité
            const guestSession = typeof Auth !== 'undefined' && Auth.getGuestSession && Auth.getGuestSession();
            if (!guestSession) {
                window.location.href = './index.html';
                return;
            }
            currentUser = guestSession.user;
            guestId = currentUser.id;
        }

        // Affichage des informations utilisateur dans la barre supérieure
        if (userEmailDisplay) {
            userEmailDisplay.textContent = isGuestMode 
                ? "Mode Invité (Hors-ligne)" 
                : (currentUser.email || "Utilisateur");
            if (authBar) authBar.hidden = false;
        }

        // Écouteur sur le bouton de déconnexion
        if (btnDeconnexion) {
            btnDeconnexion.addEventListener('click', async () => {
                if (realtimeChannel && typeof SupabaseDB !== 'undefined') {
                    SupabaseDB.unsubscribeChannel(realtimeChannel);
                    realtimeChannel = null;
                }
                
                if (isGuestMode) {
                    localStorage.removeItem('is_guest_mode');
                    localStorage.removeItem('guest_id');
                    sessionStorage.removeItem('guest_session');
                    window.location.href = './index.html';
                } else {
                    try {
                        if (typeof Auth !== 'undefined') await Auth.signOut();
                        else window.location.href = './index.html';
                    } catch (e) {
                        console.warn('Erreur lors de la déconnexion:', e);
                        window.location.href = './index.html';
                    }
                }
            });
        }

        // Charger les opérations depuis la source appropriée
        credits = [];
        monnaies = [];

        if (!isGuestMode && navigator.onLine) {
            try {
                const supaOps = await SupabaseDB.fetchOperations(currentUser.id);
                if (Array.isArray(supaOps) && supaOps.length > 0) {
                    supaOps.forEach(o => {
                        if (o.type === 'credit') credits.push(o);
                        else if (o.type === 'monnaie') monnaies.push(o);
                    });
                } else if (window.DB) {
                    // Charger IndexedDB si Supabase retourne une liste vide
                    const ops = await DB.getAll();
                    ops.forEach(o => {
                        if (o.type === 'credit') credits.push(o);
                        else if (o.type === 'monnaie') monnaies.push(o);
                    });
                }
            } catch (e) {
                console.warn('Erreur Supabase fetchOperations, bascule sur IndexedDB :', e);
                if (window.DB) {
                    const ops = await DB.getAll();
                    ops.forEach(o => {
                        if (o.type === 'credit') credits.push(o);
                        else if (o.type === 'monnaie') monnaies.push(o);
                    });
                }
            }
        } else {
            // Chargement hors-ligne direct
            if (window.DB) {
                const ops = await DB.getAll();
                ops.forEach(o => {
                    if (o.type === 'credit') credits.push(o);
                    else if (o.type === 'monnaie') monnaies.push(o);
                });
            }
        }

        trierOperations();

        // Abonnement Supabase Realtime (si connecté en ligne)
        if (!isGuestMode && navigator.onLine && typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.subscribeToOperations === 'function') {
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
                        console.warn('Erreur de rafraîchissement Realtime:', e);
                    }
                });
            } catch (e) {
                console.warn('Abonnement temps réel indisponible:', e);
            }
        }

    } catch (err) {
        console.warn('Erreur lors de l’initialisation de la page:', err);
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

    // 4. Extraction du nom du client
    const motsExclus = ['me', 'doit', 'je', 'lui', 'dois', 'donné', 'donne', 'rendre', 'monnaie', 'francs', 'franc', 'fcfa', 'de', 'à', 'pour', 'crédit', 'le', 'la', 'les', 'a', 'réglé', 'regle', 'payé', 'remboursé', 'j\'ai'];
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
        try { 
            reconnaissance.start(); 
        } catch(e) { 
            reconnaissance.stop(); 
        }
    });

    reconnaissance.onstart = () => {
        btnVocal.classList.add('recording');
        if (statusText) statusText.textContent = "Je vous écoute...";
        if (transcriptText) transcriptText.innerHTML = "<em>Parlez maintenant...</em>";
        if (aiResponse) {
            aiResponse.textContent = "";
            aiResponse.className = "ai-status";
        }
    };

    reconnaissance.onresult = async (event) => {
        const phrase = event.results[0][0].transcript;
        if (transcriptText) transcriptText.innerHTML = `<strong>Compris :</strong> "${phrase}"`;
        
        const res = analyserPhrase(phrase);

        if (res.erreur) {
            if (aiResponse) {
                aiResponse.textContent = `⚠️ ${res.erreur}`;
                aiResponse.classList.add('ai-error');
            }
            parler(res.erreur);
        } else if (res.estUnReglement) {
            await automatiserReglementVocal(res.client, res.montant, res.type);
        } else {
            await enregistrerOperationVocal(res.client, res.montant, res.type);
        }
    };

    reconnaissance.onerror = () => {
        if (transcriptText) transcriptText.innerHTML = "<em>Je n'ai pas bien entendu.</em>";
        if (aiResponse) {
            aiResponse.textContent = "Veuillez réessayer.";
            aiResponse.classList.add('ai-error');
        }
        parler("Je n'ai pas bien entendu. Réessayez.");
    };
    
    reconnaissance.onend = () => {
        btnVocal.classList.remove('recording');
        if (statusText) statusText.textContent = "Appuyez pour parler";
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
        
        if (window.DB) await DB.update(opExistante).catch(e => console.warn(e));
        if (!isGuestMode && currentUser && typeof SupabaseDB !== 'undefined' && navigator.onLine) {
            SupabaseDB.updateOperation(opExistante, currentUser.id).catch(e => console.warn(e));
        }

        const msg = `Parfait ! Le règlement de ${nom} a été pris en compte. L'opération est marquée comme SOLDE.`;
        if (aiResponse) aiResponse.textContent = `✅ ${msg}`;
        parler(msg);
        afficherListes();
    } else {
        // Enregistrer directement comme réglé si l'opération n'existait pas auparavant
        await enregistrerOperationVocal(nom, somme, type, true);
    }
}

// ==========================================
// ENREGISTREMENT EN BASE (INDEXEDDB / SUPABASE)
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
        
        if (!isGuestMode && currentUser && typeof SupabaseDB !== 'undefined' && navigator.onLine) {
            SupabaseDB.saveOperation(nouvelleOperation, currentUser.id).catch(err => console.warn(err));
        }

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

        if (aiResponse) aiResponse.textContent = `✅ ${msg}`;
        parler(msg);
        afficherListes();
    } catch (err) {
        console.warn('Erreur lors du traitement de l\'opération:', err);
        if (aiResponse) aiResponse.textContent = "⚠️ Erreur lors de l'enregistrement";
        parler("Erreur lors de l'enregistrement.");
    }
}

// ==========================================
// GESTION DU FILTRAGE & AFFICHAGE
// ==========================================
window.filtrerComptes = function(filtre) {
    filtreActif = filtre;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    
    if (filtre === 'tous' && document.getElementById('filter-all')) document.getElementById('filter-all').classList.add('active');
    if (filtre === 'encours' && document.getElementById('filter-pending')) document.getElementById('filter-pending').classList.add('active');
    if (filtre === 'soldes' && document.getElementById('filter-settled')) document.getElementById('filter-settled').classList.add('active');

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
    
    if (window.DB) await DB.update(operation).catch(e => console.warn(e));
    if (!isGuestMode && currentUser && typeof SupabaseDB !== 'undefined' && navigator.onLine) {
        SupabaseDB.updateOperation(operation, currentUser.id).catch(e => console.warn(e));
    }

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

    if (window.DB) await DB.remove(id).catch(e => console.warn(e));
    if (!isGuestMode && currentUser && typeof SupabaseDB !== 'undefined' && navigator.onLine) {
        SupabaseDB.deleteOperation(id, currentUser.id).catch(e => console.warn(e));
    }

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

    if (totalCredits) totalCredits.textContent = formatMontant(resteCredits);
    if (totalMonnaies) totalMonnaies.textContent = formatMontant(resteMonnaies);
    if (soldeNet) {
        soldeNet.textContent = formatMontant(solde);
        soldeNet.className = solde >= 0 ? 'positif' : 'negatif';
    }
}

const afficherListes = () => {
    trierOperations();
    if (affichageCredit) affichageCredit.innerHTML = "";
    if (affichageMonnaie) affichageMonnaie.innerHTML = "";

    const filtrer = (liste) => {
        if (filtreActif === 'encours') return liste.filter(o => !o.paye);
        if (filtreActif === 'soldes') return liste.filter(o => o.paye);
        return liste;
    };

    const creditsAffiches = filtrer(credits);
    const monnaiesAffichees = filtrer(monnaies);

    if (affichageCredit) {
        if (creditsAffiches.length === 0) {
            affichageCredit.append(creerMessageVide("Aucun crédit à afficher."));
        } else {
            creditsAffiches.forEach(el => affichageCredit.append(creerLigneOperation(el, 'credit')));
        }
    }

    if (affichageMonnaie) {
        if (monnaiesAffichees.length === 0) {
            affichageMonnaie.append(creerMessageVide("Aucune monnaie à afficher."));
        } else {
            monnaiesAffichees.forEach(el => affichageMonnaie.append(creerLigneOperation(el, 'monnaie')));
        }
    }

    mettreAJourResume();
};

// ==========================================
// ACTIONS GLOBALES (RÉSUMÉ VOCAL & NETTOYAGE)
// ==========================================
if (btnLireTout) {
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
}

if (btnEffacerRegles) {
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

        if (window.DB) await DB.removeMany(ids).catch(e => console.warn(e));
        if (!isGuestMode && currentUser && typeof SupabaseDB !== 'undefined' && navigator.onLine) {
            SupabaseDB.deleteOperations(ids, currentUser.id).catch(e => console.warn(e));
        }

        parler("Les opérations réglées ont été supprimées.");
        afficherListes();
    });
}