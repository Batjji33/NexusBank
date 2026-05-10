// js/pages/auth.js
import { supabase } from '../supabase.js';
import { setSession } from '../state.js';
import { navigate } from '../router.js';
import { showToast, showLoader } from '../utils.js';

export default function renderAuth(container) {
    let isLogin = true;

    function updateUI() {
        container.innerHTML = `
            <div class="animate-in" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div class="bg-card" style="width: 100%; max-width: 400px; padding: 40px;">
                    <div style="text-align: center; margin-bottom: 32px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
                        <div class="logo-icon" style="width: 64px; height: 64px; border-radius: 16px;">
                            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 40px; height: 40px;">
                                <path d="M25 25 V75 H35 L65 35 V75 H75 V25 H65 L35 65 V25 Z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h1 class="logo" style="font-size: 2.5rem; margin-bottom: 8px;">NexusBank</h1>
                            <p class="text-secondary">${isLogin ? 'Ravi de vous revoir !' : 'Créez votre compte bancaire'}</p>
                        </div>
                    </div>

                    <form id="auth-form" class="flex-col gap-4">
                        <div class="form-group">
                            <label class="text-secondary" style="font-size: 0.85rem; margin-bottom: 6px; display: block;">Nom d'utilisateur</label>
                            <input type="text" id="username" placeholder="Ex: JeanDupont" required autocomplete="username">
                        </div>

                        <div class="form-group">
                            <label class="text-secondary" style="font-size: 0.85rem; margin-bottom: 6px; display: block;">Mot de passe</label>
                            <input type="password" id="password" placeholder="••••••••" required autocomplete="current-password">
                        </div>

                        <button type="submit" id="btn-auth-submit" style="width: 100%; margin-top: 12px;">
                            ${isLogin ? 'Se connecter' : "S'inscrire"}
                        </button>
                    </form>

                    <div style="margin-top: 24px; text-align: center; font-size: 0.9rem;">
                        <span class="text-secondary">${isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}</span>
                        <button class="btn-outline" id="btn-toggle-auth" style="display: inline-flex; padding: 4px 8px; font-size: 0.9rem; border: none; background: transparent; color: var(--accent); font-weight: bold;">
                            ${isLogin ? "S'inscrire" : "Se connecter"}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-toggle-auth').addEventListener('click', () => {
            isLogin = !isLogin;
            updateUI();
        });

        document.getElementById('auth-form').addEventListener('submit', handleAuth);
    }

    async function handleAuth(e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const btnSubmit = document.getElementById('btn-auth-submit');

        if (!username || !password) return;
        const restoreBtn = showLoader(btnSubmit);

        try {
            const bcrypt = window.bcrypt || (window.dcodeIO && window.dcodeIO.bcrypt);
            if (!bcrypt) throw new Error("Security library not loaded");

            let saltBase = (username + "nexusbank").repeat(3).replace(/[^a-zA-Z0-9]/g, 'a').substring(0, 22);
            const salt = "$2a$10$" + saltBase;
            const passwordHash = bcrypt.hashSync(password, salt);

            if (isLogin) {
                const { data, error } = await supabase.rpc('login_user', {
                    p_username: username,
                    p_password_hash: passwordHash
                });
                if (error) throw error;
                if (!data.success) {
                    showToast(data.error === 'wrong_password' ? 'Mot de passe incorrect' : 'Utilisateur introuvable', 'error');
                    restoreBtn();
                    return;
                }
                setSession({ user_id: data.user_id, username: data.username });
                showToast(`Bon retour, ${data.username} !`);
            } else {
                const { data, error } = await supabase.rpc('register_user', {
                    p_username: username,
                    p_password_hash: passwordHash
                });
                if (error) throw error;
                if (!data.success) {
                    showToast("Ce nom d'utilisateur est déjà pris", 'error');
                    restoreBtn();
                    return;
                }
                setSession({ user_id: data.user_id, username: data.username });
                showToast("Bienvenue sur NexusBank !");
            }
            navigate('/home');
        } catch (err) {
            console.error(err);
            showToast('Erreur réseau ou serveur', 'error');
            restoreBtn();
        }
    }

    updateUI();
}
