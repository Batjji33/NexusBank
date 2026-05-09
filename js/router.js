// js/router.js
import { getSession } from './state.js';
import renderAuth from './pages/auth.js';
import renderHome from './pages/home.js';
import renderParty from './pages/party.js';

export function navigate(path) {
    window.location.hash = path;
}

export function handleRoute() {
    // On utilise le hash (ex: #/party/123) au lieu du pathname
    let path = window.location.hash.replace('#', '') || '/';
    const session = getSession();
    const app = document.getElementById('app');
    
    app.innerHTML = ''; // Clear current content

    // Simple routing logic
    if (path.startsWith('/party/')) {
        if (!session) {
            navigate('/auth');
            return;
        }
        const partyId = path.split('/party/')[1];
        renderParty(app, partyId);
    } else if (path === '/home') {
        if (!session) {
            navigate('/auth');
            return;
        }
        renderHome(app);
    } else {
        // Default to auth, or redirect to home if logged in
        if (session) {
            navigate('/home');
            return;
        }
        renderAuth(app);
    }
}

// Handle browser back/forward and hash changes
window.addEventListener('popstate', handleRoute);
window.addEventListener('hashchange', handleRoute);
