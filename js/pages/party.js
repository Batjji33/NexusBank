// js/pages/party.js
import { supabase } from '../supabase.js';
import { getSession } from '../state.js';
import { showToast, formatCurrency, showLoader } from '../utils.js';

export default function renderParty(container, partyId) {
    const session = getSession();
    let partyData = null;
    let pollInterval = null;

    container.innerHTML = `
        <div class="navbar" style="position: sticky; top: 0; z-index: 10;">
            <div class="logo">Dashboard</div>
            <div class="user-actions">
                <span id="party-name">Chargement...</span>
                <span class="text-secondary">|</span>
                <span>Code: <strong id="party-code">...</strong></span>
            </div>
        </div>

        <div class="content-area" style="max-width: 1200px;">
            <div class="dashboard-grid">
                <!-- Colonne Gauche -->
                <div class="flex-col gap-6">
                    <div class="hero-balance">
                        <div class="text-secondary" style="color: rgba(255,255,255,0.7);">Votre Solde</div>
                        <div class="balance-amount" id="current-balance">--</div>
                        <div class="progress-bar"><div class="progress-fill" id="balance-progress"></div></div>
                        <div class="flex justify-between text-secondary" style="font-size:0.85rem; color: rgba(255,255,255,0.7);">
                            <span>0</span><span id="max-balance">--</span>
                        </div>
                    </div>

                    <!-- Panneau Admin -->
                    <div id="admin-panel" class="bg-card" style="display:none; border: 1px solid var(--accent);">
                        <h2 style="font-size: 1.1rem; color: var(--accent); margin-bottom: 16px;">🛡️ Réglages Admin</h2>
                        <div class="flex-col gap-4">
                            <div class="flex justify-between items-center">
                                <div>
                                    <div style="font-weight: 600;">Salaire quotidien</div>
                                    <div id="status-salaire" class="text-secondary" style="font-size: 0.85rem;">...</div>
                                </div>
                                <button id="btn-toggle-salaire" class="btn-outline" style="height: 32px; font-size: 0.8rem;">Pause / Play</button>
                            </div>
                            
                            <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top:10px;">
                                <div class="flex-col gap-1">
                                    <label class="text-secondary" style="font-size: 0.75rem;">Salaire (€)</label>
                                    <input type="number" id="input-salaire-amount" style="height: 36px; font-size: 0.9rem;">
                                </div>
                                <div class="flex-col gap-1">
                                    <label class="text-secondary" style="font-size: 0.75rem;">Taxe (%)</label>
                                    <input type="number" id="input-taxe-percent" style="height: 36px; font-size: 0.9rem;">
                                </div>
                                <div class="flex-col gap-1">
                                    <label class="text-secondary" style="font-size: 0.75rem;">Frais (€)</label>
                                    <input type="number" id="input-frais-fixe" style="height: 36px; font-size: 0.9rem;">
                                </div>
                            </div>
                            <button id="btn-save-settings" style="margin-top:8px;">Enregistrer les réglages</button>
                        </div>
                    </div>

                    <div class="bg-card">
                        <h2 style="margin-bottom:16px;">Classement</h2>
                        <div class="leaderboard-list" id="leaderboard-list"><div class="spinner"></div></div>
                    </div>
                </div>

                <!-- Colonne Droite -->
                <div class="flex-col gap-6">
                    <div class="bg-card">
                        <h2 style="margin-bottom:16px;">Historique</h2>
                        <div id="history-list"><div class="spinner"></div></div>
                    </div>
                </div>
            </div>
        </div>

        <button class="fab" id="btn-new-transfer">💸</button>

        <div class="modal-overlay" id="transfer-modal">
            <div class="modal-content">
                <h2>Nouveau Virement</h2>
                <form id="transfer-form" style="margin-top:20px;">
                    <div class="form-group">
                        <label class="text-secondary">Destinataire</label>
                        <select id="transfer-receiver" required><option value="">Sélectionner...</option></select>
                    </div>
                    <div class="form-group" style="margin-top:16px;">
                        <label class="text-secondary">Montant (€)</label>
                        <input type="number" id="transfer-amount" min="1" step="0.01" required>
                    </div>
                    <div class="recap-box" id="transfer-recap" style="display:none; margin-top:20px;">
                        <div class="recap-line"><span>Envoi</span><span id="recap-base">0</span></div>
                        <div class="recap-line text-error"><span id="recap-taxe-label">Taxe</span><span id="recap-taxe">0</span></div>
                        <div class="recap-line text-error"><span>Frais fixes</span><span id="recap-frais-label">0</span></div>
                        <div class="recap-divider"></div>
                        <div class="recap-line text-success"><span>Reçu</span><span id="recap-receives">0</span></div>
                        <div class="recap-line text-error" style="font-weight:bold; border-top: 1px solid rgba(255,255,255,0.1); padding-top:8px; margin-top:8px;">
                            <span>Total débité</span><span id="recap-debit">0</span>
                        </div>
                    </div>
                    <div class="flex gap-4" style="margin-top:24px;">
                        <button type="button" class="btn-outline" style="flex:1;" id="btn-cancel-transfer">Annuler</button>
                        <button type="submit" style="flex:1;" id="btn-confirm-transfer" disabled>Confirmer</button>
                    </div>
                </form>
                <div id="transfer-success" style="display:none; text-align:center; padding:20px 0;"><div class="success-checkmark">✓</div><h3 class="text-success">Envoyé !</h3></div>
            </div>
        </div>
    `;

    const elInputSalaire = document.getElementById('input-salaire-amount');
    const elInputTaxe = document.getElementById('input-taxe-percent');
    const elInputFrais = document.getElementById('input-frais-fixe');
    const selectReceiver = document.getElementById('transfer-receiver');

    async function loadDashboard() {
        try {
            const { data, error } = await supabase.rpc('get_party_dashboard', { p_user_id: session.user_id, p_party_id: partyId });
            if (error) return console.error(error);
            partyData = data;

            document.getElementById('party-name').innerText = data.party.nom;
            document.getElementById('party-code').innerText = data.party.code_invitation;
            document.getElementById('current-balance').innerText = formatCurrency(data.solde_actuel);
            document.getElementById('max-balance').innerText = formatCurrency(data.party.solde_max);
            document.getElementById('balance-progress').style.width = `${Math.min(100, (data.solde_actuel / data.party.solde_max) * 100)}%`;

            if (data.is_admin) {
                document.getElementById('admin-panel').style.display = 'block';
                document.getElementById('status-salaire').innerHTML = data.party.salaire_actif ? '<span class="text-success">Actif</span>' : '<span class="text-error">En pause</span>';
                document.getElementById('status-salaire').innerHTML += ` (${formatCurrency(data.party.salaire_journalier)})`;
                if (!elInputSalaire.dataset.touched) elInputSalaire.value = data.party.salaire_journalier;
                if (!elInputTaxe.dataset.touched) elInputTaxe.value = data.party.taxe_pourcentage;
                if (!elInputFrais.dataset.touched) elInputFrais.value = data.party.frais_fixe;
            }

            document.getElementById('leaderboard-list').innerHTML = data.classement.map((u, i) => `
                <div class="leaderboard-item ${u.user_id === session.user_id ? 'me' : ''}">
                    <span>${i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '#' + (i + 1)))} ${u.username}</span>
                    <span style="font-weight:bold;">${formatCurrency(u.solde)}</span>
                </div>
            `).join('');

            if (selectReceiver.options.length <= 1) {
                data.classement.forEach(u => {
                    if (u.user_id !== session.user_id) {
                        const opt = document.createElement('option'); opt.value = u.username; opt.text = u.username; selectReceiver.appendChild(opt);
                    }
                });
            }

            document.getElementById('history-list').innerHTML = data.historique.length === 0 ? '<div class="text-secondary">Aucune transaction</div>' :
                data.historique.map(t => {
                    const amIEmiter = t.emetteur_id === session.user_id;
                    const isSystem = t.emetteur_id === '00000000-0000-0000-0000-000000000000';
                    const amount = isSystem ? t.montant_recu : (amIEmiter ? t.cout_total_emetteur : t.montant_recu);
                    return `
                        <div class="history-item">
                            <div class="flex items-center gap-3">
                                <div>${isSystem ? '💰' : (amIEmiter ? '↗️' : '↙️')}</div>
                                <div>
                                    <div style="font-size:0.9rem;">${isSystem ? 'Salaire' : (amIEmiter ? 'À ' + t.receveur_username : 'De ' + t.emetteur_username)}</div>
                                    <div class="text-secondary" style="font-size:0.7rem;">${new Date(t.date).toLocaleTimeString()}</div>
                                </div>
                            </div>
                            <div class="${amIEmiter ? 'text-error' : 'text-success'}" style="font-weight:bold;">${amIEmiter ? '-' : '+'}${formatCurrency(amount)}</div>
                        </div>
                    `;
                }).join('');
        } catch (err) { console.error(err); }
    }

    document.getElementById('btn-toggle-salaire').onclick = async (e) => {
        const restore = showLoader(e.target);
        await supabase.rpc('toggle_salaire', { p_user_id: session.user_id, p_party_id: partyId });
        await loadDashboard(); restore();
    };

    document.getElementById('btn-save-settings').onclick = async (e) => {
        const sal = parseFloat(elInputSalaire.value);
        const tax = parseFloat(elInputTaxe.value);
        const frs = parseFloat(elInputFrais.value);
        if (isNaN(sal) || isNaN(tax) || isNaN(frs)) return showToast("Valeurs invalides", "error");
        const restore = showLoader(e.target);
        await supabase.rpc('update_party_settings', { 
            p_user_id: session.user_id, p_party_id: partyId, 
            p_salaire_journalier: sal, p_taxe_pourcentage: tax, p_frais_fixe: frs 
        });
        elInputSalaire.dataset.touched = elInputTaxe.dataset.touched = elInputFrais.dataset.touched = "";
        showToast("Réglages mis à jour"); await loadDashboard(); restore();
    };

    [elInputSalaire, elInputTaxe, elInputFrais].forEach(el => el.oninput = () => el.dataset.touched = "true");

    const modal = document.getElementById('transfer-modal');
    document.getElementById('btn-new-transfer').onclick = () => {
        document.getElementById('transfer-form').style.display = 'block';
        document.getElementById('transfer-success').style.display = 'none';
        modal.classList.add('active');
    };
    document.getElementById('btn-cancel-transfer').onclick = () => modal.classList.remove('active');

    const inputAmount = document.getElementById('transfer-amount');
    inputAmount.oninput = () => {
        const val = parseFloat(inputAmount.value);
        if (isNaN(val) || val <= 0) { document.getElementById('transfer-recap').style.display = 'none'; return; }
        
        // Utilisation des réglages DYNAMIQUES de la partie
        const tPercent = partyData.party.taxe_pourcentage;
        const fFixe = partyData.party.frais_fixe;
        const taxe = Math.round(val * (tPercent / 100) * 100) / 100;
        
        document.getElementById('recap-base').innerText = val.toFixed(2);
        document.getElementById('recap-taxe-label').innerText = `Taxe (${tPercent}%)`;
        document.getElementById('recap-taxe').innerText = `- ${taxe.toFixed(2)}`;
        document.getElementById('recap-frais-label').innerText = `- ${fFixe.toFixed(2)}`;
        document.getElementById('recap-receives').innerText = (val - taxe).toFixed(2);
        document.getElementById('recap-debit').innerText = (val + fFixe).toFixed(2);
        document.getElementById('transfer-recap').style.display = 'block';
        document.getElementById('btn-confirm-transfer').disabled = false;
    };

    document.getElementById('transfer-form').onsubmit = async (e) => {
        e.preventDefault();
        const restore = showLoader(document.getElementById('btn-confirm-transfer'));
        const { data, error } = await supabase.rpc('send_transaction', {
            p_emetteur_id: session.user_id, p_party_id: partyId,
            p_receveur_username: selectReceiver.value, p_montant: parseFloat(inputAmount.value)
        });
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
