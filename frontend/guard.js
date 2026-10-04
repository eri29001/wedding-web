// frontend/guard.js - Control de Acceso y Roles (Sincronizado con auth.js y JWT)

(function validarSesionYRol() {
    // 1. Ocultamos el documento temporalmente para evitar que se vea contenido protegido durante la verificación
    document.documentElement.style.display = 'none';

    // 2. Leemos las credenciales y el token JWT desde localStorage
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('role'); // 'novia', 'planner' o 'admin'
    const token = localStorage.getItem('token');
    const pathActual = window.location.pathname.toLowerCase();

    // Páginas del sistema
    const esPaginaLogin = pathActual.includes('login.html') || pathActual.includes('index.html') || pathActual.endsWith('/');
    const esDashboardNovia = pathActual.includes('dashboard-novia.html');
    const esDashboardPlanner = pathActual.includes('dashboard-wedding.html');

    // -------------------------------------------------------------
    // REGLA 1: Sin Sesión o Sin Token -> Forzar Redirección a login.html
    // -------------------------------------------------------------
    if (!userId || !role || !token) {
        if (!esPaginaLogin) {
            console.warn("🔒 Acceso denegado: Token de sesión ausente o inválido.");
            localStorage.clear(); // Limpiar residuos de sesión
            window.location.href = 'login.html';
            return;
        } else {
            document.documentElement.style.display = '';
            return;
        }
    }

    // -------------------------------------------------------------
    // REGLA 2: Con Sesión Activa intentando entrar a Login / Index
    // -------------------------------------------------------------
    if (esPaginaLogin) {
        redirigirSegunRol(role);
        return;
    }

    // -------------------------------------------------------------
    // REGLA 3: Restricción de Roles (RBAC)
    // -------------------------------------------------------------
    // A. Novia intentando entrar al panel de Planner
    if (esDashboardPlanner && role === 'novia') {
        console.warn("⛔ Rol no autorizado para Dashboard Planner.");
        window.location.href = 'dashboard-novia.html';
        return;
    }

    // B. Planner intentando entrar al panel de Novia
    if (esDashboardNovia && (role === 'planner' || role === 'admin')) {
        console.warn("⛔ Rol no autorizado para Dashboard Novia.");
        window.location.href = 'dashboard-wedding.html';
        return;
    }

    // -------------------------------------------------------------
    // REGLA 4: Permiso Concedido
    // -------------------------------------------------------------
    document.documentElement.style.display = '';
})();

function redirigirSegunRol(role) {
    if (role === 'planner' || role === 'admin') {
        window.location.href = 'dashboard-wedding.html';
    } else if (role === 'novia') {
        window.location.href = 'dashboard-novia.html';
    } else {
        document.documentElement.style.display = '';
    }
}