document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://wedding-web-lygz.onrender.com/api';

    // --- ELEMENTOS DEL DOM ---
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    
    // Elementos de Error del Login
    const errorBox = document.getElementById('mensajeError');
    const errorText = document.getElementById('textoError');

    // Elementos del Modal de Recuperación
    const modal = document.getElementById('recoveryModal');
    const linkRecovery = document.getElementById('forgotLink');
    const btnCancel = document.getElementById('btnCancel');
    const btnSend = document.getElementById('btnSend');
    const recoveryInput = document.getElementById('recoveryEmail');

    // Botón de Cerrar Sesión
    const btnLogout = document.getElementById('btnLogout');

    // ======================================================
    // HELPER PARA MOSTRAR/OCULTAR MENSAJES DENTRO DEL MODAL
    // ======================================================
    function getRecoveryMsgElement() {
        let msgEl = document.getElementById('recoveryMsg');
        if (!msgEl && recoveryInput) {
            msgEl = document.createElement('div');
            msgEl.id = 'recoveryMsg';
            msgEl.style.marginTop = '-12px';
            msgEl.style.marginBottom = '18px';
            msgEl.style.fontSize = '0.85rem';
            msgEl.style.fontWeight = '600';
            msgEl.style.textAlign = 'center';
            msgEl.style.lineHeight = '1.4';
            recoveryInput.after(msgEl);
        }
        return msgEl;
    }

    function showModalMessage(mensaje, esError = true) {
        const msgEl = getRecoveryMsgElement();
        if (msgEl) {
            msgEl.innerText = mensaje;
            msgEl.style.color = esError ? '#c62828' : '#2e7d32';
            msgEl.style.backgroundColor = esError ? '#ffebee' : '#e8f5e9';
            msgEl.style.padding = '8px 12px';
            msgEl.style.borderRadius = '6px';
            msgEl.style.border = `1px solid ${esError ? '#ffcdd2' : '#c8e6c9'}`;
            msgEl.style.display = 'block';
        }
    }

    function clearModalMessage() {
        const msgEl = document.getElementById('recoveryMsg');
        if (msgEl) {
            msgEl.innerText = '';
            msgEl.style.display = 'none';
        }
    }

    function mostrarError(mensaje) {
        if (errorBox && errorText) {
            errorText.innerText = mensaje;
            errorBox.style.display = 'block';
        } else {
            alert(mensaje);
        }
    }

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
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            togglePassword.classList.toggle('fa-eye', !isPassword);
            togglePassword.classList.toggle('fa-eye-slash', isPassword);
        });
    }

    // ======================================================
    // 3. LÓGICA DEL MODAL (RECUPERAR CONTRASEÑA EN LÍNEA)
    // ======================================================
    if (linkRecovery) {
        linkRecovery.addEventListener('click', (e) => {
            e.preventDefault();
            if (modal) {
                clearModalMessage();
                modal.style.display = 'flex';
                if (emailInput && emailInput.value) {
                    recoveryInput.value = emailInput.value;
                }
            }
        });
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            if (modal) {
                modal.style.display = 'none';
                clearModalMessage();
            }
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            clearModalMessage();
        }
    });

    if (recoveryInput) {
        recoveryInput.addEventListener('input', clearModalMessage);
    }

    if (btnSend) {
        btnSend.addEventListener('click', async () => {
            const email = recoveryInput.value.trim();
            clearModalMessage();

            if (!email || !email.includes('@')) {
                showModalMessage('⚠️ Por favor ingresa un correo electrónico válido.', true);
                return;
            }

            btnSend.innerText = 'Verificando...';
            btnSend.disabled = true;

            try {
                const response = await fetch(`${API_URL}/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showModalMessage(`✅ ${data.message || 'Se han enviado las instrucciones a tu correo.'}`, false);
                    recoveryInput.value = '';
                } else {
                    showModalMessage(`⚠️ ${data.message || 'El correo electrónico no se encuentra registrado.'}`, true);
                }
            } catch (error) {
                console.error('Error de red al recuperar contraseña:', error);
                showModalMessage('⚠ No se pudo establecer conexión con el servidor.', true);
            } finally {
                btnSend.innerText = 'Enviar Correo';
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

                if (response.ok && data.success) {
                    // Mapeo correcto de las propiedades que envía el backend
                    loginSuccess({
                        id: data.userId,
                        name: data.name,
                        role: data.role,
                        mustChangePassword: data.mustChangePassword,
                        token: data.token
                    });
                } else {
                    mostrarError(data.message || 'Credenciales incorrectas. Revisa tu correo y contraseña.');
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
});

// ======================================================
// 5. FUNCIONES GLOBALES DE SESIÓN
// ======================================================
function loginSuccess(userData) {
    if (!userData) return;

    localStorage.setItem('usuarioLogueado', userData.name || ''); 
    localStorage.setItem('role', userData.role || '');
    localStorage.setItem('userId', userData.id || '');
    localStorage.setItem('user', JSON.stringify(userData));
    
    if (userData.token) {
        localStorage.setItem('token', userData.token);
    }
    
    // Redirección por rol
    switch (userData.role) {
        case 'planner':
        case 'admin':
            window.location.href = 'dashboard-wedding.html';
            break;
        case 'novia':
            window.location.href = 'dashboard-novia.html';
            break;
        default:
            window.location.href = 'index.html';
            break;
    }
}

function cerrarSesion() {
    localStorage.removeItem('usuarioLogueado');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('adminNoviaSeleccionada');
    window.location.href = 'login.html';
}

// ======================================================
// 6. HELPER GLOBAL PARA PETICIONES AUTENTICADAS (JWT)
// ======================================================
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 || response.status === 403) {
            console.warn("🔒 Token inválido o expirado. Redirigiendo a login...");
            cerrarSesion();
            return null;
        }

        return response;
    } catch (error) {
        console.error("Error en la petición autenticada:", error);
        throw error;
    }
}