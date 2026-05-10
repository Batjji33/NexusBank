// js/pages/party.js
import { supabase } from '../supabase.js';
import { getSession, clearSession } from '../state.js';
import { showToast, formatCurrency, showLoader } from '../utils.js';
import { navigate } from '../router.js';

export default function renderParty(container, partyId) {
    const session = getSession();
    let partyData = null;
    let pollInterval = null;

    container.innerHTML = `
        <div class="navbar animate-in">
            <div class="logo-container" id="nav-logo-home" title="Retour à l'accueil">
                <div class="logo-icon" style="width:32px; height:32px; border-radius:8px;">
                    <svg viewBox="0 0 100 100" fill="white" style="width:20px; height:20px;"><path d="M25 25 V75 H35 L65 35 V75 H75 V25 H65 L35 65 V25 Z"/></svg>
                </div>
                <div class="logo">Dashboard</div>
            </div>
            <div class="user-actions flex items-center gap-3">
                <div class="flex-col text-right mobile-hide-info">
                    <span id="party-name" style="font-weight: 600; font-size: 0.9rem;">...</span>
                    <span class="text-secondary" style="font-size: 0.7rem;">Code: <strong id="party-code" class="text-accent">...</strong></span>
                </div>
                <button class="btn-outline" id="btn-party-logout" style="padding: 6px 12px; font-size: 0.75rem;">Sortir</button>
            </div>
        </div>

        <div class="content-area animate-in" style="max-width: 1600px;">
            <!-- Bloc Solde avec bouton intégré (Desktop & Mobile) -->
            <div class="hero-balance" style="margin-bottom: 40px; display: flex; flex-direction: column; gap: 24px;">
                <div class="flex justify-between items-center wrap-mobile">
                    <div class="flex-col gap-1">
                        <div class="text-secondary" style="font-size: 0.9rem;">Solde disponible</div>
                        <div class="balance-amount" id="current-balance">0.00 €</div>
                        <div class="flex items-center gap-2">
                            <span id="max-balance-text" class="text-secondary" style="font-size: 0.8rem;">Plafond: --</span>
                            <span class="text-accent desktop-hide" id="party-code-mobile" style="font-size: 0.8rem; font-weight: bold; background: rgba(124, 77, 255, 0.1); padding: 2px 8px; border-radius: 4px;">...</span>
                        </div>
                    </div>
                    
                    <button id="btn-virement-main" style="padding: 16px 32px; font-size: 1.1rem; border-radius: 16px; width: auto;">
                        <span>💸</span> Nouveau Virement
                    </button>
                </div>
                
                <div class="progress-bar" style="height: 12px;"><div class="progress-fill" id="balance-progress"></div></div>
            </div>

            <!-- Grille des blocs -->
            <div class="dashboard-grid pro-layout">
                <div id="admin-panel" class="bg-card animate-in" style="display:none; border: 1px solid var(--accent); height: fit-content;">
                    <h2 style="font-size: 1.1rem; color: var(--accent); margin-bottom: 24px; display: flex; align-items: center; gap: 10px;">
                        🛡️ Administration
                    </h2>
                    <div class="flex-col gap-6">
                        <div class="flex justify-between items-center p-4" style="background: rgba(255,255,255,0.03); border-radius: 16px;">
                            <div id="status-salaire" style="font-size: 0.85rem; font-weight: 600;">...</div>
                            <button id="btn-toggle-salaire" class="btn-outline" style="height: 32px; padding: 0 16px; font-size: 0.75rem;">ON/OFF</button>
                        </div>
                        <div class="flex-col gap-4">
                            <div class="flex-col gap-2">
                                <label class="text-secondary" style="font-size: 0.75rem; font-weight: 600;">Salaire quotidien (€)</label>
                                <input type="number" id="input-salaire-amount" style="height: 44px;">
                            </div>
                            <div class="flex gap-4">
                                <div class="flex-col gap-2" style="flex: 1;"><label class="text-secondary" style="font-size: 0.75rem; font-weight: 600;">Taxe (%)</label><input type="number" id="input-taxe-percent" style="height: 44px;"></div>
                                <div style="flex: 1;"><label class="text-secondary" style="font-size: 0.75rem; font-weight: 600;">Frais (€)</label><input type="number" id="input-frais-fixe" style="height: 44px;"></div>
                            </div>
                        </div>
                        <button id="btn-save-settings" style="width: 100%; height: 50px;">Enregistrer les réglages</button>
                    </div>
                </div>

                <div class="bg-card" style="height: fit-content;">
                    <h2 style="margin-bottom: 24px; font-size: 1.1rem;">🏆 Classement</h2>
                    <div id="leaderboard-list" class="flex-col gap-1"><div class="spinner"></div></div>
                </div>

                <div class="bg-card" style="min-height: 400px;">
                    <h2 style="margin-bottom: 24px; font-size: 1.1rem;">🕒 Activité récente</h2>
                    <div id="history-list" class="flex-col gap-3"><div class="spinner"></div></div>
                </div>
            </div>
        </div>

        <!-- Modale de virement -->
        <div class="modal-overlay" id="transfer-modal">
            <div class="modal-content animate-in">
                <h2 style="text-align: center;">Nouveau Virement</h2>
                <form id="transfer-form" style="margin-top:24px;">
                    <div class="flex-col gap-4">
                        <div><label class="text-secondary" style="font-size: 0.8rem; margin-bottom: 6px; display: block;">Destinataire</label><select id="transfer-receiver" required><option value="">Choisir...</option></select></div>
                        <div><label class="text-secondary" style="font-size: 0.8rem; margin-bottom: 6px; display: block;">Montant (€)</label><input type="number" id="transfer-amount" min="1" step="0.01" placeholder="0.00" required></div>
                        <div class="recap-box" id="transfer-recap" style="display:none; background: rgba(255,255,255,0.03); padding: 20px; border-radius: 16px;">
                            <div class="flex justify-between" style="font-size: 0.9rem; margin-bottom: 8px;"><span class="text-secondary">Envoi</span> <span id="recap-base">0.00 €</span></div>
                            <div class="flex justify-between text-error" style="font-size: 0.85rem; margin-bottom: 4px;"><span id="recap-taxe-label">Taxe</span> <span id="recap-taxe">0.00 €</span></div>
                            <div class="flex justify-between text-error" style="font-size: 0.85rem; margin-bottom: 12px;"><span>Frais de service</span> <span id="recap-frais-label">0.00 €</span></div>
                            <div class="flex justify-between" style="font-weight: 700; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1);"><span>Total débit</span> <span id="recap-debit" class="text-error">0.00 €</span></div>
                        </div>
                    </div>
                    <div class="flex gap-3" style="margin-top: 32px;">
                        <button type="button" class="btn-outline" style="flex:1;" id="btn-cancel-transfer">Annuler</button>
                        <button type="submit" style="flex:2;" id="btn-confirm-transfer" disabled>Confirmer</button>
                    </div>
                </form>
                <div id="transfer-success" style="display:none; text-align:center; padding:30px 0;"><div style="font-size: 4rem; margin-bottom: 16px;">🚀</div><h3 class="text-success">Virement validé !</h3></div>
            </div>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        @media (min-width: 901px) {
            .desktop-hide { display: none !important; }
        }
        @media (max-width: 900px) {
            .mobile-hide-info { display: none !important; }
            .wrap-mobile { flex-direction: column; align-items: stretch !important; gap: 24px; }
            #btn-virement-main { width: 100%; height: 60px; font-weight: 700; }
            .dashboard-grid { gap: 32px !important; } /* Plus d'espace entre les blocs sur mobile */
            .content-area { padding-bottom: 120px !important; }
        }
        @media (min-width: 1100px) {
            .pro-layout { display: grid; grid-template-columns: ${partyData?.is_admin ? '320px 1fr 1fr' : '1fr 1.5fr'}; gap: 24px; align-items: start; }
        }
    `;
    document.head.appendChild(style);

    document.getElementById('nav-logo-home').onclick = () => navigate('/home');
    document.getElementById('btn-party-logout').onclick = () => { clearSession(); navigate('/auth'); };

    const elInputSalaire = document.getElementById('input-salaire-amount');
    const elInputTaxe = document.getElementById('input-taxe-percent');
    const elInputFrais = document.getElementById('input-frais-fixe');
    const selectReceiver = document.getElementById('transfer-receiver');

    async function loadDashboard() {
        try {
            const { data, error } = await supabase.rpc('get_party_dashboard', { p_user_id: session.user_id, p_party_id: partyId });
            if (error) return;
            partyData = data;

            if (data.is_admin) {
                style.textContent = style.textContent.replace('1fr 1.5fr', '320px 1fr 1fr');
            }

            document.getElementById('party-name').innerText = data.party.nom;
            document.getElementById('party-code').innerText = data.party.code_invitation;
            document.getElementById('party-code-mobile').innerText = `Code: ${data.party.code_invitation}`;
            
            document.getElementById('current-balance').innerText = formatCurrency(data.solde_actuel);
            document.getElementById('max-balance-text').innerText = `Plafond: ${formatCurrency(data.party.solde_max)}`;
            document.getElementById('balance-progress').style.width = `${Math.min(100, (data.solde_actuel / data.party.solde_max) * 100)}%`;

            if (data.is_admin) {
                document.getElementById('admin-panel').style.display = 'block';
                document.getElementById('status-salaire').innerHTML = data.party.salaire_actif ? '<span class="text-success">SALAIRE ACTIF</span>' : '<span class="text-error">SALAIRE EN PAUSE</span>';
                if (!elInputSalaire.dataset.touched) elInputSalaire.value = data.party.salaire_journalier;
                if (!elInputTaxe.dataset.touched) elInputTaxe.value = data.party.taxe_pourcentage;
                if (!elInputFrais.dataset.touched) elInputFrais.value = data.party.frais_fixe;
            }

            document.getElementById('leaderboard-list').innerHTML = data.classement.map((u, i) => `
                <div class="leaderboard-item ${u.user_id === session.user_id ? 'me' : ''}">
                    <div class="flex items-center gap-3"><span style="font-weight: 800; opacity: 0.5; width: 24px;">${i+1}</span><span>${u.username}</span></div>
                    <span style="font-weight: 700;">${formatCurrency(u.solde)}</span>
                </div>
            `).join('');

            if (selectReceiver.options.length <= 1) {
                data.classement.filter(u => u.user_id !== session.user_id).forEach(u => {
                    const opt = document.createElement('option'); opt.value = u.username; opt.text = u.username; selectReceiver.appendChild(opt);
                });
            }

            document.getElementById('history-list').innerHTML = data.historique.length === 0 ? 
                '<div class="text-secondary" style="text-align:center; padding: 40px 0;">Aucun mouvement récent</div>' :
                data.historique.map(t => {
                    const amIEmiter = t.emetteur_id === session.user_id;
                    const isSystem = t.emetteur_id === '00000000-0000-0000-0000-000000000000';
                    return `
                        <div class="history-item" style="padding: 12px;">
                            <div class="flex items-center gap-3">
                                <div class="history-icon" style="width: 36px; height: 36px; font-size: 1rem;">${isSystem ? '💰' : (amIEmiter ? '↗️' : '↙️')}</div>
                                <div><div style="font-weight: 500; font-size: 0.85rem;">${isSystem ? 'Salaire' : (amIEmiter ? t.receveur_username : t.emetteur_username)}</div><div class="text-secondary" style="font-size: 0.65rem;">${new Date(t.date).toLocaleTimeString()}</div></div>
                            </div>
                            <div class="${amIEmiter ? 'text-error' : 'text-success'}" style="font-weight: 700; font-size: 0.9rem;">${amIEmiter ? '-' : '+'}${formatCurrency(isSystem ? t.montant_recu : (amIEmiter ? t.cout_total_emetteur : t.montant_recu))}</div>
                        </div>
                    `;
                }).join('');
        } catch (err) { console.error(err); }
    }

    const modal = document.getElementById('transfer-modal');
    const openTransfer = () => {
        document.getElementById('transfer-form').style.display = 'block';
        document.getElementById('transfer-success').style.display = 'none';
        modal.classList.add('active');
    };

    document.getElementById('btn-virement-main').onclick = openTransfer;
    document.getElementById('btn-cancel-transfer').onclick = () => modal.classList.remove('active');

    document.getElementById('btn-toggle-salaire').onclick = async (e) => {
        const restore = showLoader(e.target);
        await supabase.rpc('toggle_salaire', { p_user_id: session.user_id, p_party_id: partyId });
        await loadDashboard(); restore();
    };

    document.getElementById('btn-save-settings').onclick = async (e) => {
        const sal = parseFloat(elInputSalaire.value), tax = parseFloat(elInputTaxe.value), frs = parseFloat(elInputFrais.value);
        const restore = showLoader(e.target);
        await supabase.rpc('update_party_settings', { p_user_id: session.user_id, p_party_id: partyId, p_salaire_journalier: sal, p_taxe_pourcentage: tax, p_frais_fixe: frs });
        elInputSalaire.dataset.touched = elInputTaxe.dataset.touched = elInputFrais.dataset.touched = "";
        showToast("Réglages enregistrés"); await loadDashboard(); restore();
    };

    [elInputSalaire, elInputTaxe, elInputFrais].forEach(el => el.oninput = () => el.dataset.touched = "true");

    document.getElementById('transfer-amount').oninput = (e) => {
        const val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) { document.getElementById('transfer-recap').style.display = 'none'; return; }
        const tPercent = partyData.party.taxe_pourcentage, fFixe = partyData.party.frais_fixe;
        const taxe = Math.round(val * (tPercent / 100) * 100) / 100;
        document.getElementById('recap-base').innerText = formatCurrency(val);
        document.getElementById('recap-taxe-label').innerText = `Taxe (${tPercent}%)`;
        document.getElementById('recap-taxe').innerText = `- ${formatCurrency(taxe)}`;
        document.getElementById('recap-frais-label').innerText = `- ${formatCurrency(fFixe)}`;
        document.getElementById('recap-debit').innerText = formatCurrency(val + fFixe);
        document.getElementById('transfer-recap').style.display = 'block';
        document.getElementById('btn-confirm-transfer').disabled = false;
    };

    document.getElementById('transfer-form').onsubmit = async (e) => {
        e.preventDefault();
        const restore = showLoader(document.getElementById('btn-confirm-transfer'));
        const { data, error } = await supabase.rpc('send_transaction', { p_emetteur_id: session.user_id, p_party_id: partyId, p_receveur_username: selectReceiver.value, p_montant: parseFloat(document.getElementById('transfer-amount').value) });
        if (error || !data.success) showToast(data?.error || "Erreur", "error");
        else {
            document.getElementById('transfer-form').style.display = 'none';
            document.getElementById('transfer-success').style.display = 'block';
            await loadDashboard(); setTimeout(() => modal.classList.remove('active'), 2000);
        }
        restore();
    };

    loadDashboard();
    pollInterval = setInterval(loadDashboard, 30000);
}
