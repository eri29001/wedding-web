document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://wedding-web-lygz.onrender.com/api';

    const resetForm = document.getElementById('resetPasswordForm');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const toggleNewPwd = document.getElementById('toggleNewPwd');
    const toggleConfirmPwd = document.getElementById('toggleConfirmPwd');
    const errorBox = document.getElementById('resetErrorBox');
    const errorText = document.getElementById('resetErrorText');
    const btnReset = document.getElementById('btnReset');

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    // Lógica para ver/ocultar contraseñas
    setupTogglePassword(toggleNewPwd, newPasswordInput);
    setupTogglePassword(toggleConfirmPwd, confirmPasswordInput);

    function setupTogglePassword(toggleBtn, inputField) {
        if (toggleBtn && inputField) {
            toggleBtn.addEventListener('click', () => {
                const type = inputField.getAttribute('type') === 'password' ? 'text' : 'password';
                inputField.setAttribute('type', type);
                toggleBtn.classList.toggle('fa-eye');
                toggleBtn.classList.toggle('fa-eye-slash');
            });
        }
    }

    if (!token) {
        mostrarError('⚠️ Enlace inválido o incompleto. Solicita una nueva recuperación.');
        if (btnReset) btnReset.disabled = true;
        return;
    }

    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const password = newPasswordInput.value.trim();
            const confirmPassword = confirmPasswordInput.value.trim();

            // Validar fuerza de la clave (mínimo 8 caracteres y combinación de números)
            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!\%*#?&]{8,}$/;
            if (!passwordRegex.test(password)) {
                mostrarError('La contraseña debe contener al menos 8 caracteres, combinando letras y números.');
                return;
            }

            if (password !== confirmPassword) {
                mostrarError('Las contraseñas ingresadas no coinciden.');
                return;
            }

            btnReset.innerText = 'Actualizando...';
            btnReset.disabled = true;
            if (errorBox) errorBox.style.display = 'none';

            try {
                const response = await fetch(`${API_URL}/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, newPassword: password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Contraseña Actualizada!',
                        text: 'Tu clave se ha cambiado con éxito. Redirigiendo al inicio de sesión...',
                        confirmButtonColor: '#D81B60',
                        timer: 2500
                    }).then(() => {
                        window.location.href = 'login.html';
                    });
                } else {
                    mostrarError(data.message || 'El enlace ha expirado o no es válido.');
                }
            } catch (error) {
                console.error('Error al restablecer clave:', error);
                mostrarError('No se pudo establecer conexión con el servidor.');
            } finally {
                btnReset.innerText = 'GUARDAR CONTRASEÑA';
                btnReset.disabled = false;
            }
        });
    }

    function mostrarError(mensaje) {
        if (errorBox && errorText) {
            errorText.innerText = mensaje;
            errorBox.style.display = 'block';
        }
    }
});