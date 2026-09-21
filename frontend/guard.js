(function () {
    const role = localStorage.getItem('role');
    const userId = localStorage.getItem('userId');

    // Determinar la página actual
    const currentPath = window.location.pathname;

    // Si intenta entrar a la vista de admin/planner sin credenciales válidas
    if (currentPath.includes('dashboard-wedding.html')) {
        if (!userId || (role !== 'planner' && role !== 'admin')) {
            alert('⚠️ Acceso denegado: Debes iniciar sesión como Admin.');
            window.location.href = 'index.html'; // Redirige al login
        }
    }

    // Si intenta entrar a la vista de novia sin credenciales válidas
    if (currentPath.includes('dashboard-novia.html')) {
        if (!userId || role !== 'novia') {
            alert('⚠️ Acceso denegado: Debes iniciar sesión como Novia.');
            window.location.href = 'index.html';
        }
    }
})();