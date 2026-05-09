// js/utils.js

export function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type} animate-in`;
    
    // Icon based on type
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
        <span style="margin-right: 10px;">${icon}</span>
        <span>${message}</span>
    `;

    // Inline style for toast (to ensure it's premium even if CSS is cached)
    Object.assign(toast.style, {
        background: 'rgba(15, 15, 26, 0.9)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--glass-border)',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '12px',
        marginBottom: '10px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.9rem',
        minWidth: '280px',
        borderLeft: `4px solid var(--${type === 'success' ? 'success' : (type === 'error' ? 'error' : 'accent')})`
    });

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

export function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

export function showLoader(btn) {
    const originalContent = btn.innerHTML;
    const originalWidth = btn.offsetWidth;
    
    btn.style.width = originalWidth + 'px'; // Prevent shrinking
    btn.innerHTML = '<div class="spinner" style="margin: 0 auto;"></div>';
    btn.disabled = true;
    
    return () => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        btn.style.width = '';
    };
}
