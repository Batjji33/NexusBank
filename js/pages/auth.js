// js/pages/auth.js
import { supabase } from '../supabase.js';
import { setSession } from '../state.js';
import { navigate } from '../router.js';
import { showToast, showLoader } from '../utils.js';

export default function renderAuth(container) {
    container.innerHTML = `
        <div class="auth-page">
            <div class="auth-card">
                <div class="auth-header">
                    <h1>NexusBank</h1>
                </div>
                
                <div class="tabs">
                    <div class="tab active" id="tab-login">Connexion</div>
                    <div class="tab" id="tab-register">Inscription</div>
                    <div class="tab-indicator" id="tab-indicator"></div>
                </div>

                <form id="auth-form">
                    <div class="form-group">
                        <input type="text" id="username" placeholder="Nom d'utilisateur" required>
                        <div class="error-msg" id="err-username">Nom d'utilisateur requis</div>
                    </div>
                    <div class="form-group">
                        <input type="password" id="password" placeholder="Mot de passe" required>
                        <div class="error-msg" id="err-password">Mot de passe requis</div>
                    </div>
                    <div class="form-group" id="group-confirm" style="display: none;">
                        <input type="password" id="confirm-password" placeholder="Confirmer le mot de passe">
                        <div class="error-msg" id="err-confirm">Les mots de passe ne correspondent pas</div>
                    </div>
                    
                    <button type="submit" id="btn-submit" style="width: 100%;">Se connecter</button>
                </form>
                <div id="success-anim" style="display:none;">
                    <div class="success-checkmark">✓</div>
                    <p style="text-align:center; color:var(--success);">Inscription réussie !</p>
                </div>
            </div>
        </div>
    `;

    let isLogin = true;

    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const indicator = document.getElementById('tab-indicator');
    const form = document.getElementById('auth-form');
    const groupConfirm = document.getElementById('group-confirm');
    const btnSubmit = document.getElementById('btn-submit');
    const successAnim = document.getElementById('success-anim');
    const confirmInput = document.getElementById('confirm-password');

    function switchTab(loginMode) {
        isLogin = loginMode;
        if (isLogin) {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            indicator.style.transform = 'translateX(0)';
            groupConfirm.style.display = 'none';
            confirmInput.removeAttribute('required');
            btnSubmit.innerText = 'Se connecter';
        } else {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            indicator.style.transform = 'translateX(100%)';
            groupConfirm.style.display = 'block';
            confirmInput.setAttribute('required', 'true');
            btnSubmit.innerText = "S'inscrire";
        }
    }

    tabLogin.addEventListener('click', () => switchTab(true));
    tabRegister.addEventListener('click', () => switchTab(false));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirm-password').value;

        // Reset errors
        document.querySelectorAll('.error-msg').forEach(el => el.classList.remove('show'));

        if (!isLogin && password !== confirm) {
            document.getElementById('err-confirm').classList.add('show');
            return;
        }

        const restoreBtn = showLoader(btnSubmit);

        try {
            // Détection de bcrypt (peut être sous window.bcrypt ou window.dcodeIO.bcrypt)
            const bcrypt = window.bcrypt || (window.dcodeIO && window.dcodeIO.bcrypt);
            
            if (!bcrypt) {
                showToast("Erreur de chargement de la sécurité (bcrypt)", "error");
                restoreBtn();
                return;
            }

            // Pour que le login fonctionne, on doit générer TOUJOURS le même hash pour un utilisateur.
            // On crée un sel fixe basé sur le nom d'utilisateur (unique par personne).
            const saltBase = (username + "nexusbank_salt").padEnd(22, '0').substring(0, 22);
            const salt = "$2a$10$" + saltBase;
            const passwordHash = bcrypt.hashSync(password, salt);

            if (isLogin) {
                const { data, error } = await supabase.rpc('login_user', {
                    p_username: username,
                    p_password_hash: passwordHash
                });

                if (error) throw error;
                if (!data.success) {
                    if (data.error === 'user_not_found') {
                        showToast('Utilisateur introuvable', 'error');
                    } else if (data.error === 'wrong_password') {
                        showToast('Mot de passe incorrect', 'error');
                    } else {
                        showToast('Erreur de connexion', 'error');
                    }
                    restoreBtn();
                    return;
                }

                // Success login
                setSession({ user_id: data.user_id, username: data.username });
                navigate('/home');

            } else {
                const { data, error } = await supabase.rpc('register_user', {
                    p_username: username,
                    p_password_hash: passwordHash
                });

                if (error) throw error;
                if (!data.success) {
                    if (data.error === 'username_taken') {
                        document.getElementById('err-username').innerText = 'Ce nom est déjà pris';
                        document.getElementById('err-username').classList.add('show');
                    } else {
                        showToast("Erreur lors de l'inscription", 'error');
                    }
                    restoreBtn();
                    return;
                }

                // Success register
                form.style.display = 'none';
                successAnim.style.display = 'block';
                
                setSession({ user_id: data.user_id, username: data.username });
                setTimeout(() => {
                    navigate('/home');
                }, 1500);
            }
        } catch (err) {
            console.error(err);
            showToast('Erreur réseau ou serveur', 'error');
            restoreBtn();
        }
    });
}
