// js/pages/home.js
import { supabase } from '../supabase.js';
import { getSession, clearSession } from '../state.js';
import { navigate } from '../router.js';
import { showToast, formatCurrency, showLoader } from '../utils.js';

export default function renderHome(container) {
    const session = getSession();

    container.innerHTML = `
        <div class="navbar">
            <div class="logo">NexusBank</div>
            <div class="user-actions">
                <span>${session.username}</span>
                <button class="btn-logout" id="btn-logout">Déconnexion</button>
            </div>
        </div>

        <div class="main-layout">
            <div class="sidebar">
                <div class="nav-item active" data-tab="parties">
                    Mes parties
                </div>
                <div class="nav-item" data-tab="invitations" style="margin-top: 16px;">
                    Invitations
                    <div class="badge" id="invite-badge" style="display:none;">0</div>
                </div>
                <div class="nav-item" data-tab="create" style="margin-top: 16px;">
                    Créer / Rejoindre
                </div>
            </div>

            <div class="mobile-nav">
                <div class="nav-item active" data-tab="parties">
                    <span>🏠</span>
                    Parties
                </div>
                <div class="nav-item" data-tab="invitations">
                    <span>✉️</span>
                    Invitations
                    <div class="badge" id="invite-badge-mobile" style="display:none;">0</div>
                </div>
                <div class="nav-item" data-tab="create">
                    <span>➕</span>
                    Ajouter
                </div>
            </div>

            <div class="content-area">
                <!-- Section Parties -->
                <div id="section-parties">
                    <h2>Mes parties</h2>
                    <div id="parties-list"><div class="spinner"></div></div>
                </div>

                <!-- Section Invitations -->
                <div id="section-invitations" style="display:none;">
                    <h2>Invitations</h2>
                    <p class="text-secondary">Les invitations arriveront bientôt...</p>
                </div>

                <!-- Section Créer / Rejoindre -->
                <div id="section-create" style="display:none;">
                    <h2>Rejoindre une partie</h2>
                    <div class="bg-card" style="margin-bottom: 24px;">
                        <form id="form-join" class="flex gap-4">
                            <input type="text" id="join-code" placeholder="Code d'invitation" required>
                            <button type="submit" id="btn-join">Rejoindre</button>
                        </form>
                    </div>

                    <h2>Créer une partie</h2>
                    <div class="bg-card">
                        <form id="form-create" class="flex-col gap-4">
                            <div>
                                <label class="text-secondary" style="font-size:0.85rem; margin-bottom:4px; display:block;">Nom de la partie</label>
                                <input type="text" id="create-nom" placeholder="Ex: Économie Test" required>
                            </div>
                            <div class="flex gap-4">
                                <div style="flex:1;">
                                    <label class="text-secondary" style="font-size:0.85rem; margin-bottom:4px; display:block;">Solde initial</label>
                                    <input type="number" id="create-initial" value="1000" min="1" required>
                                </div>
                                <div style="flex:1;">
                                    <label class="text-secondary" style="font-size:0.85rem; margin-bottom:4px; display:block;">Solde maximum</label>
                                    <input type="number" id="create-max" value="5000" min="2" required>
                                </div>
                            </div>
                            <div>
                                <label class="text-secondary" style="font-size:0.85rem; margin-bottom:4px; display:block;">Salaire journalier</label>
                                <input type="number" id="create-salaire" value="50" min="0" required>
                            </div>
                            <button type="submit" id="btn-create" style="margin-top: 8px;">Créer la partie</button>
                        </form>
                    </div>
                    
                    <div id="code-result" style="display:none; margin-top:24px;">
                        <h3>Partie créée !</h3>
                        <div class="code-card">
                            <div class="text-secondary">Code d'invitation à partager</div>
                            <div class="code-display" id="display-code"></div>
                            <button id="btn-copy-code" class="btn-outline">Copier le code</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Logout logic
    document.getElementById('btn-logout').addEventListener('click', () => {
        clearSession();
        navigate('/auth');
    });

    // Tab navigation logic
    const sections = {
        parties: document.getElementById('section-parties'),
        invitations: document.getElementById('section-invitations'),
        create: document.getElementById('section-create')
    };

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.getAttribute('data-tab');
            
            // Update active states
            navItems.forEach(nav => {
                if(nav.getAttribute('data-tab') === tab) {
                    nav.classList.add('active');
                } else {
                    nav.classList.remove('active');
                }
            });

            // Show right section
            Object.keys(sections).forEach(key => {
                sections[key].style.display = key === tab ? 'block' : 'none';
            });

            if (tab === 'parties') loadParties();
        });
    });

    // Load parties
    async function loadParties() {
        const listDiv = document.getElementById('parties-list');
        listDiv.innerHTML = '<div class="spinner"></div>';

        try {
            const { data, error } = await supabase.rpc('get_my_parties', {
                p_user_id: session.user_id
            });

            if (error) throw error;

            if (!data || data.length === 0) {
                listDiv.innerHTML = '<p class="text-secondary">Vous n\'êtes dans aucune partie.</p>';
                return;
            }

            listDiv.innerHTML = data.map(p => {
                const isPositive = p.solde_actuel >= p.solde_initial;
                const colorClass = isPositive ? 'text-success' : 'text-error';
                return `
                    <div class="party-card" data-id="${p.id}">
                        <div class="flex justify-between items-center">
                            <div>
                                <h3 style="margin:0;">${p.nom}</h3>
                                <div class="text-secondary" style="font-size:0.85rem; margin-top:4px;">${p.nb_joueurs} joueur(s)</div>
                            </div>
                            <div class="${colorClass}" style="font-size:1.2rem; font-weight:bold;">
                                ${formatCurrency(p.solde_actuel)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click events to cards
            document.querySelectorAll('.party-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.getAttribute('data-id');
                    // Ouvre dans un nouvel onglet avec le hash
                    window.open(`#/party/${id}`, '_blank');
                });
            });

        } catch (err) {
            console.error(err);
            listDiv.innerHTML = '<p class="text-error">Erreur lors du chargement des parties.</p>';
        }
    }

    // Initialize list
    loadParties();

    // Create Party Logic
    const formCreate = document.getElementById('form-create');
    const btnCreate = document.getElementById('btn-create');
    formCreate.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nom = document.getElementById('create-nom').value;
        const initial = parseFloat(document.getElementById('create-initial').value);
        const max = parseFloat(document.getElementById('create-max').value);
        const salaire = parseFloat(document.getElementById('create-salaire').value);

        if (max <= initial) {
            showToast('Le solde max doit être supérieur au solde initial', 'error');
            return;
        }

        const restoreBtn = showLoader(btnCreate);

        try {
            const { data, error } = await supabase.rpc('create_party', {
                p_user_id: session.user_id,
                p_nom: nom,
                p_solde_initial: initial,
                p_salaire_journalier: salaire,
                p_solde_max: max,
                p_nb_joueurs_max: null
            });

            if (error) throw error;
            if (!data.success) {
                showToast("Erreur lors de la création", 'error');
                restoreBtn();
                return;
            }

            showToast("Partie créée avec succès", 'success');
            document.getElementById('code-result').style.display = 'block';
            document.getElementById('display-code').innerText = data.code_invitation;
            formCreate.reset();
            restoreBtn();

            loadParties();
        } catch (err) {
            console.error(err);
            showToast('Erreur serveur', 'error');
            restoreBtn();
        }
    });

    // Copy code logic
    document.getElementById('btn-copy-code').addEventListener('click', (e) => {
        const code = document.getElementById('display-code').innerText;
        navigator.clipboard.writeText(code);
        const btn = e.target;
        btn.innerText = 'Copié !';
        btn.classList.add('text-success');
        setTimeout(() => {
            btn.innerText = 'Copier le code';
            btn.classList.remove('text-success');
        }, 2000);
    });

    // Join Party Logic
    const formJoin = document.getElementById('form-join');
    const btnJoin = document.getElementById('btn-join');
    formJoin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('join-code').value.trim();
        if(!code) return;

        const restoreBtn = showLoader(btnJoin);

        try {
            const { data, error } = await supabase.rpc('join_party_by_code', {
                p_user_id: session.user_id,
                p_code: code
            });

            if (error) throw error;
            
            if (!data.success) {
                if (data.error === 'invalid_code') showToast('Code invalide', 'error');
                else if (data.error === 'already_member') showToast('Vous êtes déjà dans cette partie', 'warning');
                else if (data.error === 'party_full') showToast('La partie est pleine', 'error');
                else showToast("Erreur lors de l'ajout", 'error');
                restoreBtn();
                return;
            }

            showToast(`Bienvenue dans ${data.nom} !`, 'success');
            formJoin.reset();
            restoreBtn();
            
            // Switch to parties tab
            navItems[0].click();

        } catch(err) {
            console.error(err);
            showToast('Erreur serveur', 'error');
            restoreBtn();
        }
    });

}
