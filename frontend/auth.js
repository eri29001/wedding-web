document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://wedding-web-lygz.onrender.com/api';

    // --- ELEMENTOS DEL DOM ---
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    
    // Elementos de Error
    const errorBox = document.getElementById('mensajeError');
    const errorText = document.getElementById('textoError');

    // Elementos del Modal de Recuperación
    const modal = document.getElementById('recoveryModal');
    const linkRecovery = document.getElementById('forgotLink');
    const btnCancel = document.getElementById('btnCancel');
    const btnSend = document.getElementById('btnSend');
    const recoveryInput = document.getElementById('recoveryEmail');

    // Botón de Cerrar Sesión (si existe en los dashboards)
    const btnLogout = document.getElementById('btnLogout');

    // ======================================================
    // 1. CERRAR SESIÓN (LOGOUT)
    // ======================================================
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    }

    // ======================================================
    // 2. LÓGICA DEL "OJO" (VER / OCULTAR CONTRASEÑA)
    // ======================================================
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.classList.toggle('fa-eye');
            togglePassword.classList.toggle('fa-eye-slash');
        });
    }

    // ======================================================
    // 3. LÓGICA DEL MODAL (RECUPERAR CONTRASEÑA REAL)
    // ======================================================
    if (linkRecovery) {
        linkRecovery.addEventListener('click', (e) => {
            e.preventDefault();
            if (modal) {
                modal.style.display = 'flex';
                if (emailInput && emailInput.value) {
                    recoveryInput.value = emailInput.value;
                }
            }
        });
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    if (btnSend) {
        btnSend.addEventListener('click', async () => {
            const email = recoveryInput.value.trim();

            if (!email || !email.includes('@')) {
                alert("Por favor ingresa un correo electrónico válido.");
                return;
            }

            btnSend.innerText = "Verificando...";
            btnSend.disabled = true;

            try {
                const response = await fetch(`${API_URL}/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    alert(`✅ ${data.message}`);
                    modal.style.display = 'none';
                    recoveryInput.value = "";
                } else {
                    alert(`⚠️ ${data.message || 'El correo no se encuentra registrado.'}`);
                }
            } catch (error) {
                console.error('Error al recuperar contraseña:', error);
                alert('Ocurrió un error al conectar con el servidor.');
            } finally {
                btnSend.innerText = "Enviar Correo";
                btnSend.disabled = false;
            }
        });
    }

    // ======================================================
    // 4. LÓGICA DE LOGIN (SUBMIT)
    // ======================================================
    if (emailInput && passwordInput) {
        [emailInput, passwordInput].forEach(input => {
            input.addEventListener('input', () => {
                if (errorBox) errorBox.style.display = 'none';
            });
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            const btnSubmit = loginForm.querySelector('button[type="submit"]');
            const originalText = btnSubmit.innerText;

            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
            btnSubmit.disabled = true;
            if (errorBox) errorBox.style.display = 'none';

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (data.success) {
                    loginSuccess({
                        role: data.role,
                        id: data.userId,
                        name: data.name
                    });
                } else {
                    mostrarError(data.message || 'Correo o contraseña incorrectos.');
                }

            } catch (error) {
                console.error('Error en el login:', error);
                mostrarError('No hay conexión con el servidor backend.');
            } finally {
                btnSubmit.innerText = originalText;
                btnSubmit.disabled = false;
            }
        });
    }

    function mostrarError(mensaje) {
        if (errorBox && errorText) {
            errorText.innerText = mensaje;
            errorBox.style.display = 'block';
        } else {
            alert(mensaje);
        }
    }
});

// ======================================================
// 5. FUNCIONES GLOBALES DE SESIÓN
// ======================================================
function loginSuccess(userData) {
    localStorage.setItem('usuarioLogueado', userData.name); 
    localStorage.setItem('role', userData.role);
    localStorage.setItem('userId', userData.id);
    
    if (userData.role === 'planner' || userData.role === 'admin') {
        window.location.href = 'dashboard-wedding.html';
    } else if (userData.role === 'novia') {
        window.location.href = 'dashboard-novia.html';
    } else {
        window.location.href = 'index.html';
    }
}

function cerrarSesion() {
    localStorage.removeItem('usuarioLogueado');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    localStorage.removeItem('adminNoviaSeleccionada');
    alert('Sesión cerrada correctamente.');
    window.location.href = 'index.html';
}