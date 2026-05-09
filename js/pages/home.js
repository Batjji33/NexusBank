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
            <div class="user-actions flex items-center gap-4">
                <span style="font-weight: 500;">${session.username}</span>
                <button class="btn-outline" id="btn-logout" style="padding: 8px 16px; font-size: 0.85rem;">Déconnexion</button>
            </div>
        </div>

        <div class="main-layout">
            <div class="sidebar">
                <div class="nav-item active animate-in" data-tab="parties" style="cursor:pointer; padding:12px 16px; border-radius:12px; transition: var(--transition);">
                    🏠 Mes parties
                </div>
                <div class="nav-item animate-in" data-tab="create" style="cursor:pointer; padding:12px 16px; border-radius:12px; transition: var(--transition); margin-top: 8px;">
                    ➕ Créer / Rejoindre
                </div>
            </div>

            <div class="mobile-nav">
                <div class="nav-item active" data-tab="parties"><span>🏠</span>Parties</div>
                <div class="nav-item" data-tab="create"><span>➕</span>Nouveau</div>
            </div>

            <div class="content-area animate-in">
                <!-- Section Parties -->
                <div id="section-parties">
                    <h2 style="margin-bottom: 24px; font-size: 1.8rem;">Mes parties</h2>
                    <div id="parties-list" class="grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                        <div class="spinner"></div>
                    </div>
                </div>

                <!-- Section Créer / Rejoindre -->
                <div id="section-create" style="display:none;">
                    <div class="flex-col gap-6" style="max-width: 800px; margin: 0 auto;">
                        <div class="bg-card animate-in">
                            <h2 style="margin-bottom: 24px;">Rejoindre une économie</h2>
                            <form id="form-join" class="flex-col gap-4">
                                <input type="text" id="join-code" placeholder="Code d'invitation (ex: A1B2C3)" required style="text-transform: uppercase; height: 56px; font-size: 1.1rem; letter-spacing: 2px;">
                                <button type="submit" id="btn-join" style="height: 56px;">Rejoindre la partie</button>
                            </form>
                        </div>

                        <div class="bg-card animate-in" style="animation-delay: 0.1s;">
                            <h2 style="margin-bottom: 24px;">Créer une nouvelle économie</h2>
                            <form id="form-create" class="flex-col gap-4">
                                <div class="flex-col gap-2">
                                    <label class="text-secondary" style="font-size:0.85rem; font-weight: 500;">Nom de la partie</label>
                                    <input type="text" id="create-nom" placeholder="Ex: Ma Partie Éco" required>
                                </div>
                                <div class="flex gap-4">
                                    <div class="flex-col gap-2" style="flex:1;">
                                        <label class="text-secondary" style="font-size:0.85rem; font-weight: 500;">Capital départ (€)</label>
                                        <input type="number" id="create-initial" value="1000" min="1" required>
                                    </div>
                                    <div class="flex-col gap-2" style="flex:1;">
                                        <label class="text-secondary" style="font-size:0.85rem; font-weight: 500;">Plafond (€)</label>
                                        <input type="number" id="create-max" value="5000" min="2" required>
                                    </div>
                                </div>
                                <button type="submit" id="btn-create" style="margin-top: 12px; height: 56px;">Créer l'économie</button>
                            </form>
                        </div>
                    </div>
                    
                    <div id="code-result" style="display:none; margin-top:32px;" class="animate-in">
                        <div class="bg-card" style="border: 2px dashed var(--accent); text-align: center;">
                            <h3 class="text-accent" style="margin-bottom: 12px;">Partie prête !</h3>
                            <div class="text-secondary" style="margin-bottom: 16px;">Partagez ce code avec vos amis</div>
                            <div style="font-size: 2.5rem; font-weight: 800; letter-spacing: 4px; margin-bottom: 20px;" id="display-code"></div>
                            <button id="btn-copy-code" class="btn-outline" style="margin: 0 auto;">Copier le code</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-logout').addEventListener('click', () => {
        clearSession();
        navigate('/auth');
    });

    const sections = {
        parties: document.getElementById('section-parties'),
        create: document.getElementById('section-create')
    };

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.getAttribute('data-tab');
            navItems.forEach(nav => nav.classList.toggle('active', nav.getAttribute('data-tab') === tab));
            Object.keys(sections).forEach(key => sections[key].style.display = key === tab ? 'block' : 'none');
            if (tab === 'parties') loadParties();
        });
    });

    async function loadParties() {
        const listDiv = document.getElementById('parties-list');
        try {
            const { data, error } = await supabase.rpc('get_my_parties', { p_user_id: session.user_id });
            if (error) throw error;

            if (!data || data.length === 0) {
                listDiv.innerHTML = `
                    <div class="bg-card" style="grid-column: 1/-1; text-align: center; padding: 60px;">
                        <div style="font-size: 3rem; margin-bottom: 16px;">🏝️</div>
                        <h3>Aucune partie</h3>
                        <p class="text-secondary" style="margin-top: 8px;">Rejoignez ou créez une partie pour commencer !</p>
                    </div>
                `;
                return;
            }

            listDiv.innerHTML = data.map(p => `
                <div class="bg-card party-card animate-in" data-id="${p.id}" style="cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; min-height:160px;">
                    <div>
                        <div class="flex justify-between items-start">
                            <h3 style="font-size: 1.3rem;">${p.nom}</h3>
                            <div class="badge" style="background: rgba(124, 77, 255, 0.2); color: var(--accent); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem;">
                                ${p.nb_joueurs} joueurs
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-between items-end" style="margin-top: 24px;">
                        <div class="text-secondary" style="font-size: 0.85rem;">Votre solde</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${formatCurrency(p.solde_actuel)}</div>
                    </div>
                </div>
            `).join('');

            document.querySelectorAll('.party-card').forEach(card => {
                card.addEventListener('click', () => window.open(`#/party/${card.getAttribute('data-id')}`, '_blank'));
            });
        } catch (err) {
            console.error(err);
            listDiv.innerHTML = '<p class="text-error">Erreur lors du chargement.</p>';
        }
    }

    loadParties();

    // Create / Join logic... (Identical to before but with UI polish)
    const formCreate = document.getElementById('form-create');
    formCreate.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nom = document.getElementById('create-nom').value;
        const initial = parseFloat(document.getElementById('create-initial').value);
        const max = parseFloat(document.getElementById('create-max').value);
        if (max <= initial) return showToast('Plafond invalide', 'error');

        const restore = showLoader(document.getElementById('btn-create'));
        const { data, error } = await supabase.rpc('create_party', {
            p_user_id: session.user_id, p_nom: nom, p_solde_initial: initial,
            p_salaire_journalier: 50, p_solde_max: max
        });
        if (error || !data.success) showToast("Erreur création", "error");
        else {
            showToast("Partie créée !");
            document.getElementById('code-result').style.display = 'block';
            document.getElementById('display-code').innerText = data.code_invitation;
            formCreate.reset();
            loadParties();
        }
        restore();
    });

    document.getElementById('form-join').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('join-code').value.trim().toUpperCase();
        const restore = showLoader(document.getElementById('btn-join'));
        const { data, error } = await supabase.rpc('join_party_by_code', { p_user_id: session.user_id, p_code: code });
        if (error || !data.success) showToast(data?.error || "Erreur", "error");
        else { showToast("Bienvenue !"); navItems[0].click(); }
        restore();
    });

    document.getElementById('btn-copy-code').addEventListener('click', (e) => {
        navigator.clipboard.writeText(document.getElementById('display-code').innerText);
        e.target.innerText = 'Copié !';
        setTimeout(() => e.target.innerText = 'Copier le code', 2000);
    });
}
