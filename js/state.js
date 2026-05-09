// js/state.js
// On utilise localStorage pour permettre l'ouverture dans de nouveaux onglets
// tout en restant connecté.

export const getSession = () => {
    const session = localStorage.getItem('nexus_session');
    return session ? JSON.parse(session) : null;
};

export const setSession = (newSession) => {
    localStorage.setItem('nexus_session', JSON.stringify(newSession));
};

export const clearSession = () => {
    localStorage.removeItem('nexus_session');
};
