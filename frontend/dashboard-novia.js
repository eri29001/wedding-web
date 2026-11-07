/* ==========================================================================
   1. CONFIGURACIÓN, ESTADO GLOBAL Y HELPERS
   ========================================================================== */
const API_URL = 'https://wedding-web-lygz.onrender.com/api';

// Estado de la Aplicación
let calendarInstance = null;
let budgetChartInstance = null;
let cropperInstance = null;
let vendorToDeleteId = null;

let checklistItems = [];
let guestsItems = [];
let budgetItems = [];
let recommendedVendors = [];
let selectedVendors = [];

/* ==========================================================================
   2. INICIALIZACIÓN DE LA APLICACIÓN (DOMContentLoaded)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar datos del usuario y perfil
    cargarPerfilUsuario();

    // 2. Consultar y sincronizar presupuesto desde la BD en Render
    cargarPresupuestoDesdeBD();

    // 3. Cargar información complementaria (canciones y notas)
    cargarCancionesGuardadas();
    cargarNotasRapidas();

    // 4. Renderizar listas y configurar sanitizadores de inputs
    renderVendorLists();
    setupBudgetInputSanitizer();

    // 5. Inicializar calendario si la función existe
    if (typeof initCalendar === 'function') {
        initCalendar();
    }
});

/**
 * Valida y limpia el userId de localStorage para evitar errores 404 en la API
 */
function obtenerUserIdValido() {
    const uId = localStorage.getItem('userId');
    if (!uId || uId === 'novia_erika' || uId === 'novia erika' || uId === 'undefined') {
        return null;
    }
    return encodeURIComponent(uId);
}

/* ==========================================================================
   2. INICIALIZACIÓN PRINCIPAL (DOMContentLoaded)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Aplicación Iniciada. API conectada a:", API_URL);

    // 1. Cargar nombre de usuario e iniciales
    const userName = localStorage.getItem('usuarioLogueado') || 'Novia';
    const userNameDisplay = document.getElementById('user-name-display');
    const avatarBtn = document.getElementById('navbar-avatar-btn');
    
    if (userNameDisplay) userNameDisplay.textContent = userName;
    if (avatarBtn) avatarBtn.textContent = userName.charAt(0).toUpperCase();

    // 2. Inicializar Módulos Principales
    iniciarCuentaRegresiva();
    await obtenerTareasDesdeBD();
    await obtenerInvitadosDesdeBD();
    await obtenerPresupuestoBD();
    await cargarProveedoresBD();
    await verificarAlertasSilenciosas();
    await cargarDatosPerfil();

    // Vincular botón guardar
    const btnSave = document.getElementById('btn-save-profile');
    if (btnSave) {
        btnSave.addEventListener('click', saveProfileToDB);
    }
    
    initDashboardCalendar();
    initChatbot();

    //Guardar cambios, ejecuta la acción del botón "Guardar Perfil"
    const btnSaveProfile = document.getElementById('btn-save-profile');
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener('click', saveProfileToDB);
    }
});

//Guardar perfil a BD
/* ==========================================================================
   GUARDAR PERFIL EN BASE DE DATOS Y LOCAL
   ========================================================================== */
window.saveProfileToDB = async function() {
    const btnSave = document.getElementById('btn-save-profile');
    const partner = document.getElementById('profile-partner')?.value.trim() || '';
    const date = document.getElementById('profile-date')?.value || '';
    const budgetInput = document.getElementById('profile-budget');
    const style = document.getElementById('profile-style')?.value || 'Clásica';
    const name = localStorage.getItem('usuarioLogueado') || 'Erika';
    const avatarImage = localStorage.getItem('avatarImage') || '';
    const userId = localStorage.getItem('userId');

    // Validación y sanitización del Presupuesto (Evita valores negativos)
    let budgetNum = budgetInput ? parseFloat(budgetInput.value) : 0;
    if (isNaN(budgetNum) || budgetNum < 0) {
        budgetNum = 0;
    }

    // Actualizar el valor en el input si era negativo
    if (budgetInput) {
        budgetInput.value = budgetNum;
    }

    const originalText = btnSave ? btnSave.innerText : 'Guardar Cambios';
    if (btnSave) btnSave.innerText = 'Guardando...';

    // 1. Guardar en localStorage inmediatamente
    localStorage.setItem('partnerName', partner);
    if (date) localStorage.setItem('weddingDate', date);
    localStorage.setItem('weddingBudget', budgetNum.toString());
    if (style) localStorage.setItem('weddingStyle', style);

    // 2. Refrescar widget de presupuesto en tiempo real
    if (typeof renderBudget === 'function') {
        renderBudget('all');
    }

    // Obtener el Presupuesto Total guardado por la novia, forzando que no sea negativo
    const presupuestoAsignado = Math.max(0, parseFloat(localStorage.getItem('weddingBudget')) || 0);

    const payload = {
        userId,
        nombre: name,
        pareja: partner,
        fecha_boda: date,
        presupuesto: budgetNum,
        estilo: style,
        avatarBase64: avatarImage
    };

    // 3. Guardar en la base de datos
    try {
        await fetch(`${API_URL}/guardar-perfil`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.warn("Error al conectar con la BD, datos guardados en navegador.");
    } finally {
        if (btnSave) btnSave.innerText = originalText;
    }

    // 4. Actualizar la cuenta regresiva en pantalla si cambió la fecha
    if (typeof iniciarCuentaRegresiva === 'function') {
        iniciarCuentaRegresiva();
    }

    closeAllModals();
    openModal('modal-success');
};

/* ==========================================================================
   3. SISTEMA UNIFICADO DE MODALES
   ========================================================================== */
window.openModal = function(id) {
    const modal = document.getElementById(id);
    const overlay = document.getElementById('modal-overlay');
    
    if (modal) {
        // Al abrir el perfil, asegura la carga del nombre oficial almacenado
        if (id === 'modal-profile') {
            const inputNombrePerfil = document.getElementById('profile-name');
            const storedName = localStorage.getItem('usuarioLogueado') || localStorage.getItem('userName') || 'Erika';
            
            if (inputNombrePerfil) {
                inputNombrePerfil.value = storedName;
            }
        }

        if (overlay) overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
    }
};

window.closeAllModals = function() {
    const modales = document.querySelectorAll('.custom-modal');
    const overlay = document.getElementById('modal-overlay');

    modales.forEach(modal => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    });

    if (overlay) overlay.classList.add('hidden');
    document.body.classList.remove('modal-open');
};

// Accesos específicos de modales
window.abrirModalPlanificacion = () => openModal('modal-full-checklist');
window.cerrarModalPlanificacion = () => closeAllModals();

window.openGuestsModal = () => openModal('modal-guests');
window.openBudgetModal = () => {
    openModal('modal-budget');
    setTimeout(() => initBudgetChart(), 100);
};

window.openVideoModal = () => openModal('modal-video');
window.closeVideoModal = () => closeAllModals();

window.cerrarModalEliminar = () => {
    vendorToDeleteId = null;
    closeAllModals();
};

window.openMultiVendorRatingModal = () => {
    const formContainer = document.getElementById('rating-form-container');
    if (formContainer) {
        formContainer.innerHTML = `
            <p class="mb-15">Valora el servicio prestado por tus proveedores:</p>
            <div class="rate-row">
                <span>Fotografía & Video</span>
                <div class="stars-container" data-vendor="fotografia">★ ★ ★ ★ ★</div>
            </div>
            <div class="rate-row">
                <span>Catering / Menú</span>
                <div class="stars-container" data-vendor="catering">★ ★ ★ ★ ★</div>
            </div>
        `;
    }
    openModal('modal-rate');
};

window.openPlannerRatingModal = () => {
    const formContainer = document.getElementById('rating-form-container');
    if (formContainer) {
        formContainer.innerHTML = `
            <p class="mb-15">¿Qué tal fue tu experiencia con tu Wedding Planner (Andrea)?</p>
            <div class="rate-row">
                <span>Atención y Gestión</span>
                <div class="stars-container" data-vendor="andrea">★ ★ ★ ★ ★</div>
            </div>
        `;
    }
    openModal('modal-rate');
};

window.submitRating = () => {
    closeAllModals();
    setTimeout(() => openModal('modal-thank-you'), 300);
};

/* ==========================================================================
   4. GESTIÓN DE TAREAS Y CHECKLIST
   ========================================================================== */
async function obtenerTareasDesdeBD() {
    const userId = obtenerUserIdValido();
    if (userId) {
        try {
            const res = await fetch(`${API_URL}/tasks/${userId}`);
            if (res.ok) checklistItems = await res.json();
        } catch (e) {
            console.warn("Error al cargar tareas desde servidor.");
        }
    }

    if (checklistItems.length === 0) {
        checklistItems = [
            { id: 1, title: "Definir lista preliminar de invitados", completed: true },
            { id: 2, title: "Reservar fecha en el salón", completed: true },
            { id: 3, title: "Prueba de menú de bodas", completed: false },
            { id: 4, title: "Prueba de vestuario y maquillaje", completed: false }
        ];
    }
    renderChecklist();
}

window.renderChecklist = function() {
    const containerWidget = document.getElementById('checklist-container');
    const containerModal = document.getElementById('lista-completa-container');
    
    const listaNormalizada = checklistItems.map(t => ({
        id: t.id,
        text: t.task_text || t.text || t.texto || t.description || t.title || t.name || "Nueva Tarea", 
        completed: Boolean(t.is_completed || t.completed || t.status === 'completed')
    }));

    // Actualizar Progreso Global
    const total = listaNormalizada.length;
    const completadas = listaNormalizada.filter(t => t.completed).length;
    const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

    const bar = document.getElementById('progress-bar');
    const txt = document.getElementById('progress-text');
    if (bar) bar.style.width = `${porcentaje}%`;
    if (txt) txt.textContent = `${porcentaje}%`;

    if (porcentaje === 100 && total > 0) {
        const celCard = document.getElementById('container-botones-calificacion');
        if (celCard) celCard.classList.remove('hidden');
    }

    // Render Widget (primeras 3 tareas)
    if (containerWidget) {
        containerWidget.innerHTML = '';
        if (listaNormalizada.length === 0) {
            containerWidget.innerHTML = `<p class="text-muted text-center p-20">¡No tienes tareas pendientes!</p>`;
        } else {
            listaNormalizada.slice(0, 3).forEach(tarea => {
                const isChecked = tarea.completed ? 'checked' : '';
                const styleText = tarea.completed ? 'text-decoration: line-through; color: #bbb;' : 'color: #555;';
                
                const html = `
                    <div class="checklist-item-row">
                        <input type="checkbox" ${isChecked} onchange="cambiarEstadoTarea(${tarea.id}, this.checked)">
                        <span style="${styleText}">${tarea.text}</span>
                    </div>
                `;
                containerWidget.insertAdjacentHTML('beforeend', html);
            });
        }
    }

    // Render Modal Completo
    if (containerModal) {
        containerModal.innerHTML = '';
        listaNormalizada.forEach(tarea => {
            const isChecked = tarea.completed ? 'checked' : '';
            const styleText = tarea.completed ? 'text-decoration: line-through; color: #bbb;' : 'color: #555;';
            const html = `
                <div class="checklist-item-row">
                    <input type="checkbox" ${isChecked} onchange="cambiarEstadoTarea(${tarea.id}, this.checked)">
                    <span style="${styleText}">${tarea.text}</span>
                </div>
            `;
            containerModal.insertAdjacentHTML('beforeend', html);
        });
    }
};

window.toggleInputTarea = function() {
    const row = document.getElementById('nueva-tarea-row');
    if (row) {
        row.style.display = row.style.display === 'none' ? 'flex' : 'none';
        if (row.style.display === 'flex') document.getElementById('inputNuevaTarea').focus();
    }
};

window.guardarNuevaTarea = async function() {
    const input = document.getElementById('inputNuevaTarea');
    const text = input ? input.value.trim() : '';
    const userId = localStorage.getItem('userId');
    
    if (!text) return;

    try {
        const res = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, task_text: text, is_completed: false })
        });

        if (res.ok) {
            if (input) input.value = '';
            toggleInputTarea();
            await obtenerTareasDesdeBD(); // Refresca desde la base de datos
        }
    } catch (e) {
        console.warn("Servidor no disponible. Guardando localmente.");
        checklistItems.push({ id: Date.now(), title: text, completed: false });
        if (input) input.value = '';
        toggleInputTarea();
        renderChecklist();
    }
};

window.cambiarEstadoTarea = async function(id, completed) {
    // 1. Actualización visual inmediata (UX Fluida)
    const tarea = checklistItems.find(t => t.id === id);
    if (tarea) {
        tarea.completed = completed;
        tarea.is_completed = completed;
        renderChecklist();
    }

    // 2. Persistencia en BD
    try {
        await fetch(`${API_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_completed: completed })
        });
    } catch (e) {
        console.warn("No se pudo sincronizar el estado del checklist con la BD:", e);
    }
};

//Guardar perfil de novia
document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
    const name = document.getElementById('profile-name')?.value.trim();
    const partner = document.getElementById('profile-partner')?.value.trim();
    const date = document.getElementById('profile-date')?.value;
    const budget = document.getElementById('profile-budget')?.value;
    const style = document.getElementById('profile-style')?.value;
    const userId = localStorage.getItem('userId');
    const canvas = cropper.getCroppedCanvas({
        width: 300,
        height: 300,
        imageSmoothingQuality: 'high'
    });
    // Exportar con compresión JPEG al 80%
    tempCroppedImage = canvas.toDataURL("image/jpeg", 0.8);
    
    // Guardar copia local rápida
    if (name) localStorage.setItem('usuarioLogueado', name);
    if (date) localStorage.setItem('weddingDate', date);

    try {
        const res = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, name, partner, date, budget, style })
        });

        closeAllModals();
        openModal('modal-success');
        
        // Actualizar la interfaz sin recargar
        if (name) {
            const userNameDisplay = document.getElementById('user-name-display');
            if (userNameDisplay) userNameDisplay.textContent = name;
        }
        iniciarCuentaRegresiva();
    } catch (e) {
        console.warn("Guardado local completado.");
        closeAllModals();
        openModal('modal-success');
    }

    if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido (.jpg, .png, .webp)');
        return;
    }
});
// Carga y llena automáticamente los inputs con los datos de la BD o localStorage
async function cargarDatosPerfil() {
    const nameInput = document.getElementById('profile-name');
    const partnerInput = document.getElementById('profile-partner');
    const dateInput = document.getElementById('profile-date');
    const budgetInput = document.getElementById('profile-budget');
    const styleInput = document.getElementById('profile-style');
    const previewImg = document.getElementById('preview-avatar');
    const previewInitial = document.getElementById('preview-initial');
    const avatarBtn = document.getElementById('navbar-avatar-btn');

    // 1. Cargar desde localStorage para disponibilidad inmediata
    const savedName = localStorage.getItem('usuarioLogueado') || 'Erika';
    const savedPartner = localStorage.getItem('partnerName') || '';
    const savedDate = localStorage.getItem('weddingDate') || '';
    const savedBudget = localStorage.getItem('weddingBudget') || '';
    const savedStyle = localStorage.getItem('weddingStyle') || 'Clásica';
    const savedAvatar = localStorage.getItem('avatarImage') || '';

    if (nameInput) nameInput.value = savedName;
    if (partnerInput) partnerInput.value = savedPartner;
    if (dateInput) dateInput.value = savedDate;
    if (budgetInput) budgetInput.value = savedBudget;
    if (styleInput) styleInput.value = savedStyle;

    // Foto de Perfil
    if (savedAvatar) {
        if (previewImg) {
            previewImg.src = savedAvatar;
            previewImg.classList.remove('hidden');
        }
        if (previewInitial) previewInitial.classList.add('hidden');
        if (avatarBtn) {
            avatarBtn.textContent = '';
            avatarBtn.style.backgroundImage = `url(${savedAvatar})`;
            avatarBtn.style.backgroundSize = 'cover';
            avatarBtn.style.backgroundPosition = 'center';
        }
    }

    // 2. Consultar a la BD por si hubo cambios desde otro dispositivo
    const userId = obtenerUserIdValido();
    if (userId) {
        try {
            const res = await fetch(`${API_URL}/profile/${userId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.partner && partnerInput) partnerInput.value = data.partner;
                if (data.wedding_date && dateInput) dateInput.value = data.wedding_date;
                if (data.budget && budgetInput) budgetInput.value = data.budget;
                if (data.style && styleInput) styleInput.value = data.style;
            }
        } catch (e) {
            console.log("Modo offline: mostrando datos de caché local.");
        }
    }
}

async function cargarNombreUsuario() {
    const spanNombre = document.getElementById('user-name-display');
    const inputNombrePerfil = document.getElementById('profile-name');
    const userId = localStorage.getItem('userId');
    
    // 1. Obtener desde localStorage
    let storedName = localStorage.getItem('userName') || localStorage.getItem('usuarioLogueado') || 'Erika';
    
    if (storedName) {
        if (spanNombre) spanNombre.innerText = storedName.split(' ')[0];
        if (inputNombrePerfil) inputNombrePerfil.value = storedName;
    }

    // 2. Consultar BD para asegurar el nombre oficial registrado por la Planner
    if (userId) {
        try {
            const res = await fetch(`${API_URL}/profile/${userId}`);
            const data = await res.json();
            
            if (data.success && data.user && data.user.name) {
                const nombreOficial = data.user.name;
                
                localStorage.setItem('userName', nombreOficial);
                localStorage.setItem('usuarioLogueado', nombreOficial); 
                
                if (spanNombre) spanNombre.innerText = nombreOficial.split(' ')[0];
                if (inputNombrePerfil) inputNombrePerfil.value = nombreOficial;

                if (data.user.wedding_date) {
                    localStorage.setItem('weddingDate', data.user.wedding_date);
                }
            }
        } catch (error) {
            console.log("Modo offline: usando nombre almacenado en caché local");
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const budgetInput = document.getElementById('profile-budget');

    if (budgetInput) {
        // 1. Previene tipear teclas no numéricas
        budgetInput.addEventListener('keydown', (e) => {
            const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
            
            // Permitir teclas de navegación y control
            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
                return;
            }

            // Bloquear si la tecla presionada no es un número del 0 al 9
            if (!/^[0-9]$/.test(e.key)) {
                e.preventDefault();
            }
        });

        // 2. Filtra contenido al copiar/pegar o autocompletar
        budgetInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
});

/* ==========================================================================
   RECORTADOR DE FOTO DE PERFIL (Cropper.js)
   ========================================================================== */

// 1. Vincular el input de la imagen al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    const uploadInput = document.getElementById('upload-avatar');
    if (uploadInput) {
        uploadInput.addEventListener('change', handleImageUpload);
    }

    const btnPerformCrop = document.getElementById('btn-perform-crop');
    if (btnPerformCrop) {
        btnPerformCrop.addEventListener('click', performCrop);
    }
});

// 2. Procesar la imagen seleccionada y abrir el modal
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecciona un archivo de imagen válido (.jpg, .png, .webp)');
        return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
        const imgElement = document.getElementById('image-to-crop');
        if (imgElement) {
            imgElement.src = evt.target.result;

            // Ocultar modal de perfil y abrir modal cropper
            closeAllModals();
            openModal('modal-cropper');

            // Destruir instancia previa si existe
            if (cropperInstance) {
                cropperInstance.destroy();
            }

            // Esperar a que el modal se muestre para inicializar Cropper.js correctamente
            setTimeout(() => {
                cropperInstance = new Cropper(imgElement, {
                    aspectRatio: 1, // Cuadrado 1:1
                    viewMode: 1,
                    autoCropArea: 0.9,
                    responsive: true,
                    background: false
                });
            }, 150);
        }
    };
    reader.readAsDataURL(file);
}

// 3. Aplicar el recorte y actualizar la vista previa
function performCrop() {
    if (!cropperInstance) return;

    // Generar imagen comprimida a 300x300 px
    const canvas = cropperInstance.getCroppedCanvas({
        width: 300,
        height: 300,
        imageSmoothingQuality: 'high'
    });

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.8);

    // Actualizar vista previa en el modal de perfil
    const previewImg = document.getElementById('preview-avatar');
    const previewInitial = document.getElementById('preview-initial');

    if (previewImg) {
        previewImg.src = croppedBase64;
        previewImg.classList.remove('hidden');
    }
    if (previewInitial) {
        previewInitial.classList.add('hidden');
    }

    // Actualizar foto en la barra de navegación al instante
    const avatarBtn = document.getElementById('navbar-avatar-btn');
    if (avatarBtn) {
        avatarBtn.textContent = '';
        avatarBtn.style.backgroundImage = `url(${croppedBase64})`;
        avatarBtn.style.backgroundSize = 'cover';
        avatarBtn.style.backgroundPosition = 'center';
    }

    // Guardar temporalmente en caché
    localStorage.setItem('avatarImage', croppedBase64);

    // Cerrar cropper y reabrir el perfil
    closeAllModals();
    // Carga los datos guardados dentro de los campos del formulario de perfil
    function cargarDatosEnFormularioPerfil() {
        const nameInput = document.getElementById('profile-name');
        const dateInput = document.getElementById('profile-date');
        const previewImg = document.getElementById('preview-avatar');
        const previewInitial = document.getElementById('preview-initial');

        const name = localStorage.getItem('usuarioLogueado');
        const date = localStorage.getItem('weddingDate');
        const avatar = localStorage.getItem('avatarImage');

        if (nameInput && name) nameInput.value = name;
        if (dateInput && date) dateInput.value = date;

        if (avatar && previewImg) {
            previewImg.src = avatar;
            previewImg.classList.remove('hidden');
            if (previewInitial) previewInitial.classList.add('hidden');
        }
    }

    // Precargar datos en el modal de perfil manteniendo el nombre bloqueado
    function precargarDatosPerfil() {
        const nameInput = document.getElementById('profile-name');
        const partnerInput = document.getElementById('profile-partner');
        const dateInput = document.getElementById('profile-date');
        const budgetInput = document.getElementById('profile-budget');
        const styleInput = document.getElementById('profile-style');

        // Nombre bloqueado obtenido del registro inicial / login
        if (nameInput) {
            nameInput.value = localStorage.getItem('usuarioLogueado') || 'Erika';
            nameInput.readOnly = true; // Refuerzo por código
        }
    
        // Campos editables por la novia
        if (partnerInput && localStorage.getItem('partnerName')) partnerInput.value = localStorage.getItem('partnerName');
        if (dateInput && localStorage.getItem('weddingDate')) dateInput.value = localStorage.getItem('weddingDate');
        if (budgetInput && localStorage.getItem('weddingBudget')) budgetInput.value = localStorage.getItem('weddingBudget');
        if (styleInput && localStorage.getItem('weddingStyle')) styleInput.value = localStorage.getItem('weddingStyle');
    }
}

/* ==========================================================================
   5. AGENDA Y CALENDARIO (FullCalendar)
   ========================================================================== */
async function initDashboardCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    
    const userId = obtenerUserIdValido();
    let eventsData = [];

    if (userId) {
        try {
            const response = await fetch(`${API_URL}/events/${userId}`);
            if (response.ok) {
                const data = await response.json();
                eventsData = data.map(evt => ({
                    title: evt.title,
                    start: evt.date || evt.start,
                    color: evt.color || (evt.urgency === 'urgent' ? '#D81B60' : '#8E24AA'),
                    extendedProps: { urgency: evt.urgency || 'medium', completed: evt.completed || false, desc: evt.description || evt.desc, audience: evt.audience || 'Novia' }
                }));
            }
        } catch (error) { console.log("Servidor local / offline para eventos."); }
    }

    if (eventsData.length === 0) {
        const today = new Date(); 
        const y = today.getFullYear(); 
        const m = String(today.getMonth() + 1).padStart(2, '0');
        eventsData = [
            { title: 'Prueba Menú', start: `${y}-${m}-15`, color: '#8E24AA', extendedProps: { urgency: 'medium', desc: 'Degustación...', audience: 'Novios' } },
            { title: 'Pago Salón', start: `${y}-${m}-20`, color: '#D81B60', extendedProps: { urgency: 'urgent', desc: 'Pago del 50%', audience: 'Novia' } }
        ];
    }

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        height: 'auto',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listWeek' },
        events: eventsData,
        eventClick: (info) => {
            info.jsEvent.preventDefault();
            openEventDetails(info.event);
        }
    });

    calendarInstance.render();
}

window.filtrarCalendario = function(filter, btnEl) {
    document.querySelectorAll('.pastel-filters-container .filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    
    // Filtro básico sobre eventos de FullCalendar
    if (calendarInstance) {
        calendarInstance.getEvents().forEach(evt => {
            if (filter === 'all') {
                evt.setProp('display', 'auto');
            } else {
                const urgency = evt.extendedProps.urgency;
                evt.setProp('display', urgency === filter ? 'auto' : 'none');
            }
        });
    }
};

function openEventDetails(event) {
    const dDate = document.getElementById('evt-date');
    const dAud = document.getElementById('evt-audience');
    const dPrio = document.getElementById('evt-priority');
    const dDesc = document.getElementById('evt-desc');

    if (dDate) dDate.textContent = event.startStr;
    if (dAud) dAud.textContent = event.extendedProps.audience || 'Novia';
    if (dPrio) dPrio.textContent = event.extendedProps.urgency || 'Normal';
    if (dDesc) dDesc.textContent = event.extendedProps.desc || 'Sin descripción';

    openModal('modal-event-details');
}

/* ==========================================================================
   6. GESTIÓN DE INVITADOS & RSVP (WhatsApp)
   ========================================================================== */
async function obtenerInvitadosDesdeBD() {
    const userId = obtenerUserIdValido();
    if (userId) {
        try {
            const res = await fetch(`${API_URL}/guests/${userId}`);
            if (res.ok) guestsItems = await res.json();
        } catch (e) { console.warn("Error al cargar invitados desde BD."); }
    }

    if (guestsItems.length === 0) {
        guestsItems = [
            { id: 1, name: "María López", group: "Familia Novia", table: "1", status: "Confirmado", phone: "+593991234567" },
            { id: 2, name: "Carlos Pérez", group: "Amigos Novio", table: "2", status: "Pendiente", phone: "+593997654321" }
        ];
    }

    renderGuests();
}

function renderGuests() {
    const body = document.getElementById('guests-table-body');
    const searchVal = (document.getElementById('guest-search')?.value || '').toLowerCase();
    const filterVal = document.getElementById('guest-filter')?.value || 'all';

    const confirmados = guestsItems.filter(g => g.status === 'Confirmado').length;
    const countEl = document.getElementById('confirmed-guests');
    const totalEl = document.getElementById('total-guests');

    if (countEl) countEl.textContent = confirmados;
    if (totalEl) totalEl.textContent = guestsItems.length;

    if (!body) return;
    body.innerHTML = '';

    const filtrados = guestsItems.filter(g => {
        const matchesSearch = g.name.toLowerCase().includes(searchVal);
        const matchesStatus = filterVal === 'all' || g.status === filterVal;
        return matchesSearch && matchesStatus;
    });

    filtrados.forEach(g => {
        const badgeClass = g.status === 'Confirmado' ? 'confirmed' : 'pending';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${g.name}</strong></td>
            <td><span class="badge-group">${g.group || 'General'}</span></td>
            <td>Mesa ${g.table || '1'}</td>
            <td><span class="status-badge ${badgeClass}">${g.status}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="btn-whatsapp" onclick="enviarRSVPWhatsApp('${g.name}', '${g.phone || ''}')">
                        <i class="fab fa-whatsapp"></i> RSVP
                    </button>
                    <button class="btn-action-delete" onclick="eliminarInvitado(${g.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        body.appendChild(tr);
    });
}

window.filterGuests = () => renderGuests();

window.enviarRSVPWhatsApp = function(nombre, telefono = '') {
    const novia = localStorage.getItem('usuarioLogueado') || "la novia";
    const fecha = localStorage.getItem('weddingDate') ? ` para el ${localStorage.getItem('weddingDate')}` : '';
    
    const texto = encodeURIComponent(
        `¡Hola ${nombre}! 💍 Te escribimos para la boda de ${novia}${fecha}. Queremos organizar todos los detalles y nos encantaría confirmar tu asistencia. ¡Por favor cuéntanos si podrás acompañarnos!`
    );
    
    const cleanPhone = telefono ? telefono.replace(/\D/g, '') : '';
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${texto}` : `https://wa.me/?text=${texto}`;
    window.open(url, '_blank');
};

window.openAddGuestModal = () => openModal('modal-add-guest-form');
window.closeAddGuestModal = () => closeAllModals();

window.addNewGuest = async function() {
    const nameInput = document.getElementById('new-guest-name');
    const phoneInput = document.getElementById('new-guest-phone');
    const groupInput = document.getElementById('new-guest-group');
    const tableInput = document.getElementById('new-guest-table');
    const statusInput = document.getElementById('new-guest-status');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const group = groupInput ? groupInput.value : 'Familia';
    // Obtener el valor de la mesa y asegurarse de que no sea menor a 1
    const rawTable = tableInput ? parseInt(tableInput.value) : 1;
    const table = (!rawTable || rawTable < 1) ? 1 : rawTable;
    const status = statusInput ? statusInput.value : 'Pendiente';
    const userId = localStorage.getItem('userId');

    if (!name) return alert("Por favor escribe el nombre del invitado.");
    if (!userId) return alert("Sesión no válida. Inicia sesión de nuevo.");

    const payload = { userId, name, phone, group, table, status };

    try {
        const res = await fetch(`${API_URL}/guests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            if (nameInput) nameInput.value = '';
            if (phoneInput) phoneInput.value = '';
            closeAddGuestModal();
            await obtenerInvitadosDesdeBD(); // Recarga la lista actualizada desde la BD
        } else {
            alert("Error al guardar el invitado en la base de datos.");
        }
    } catch (error) {
        console.error("Error de conexión al crear invitado:", error);
        // Fallback local en caso de estar offline
        guestsItems.push({ id: Date.now(), name, phone, group, table, status });
        closeAddGuestModal();
        renderGuests();
    }
};

window.eliminarInvitado = async function(id) {
    if (!confirm("¿Estás segura de eliminar este invitado?")) return;

    try {
        const res = await fetch(`${API_URL}/guests/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await obtenerInvitadosDesdeBD();
        } else {
            guestsItems = guestsItems.filter(g => g.id !== id);
            renderGuests();
        }
    } catch (e) {
        guestsItems = guestsItems.filter(g => g.id !== id);
        renderGuests();
    }
};

/* ==========================================================================
   7. PRESUPUESTO Y GRÁFICOS (Chart.js)
   ========================================================================== */
async function obtenerPresupuestoBD() {
    const userId = obtenerUserIdValido();
    if (userId) {
        try {
            const res = await fetch(`${API_URL}/budget/${userId}`);
            if (res.ok) budgetItems = await res.json();
        } catch (e) { console.warn("Error al cargar presupuesto."); }
    }

    if (budgetItems.length === 0) {
        budgetItems = [
            { id: 1, item: "Alquiler de Salón", real: 3500, estimated: 3500, status: "paid" },
            { id: 2, item: "Servicio de Banquetes", real: 2200, estimated: 2500, status: "pending" },
            { id: 3, item: "Fotografía y Video", real: 1200, estimated: 1200, status: "paid" }
        ];
    }

    renderBudget('all');
}

/* ==========================================================================
   PRESUPUESTO SINCRONIZADO CON EL PERFIL DE LA NOVIA
   ========================================================================== */
/* ==========================================================================
   PRESUPUESTO SINCRONIZADO CON EL PERFIL DE LA NOVIA
   ========================================================================== */
/* ==========================================================================
   PERSISTENCIA Y GESTIÓN DE PRESUPUESTO (REEMPLAZO COMPLETO)
   ========================================================================== */


// 1. Cargar datos desde la BD en Render al iniciar
async function cargarPresupuestoDesdeBD() {
    const userId = localStorage.getItem('userId');
    try {
        const res = await fetch(`${API_URL}/budget?userId=${userId}`);
        if (res.ok) {
            budgetItems = await res.json();
            localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
        } else {
            budgetItems = JSON.parse(localStorage.getItem('budgetItems')) || [];
        }
    } catch (e) {
        console.warn("Sin conexión con BD. Cargando copia local.");
        budgetItems = JSON.parse(localStorage.getItem('budgetItems')) || [];
    }
    renderBudget('all');
}

// 2. Función renderBudget con Columna de Acciones y Cambio de Estado
function renderBudget(filter = 'all') {
    const tbody = document.getElementById('budget-table-body');
    const budgetTotalDisplay = document.getElementById('budget-total');
    const budgetLimitDisplay = document.getElementById('budget-limit-display');
    const modalBudgetTotal = document.getElementById('modal-budget-total');
    const budgetBarFill = document.getElementById('budget-bar-fill');

    // 1. Obtener Presupuesto Asignado y calcular Total Gastado
    const presupuestoAsignado = Math.max(0, parseFloat(localStorage.getItem('weddingBudget')) || 0);
    const totalGastado = budgetItems.reduce((acc, curr) => acc + Number(curr.real || 0), 0);

    const gastadoFmt = totalGastado.toLocaleString('es-EC');
    const asignadoFmt = presupuestoAsignado.toLocaleString('es-EC');

    // 2. Actualizar displays con formato de miles
    if (budgetTotalDisplay) {
        budgetTotalDisplay.textContent = gastadoFmt;
        budgetTotalDisplay.style.color = (totalGastado > presupuestoAsignado && presupuestoAsignado > 0) ? '#E53935' : '#E65100';
    }

    if (budgetLimitDisplay) {
        budgetLimitDisplay.textContent = `/ $${asignadoFmt}`;
    }

    if (modalBudgetTotal) {
        modalBudgetTotal.textContent = `$${gastadoFmt} de $${asignadoFmt}`;
        modalBudgetTotal.style.color = (totalGastado > presupuestoAsignado && presupuestoAsignado > 0) ? '#E53935' : '#FB8C00';
    }

    // 3. Actualizar barra de progreso y colores de alerta
    if (budgetBarFill) {
        let porcentaje = presupuestoAsignado > 0 ? Math.min(100, Math.round((totalGastado / presupuestoAsignado) * 100)) : 0;
        budgetBarFill.style.width = `${porcentaje}%`;
        budgetBarFill.style.background = (totalGastado > presupuestoAsignado && presupuestoAsignado > 0)
            ? 'linear-gradient(90deg, #E53935, #C62828)'
            : 'linear-gradient(90deg, #FFB74D, #FB8C00)';
    }

    // 4. Renderizar filas en la tabla (incluye columna de eliminación y toggle de estado)
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtrados = budgetItems.filter(b => filter === 'all' || b.status === filter);

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted p-20">
                    No hay servicios registrados en esta categoría.
                </td>
            </tr>
        `;
        return;
    }

    filtrados.forEach((b, index) => {
        const isPaid = b.status === 'paid';
        const badgeClass = isPaid ? 'status-badge paid' : 'status-badge pending';
        const badgeText = isPaid ? 'Pagado' : 'Pendiente';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${b.item}</strong></td>
            <td>$${Number(b.real).toLocaleString('es-EC')}</td>
            <td>$${Number(b.estimated || b.real).toLocaleString('es-EC')}</td>
            <td>
                <span class="${badgeClass}" style="cursor: pointer;" title="Clic para cambiar estado" onclick="toggleEstadoGasto(${index})">
                    ${badgeText}
                </span>
            </td>
            <td style="text-align: center;">
                <button type="button" class="btn-action-delete" title="Quitar servicio" onclick="eliminarGasto(${index})">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Eliminar gasto y sincronizar con la BD (DELETE)
window.eliminarGasto = async function(index) {
    const itemEliminado = budgetItems[index];
    if (!itemEliminado) return;

    budgetItems.splice(index, 1);
    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
    renderBudget('all');

    if (typeof showToast === 'function') showToast(`Se eliminó "${itemEliminado.item}"`);

    try {
        await fetch(`${API_URL}/budget/${itemEliminado.id}`, { method: 'DELETE' });
    } catch (e) {
        console.error("Error al eliminar en BD:", e);
    }
};

// 4. Cambiar estado Pagado/Pendiente y actualizar BD (PUT)
window.toggleEstadoGasto = async function(index) {
    const item = budgetItems[index];
    if (!item) return;

    item.status = item.status === 'paid' ? 'pending' : 'paid';
    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
    renderBudget('all');

    try {
        await fetch(`${API_URL}/budget/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: item.status })
        });
    } catch (e) {
        console.error("Error al actualizar estado en BD:", e);
    }
};

// 5. Agregar nuevo gasto y guardar en BD (POST)
window.guardarNuevoGastoBD = async function() {
    const nombreInput = document.getElementById('gasto-nombre');
    const realInput = document.getElementById('gasto-real');
    const userId = localStorage.getItem('userId');

    const nombre = nombreInput ? nombreInput.value.trim() : '';
    const valor = realInput ? parseFloat(realInput.value) : 0;

    if (!nombre || isNaN(valor) || valor <= 0) {
        alert("Por favor ingresa un nombre y un valor válido.");
        return;
    }

    const nuevoGasto = { userId, item: nombre, real: valor, estimated: valor, status: 'pending' };

    try {
        const res = await fetch(`${API_URL}/budget`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoGasto)
        });

        if (res.ok) {
            const creadoBD = await res.json();
            budgetItems.push(creadoBD);
        } else {
            nuevoGasto.id = Date.now();
            budgetItems.push(nuevoGasto);
        }
    } catch (e) {
        nuevoGasto.id = Date.now();
        budgetItems.push(nuevoGasto);
    }

    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
    if (nombreInput) nombreInput.value = '';
    if (realInput) realInput.value = '';

    if (typeof toggleFormGasto === 'function') toggleFormGasto();
    renderBudget('all');
    if (typeof showToast === 'function') showToast(`Servicio "${nombre}" guardado permanentemente`);
};

window.filterBudgetTable = function(filter, btnEl) {
    document.querySelectorAll('#modal-budget .filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderBudget(filter);
};

function initBudgetChart() {
    const ctx = document.getElementById('budget-chart');
    if (!ctx) return;

    if (budgetChartInstance) budgetChartInstance.destroy();

    const paidTotal = budgetItems.filter(b => b.status === 'paid').reduce((acc, c) => acc + Number(c.real), 0);
    const pendingTotal = budgetItems.filter(b => b.status === 'pending').reduce((acc, c) => acc + Number(c.real), 0);

    budgetChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pagado', 'Pendiente'],
            datasets: [{
                data: [paidTotal, pendingTotal],
                backgroundColor: ['#43A047', '#FF9800'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/* ==========================================================================
   8. PROVEEDORES (SINCRONIZACIÓN AUTOMÁTICA Y PERSISTENTE CON BD)
   ========================================================================== */

// 1. Cargar proveedores desde BD (o copia local) al iniciar
async function cargarProveedoresBD() {
    const userId = typeof obtenerUserIdValido === 'function' ? obtenerUserIdValido() : (localStorage.getItem('userId') || 'default_user');
    
    // Carga inmediata de localStorage mientras responde la BD
    const localRec = localStorage.getItem('recommendedVendors');
    const localSel = localStorage.getItem('selectedVendors');
    if (localRec) recommendedVendors = JSON.parse(localRec);
    if (localSel) selectedVendors = JSON.parse(localSel);

    try {
        const res = await fetch(`${API_URL}/vendors/${userId}`);
        if (res.ok) {
            const data = await res.json();
            if (data.recommended || data.selected) {
                recommendedVendors = data.recommended || [];
                selectedVendors = data.selected || [];
            } else if (Array.isArray(data)) {
                selectedVendors = data;
            }
            localStorage.setItem('recommendedVendors', JSON.stringify(recommendedVendors));
            localStorage.setItem('selectedVendors', JSON.stringify(selectedVendors));
        }
    } catch (e) {
        console.warn("Sin conexión con BD. Usando respaldo local.");
    }

    // Valores iniciales por defecto si no existen datos previos
    if (recommendedVendors.length === 0 && selectedVendors.length === 0) {
        recommendedVendors = [
            { 
                id: 101, 
                name: "Lumina Studio (Foto & Video)", 
                category: "Fotografía", 
                rating: "5.0 ★",
                instagram: "https://instagram.com",
                tiktok: "https://tiktok.com",
                website: "https://google.com"
            },
            { 
                id: 102, 
                name: "Florería Rosas & Miel", 
                category: "Decoración", 
                rating: "4.9 ★",
                instagram: "https://instagram.com",
                tiktok: "https://tiktok.com",
                website: "https://google.com"
            }
        ];
        selectedVendors = [
            { 
                id: 201, 
                name: "Palacio Eventos Guayaquil", 
                category: "Salón de Eventos", 
                phone: "+593990001122",
                status: "Contratado"
            }
        ];
        localStorage.setItem('recommendedVendors', JSON.stringify(recommendedVendors));
        localStorage.setItem('selectedVendors', JSON.stringify(selectedVendors));
    }

    renderVendorLists();
}

// 2. Función Helper Centralizada para guardar cambios en BD
async function guardarProveedoresBD() {
    // 1. Guardar siempre en localStorage
    localStorage.setItem('recommendedVendors', JSON.stringify(recommendedVendors));
    localStorage.setItem('selectedVendors', JSON.stringify(selectedVendors));

    // 2. Enviar a la Base de Datos en Render
    const userId = typeof obtenerUserIdValido === 'function' ? obtenerUserIdValido() : (localStorage.getItem('userId') || 'default_user');
    
    try {
        await fetch(`${API_URL}/vendors/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                recommended: recommendedVendors,
                selected: selectedVendors
            })
        });
    } catch (e) {
        console.warn("No se pudo sincronizar con la BD. Guardado en almacenamiento local.");
    }
}

// 3. Renderizar listas de proveedores
function renderVendorLists(filterCat = 'all') {
    const recContainer = document.getElementById('recommended-vendors-list');
    const selContainer = document.getElementById('selected-vendors-list');

    // Proveedores Recomendados
    if (recContainer) {
        const filtrados = recommendedVendors.filter(v => filterCat === 'all' || v.category.toLowerCase().includes(filterCat.toLowerCase()));

        if (filtrados.length === 0) {
            recContainer.innerHTML = `<p class="text-muted text-center p-20">No hay recomendaciones en esta categoría.</p>`;
        } else {
            recContainer.innerHTML = filtrados.map(v => `
                <div class="vendor-item flex-between-center" style="gap: 12px; padding: 12px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1; cursor: pointer;" onclick="verEstadisticasProveedor(${v.id})">
                        <strong class="vendor-name-link" style="color: #d81b60; font-size: 0.95rem;">${v.name}</strong>
                        <p class="text-muted text-small mb-0" style="margin: 0; font-size: 0.8rem; color: #666;">${v.category} • ${v.rating || '5.0 ★'}</p>
                    </div>
                    <button type="button" class="btn btn-sm btn-primary" style="background: #d81b60; color: #fff; border: none; padding: 6px 14px; border-radius: 20px; font-weight: bold; cursor: pointer;" onclick="seleccionarRecomendado(${v.id})">
                        Seleccionar
                    </button>
                </div>
            `).join('');
        }
    }

    // Mis Proveedores Seleccionados
    /* ==========================================================================
   REEMPLAZO EN renderVendorLists() - VISTA DE SOLO LECTURA PARA LA NOVIA
   ========================================================================== */

// Mis Proveedores Seleccionados (Lectura de Estado)
if (selContainer) {
    if (selectedVendors.length === 0) {
        selContainer.innerHTML = `<p class="text-muted text-center p-20">Aún no has contratado ni seleccionado proveedores.</p>`;
    } else {
        selContainer.innerHTML = selectedVendors.map(v => {
            const statusStr = v.status || 'Pendiente';
            let statusBadge = '';

            // Definición de insignias de solo lectura
            if (statusStr === 'Contratado') {
                statusBadge = `<span class="status-badge status-contratado">✅ Contratado</span>`;
            } else if (statusStr === 'En Revisión') {
                statusBadge = `<span class="status-badge status-en-revision">🔍 En Revisión por Andrea</span>`;
            } else {
                statusBadge = `<span class="status-badge status-pendiente">⏳ Pendiente</span>`;
            }

            return `
                <div class="vendor-item flex-between-center" style="gap: 10px; padding: 12px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <strong class="vendor-name-link" style="cursor: pointer; color: #d81b60;" onclick="verEstadisticasProveedor(${v.id})">${v.name}</strong>
                        <p class="text-muted text-small mb-10" style="margin-bottom: 6px; font-size: 0.8rem; color: #666;">${v.category || 'Servicio'}</p>
                        <div class="flex-center-gap" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                            ${statusBadge}
                            <button type="button" class="btn btn-ghost text-xs" style="padding: 4px 8px; background: transparent; border: none; cursor: pointer;" onclick="verContratoProveedor(${v.id})">
                                <i class="fas fa-file-pdf" style="color: #d81b60;"></i> Contrato
                            </button>
                        </div>
                    </div>
                    <button type="button" class="btn-action-delete" style="background: transparent; border: none; color: #e53935; cursor: pointer; padding: 6px;" title="Eliminar" onclick="prepararEliminarProveedor(${v.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                `;
            }).join('');
        }
    }
}

// 4. Mover de Recomendados a Mis Proveedores y Guardar en BD
window.seleccionarRecomendado = async function(id) {
    const recIndex = recommendedVendors.findIndex(v => v.id === id);
    if (recIndex !== -1) {
        const [vendor] = recommendedVendors.splice(recIndex, 1);
        vendor.status = 'Pendiente';
        selectedVendors.push(vendor);
        
        renderVendorLists();
        if (typeof showToast === 'function') showToast(`Se agregó "${vendor.name}" a Mis Proveedores`);

        await guardarProveedoresBD();
    }
};

// 5. Cambiar Estado de Trámite y Guardar en BD
window.cambiarEstadoProveedorBD = async function(vendorId, nuevoEstado) {
    const vendor = selectedVendors.find(v => v.id === vendorId);
    if (vendor) {
        vendor.status = nuevoEstado;
        renderVendorLists();
        if (typeof showToast === 'function') showToast(`Estado de "${vendor.name}" actualizado a ${nuevoEstado}`);

        await guardarProveedoresBD();
    }
};

// 6. Agregar Proveedor Manualmente desde el Modal de Registro
window.addNewVendorBD = async function() {
    const nameInput = document.getElementById('new-vendor-name');
    const categoryInput = document.getElementById('new-vendor-category');
    const statusInput = document.getElementById('new-vendor-status');
    const phoneInput = document.getElementById('new-vendor-phone');

    const name = nameInput ? nameInput.value.trim() : '';
    const category = categoryInput ? categoryInput.value : 'Otro';
    const status = statusInput ? statusInput.value : 'Pendiente';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!name) {
        alert("Por favor ingresa el nombre del proveedor.");
        return;
    }

    const newVendor = {
        id: Date.now(),
        name,
        category,
        status,
        phone,
        rating: "5.0 ★"
    };

    selectedVendors.push(newVendor);

    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (typeof closeAllModals === 'function') closeAllModals();

    renderVendorLists();
    if (typeof showToast === 'function') showToast(`Proveedor "${name}" registrado correctamente`);

    await guardarProveedoresBD();
};

// 7. Modal de Detalles / Marketplace
window.verEstadisticasProveedor = function(vendorId) {
    const vendor = [...recommendedVendors, ...selectedVendors].find(v => v.id === vendorId) || 
                   { id: vendorId, name: "Proveedor", category: "Servicio", rating: "5.0 ★" };

    const modalTitle = document.getElementById('title-vendor-details');
    const container = document.getElementById('vendor-detail-content');

    if (modalTitle) modalTitle.textContent = vendor.name;

    const instagram = vendor.instagram || "https://instagram.com";
    const tiktok = vendor.tiktok || "https://tiktok.com";
    const website = vendor.website || "https://google.com";

    if (container) {
        container.innerHTML = `
            <div class="vendor-stats-card p-20 border-rounded bg-light mb-20 text-center" style="background: #fafafa; border-radius: 14px; padding: 15px; border: 1px solid #eee; text-align: center; margin-bottom: 15px;">
                <span class="badge-verified" style="background: #e8f5e9; color: #2e7d32; padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;"><i class="fas fa-check-circle"></i> Proveedor Verificado</span>
                <h4 class="text-pink font-bold mt-5" style="color: #d81b60; margin-top: 5px;">${(vendor.category || 'Servicio').toUpperCase()}</h4>
                <div class="rating-stars my-10" style="font-size: 1.3rem; color: #FFC107; margin: 10px 0;">
                    <i class="fas fa-star"></i>
                    <i class="fas fa-star"></i>
                    <i class="fas fa-star"></i>
                    <i class="fas fa-star"></i>
                    <i class="fas fa-star-half-alt"></i>
                    <span class="text-dark font-bold text-small" style="color: #333; font-size: 0.9rem;">(${vendor.rating || '5.0 ★'})</span>
                </div>

                <div class="vendor-social-links flex-center-gap mt-15" style="display: flex; justify-content: center; gap: 10px; margin-top: 12px;">
                    <a href="${instagram}" target="_blank" class="social-btn instagram" style="background: #e1306c; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; text-decoration: none; font-weight: bold;"><i class="fab fa-instagram"></i> Instagram</a>
                    <a href="${tiktok}" target="_blank" class="social-btn tiktok" style="background: #000; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; text-decoration: none; font-weight: bold;"><i class="fab fa-tiktok"></i> TikTok</a>
                    <a href="${website}" target="_blank" class="social-btn web" style="background: #4a148c; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; text-decoration: none; font-weight: bold;"><i class="fas fa-globe"></i> Portafolio</a>
                </div>
            </div>

            <h5 class="modern-label mb-10" style="font-weight: bold; font-size: 0.9rem; margin-bottom: 8px;">
                <i class="fas fa-award text-pink" style="color: #d81b60;"></i> Destaca en (Reconocimientos):
            </h5>
            <div class="vendor-badges-grid mb-20" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;">
                <div class="skill-badge-item" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #fff; border: 1px solid #eee; border-radius: 8px;">
                    <div class="badge-icon" style="color: #FFC107;"><i class="fas fa-bolt"></i></div>
                    <div class="badge-info">
                        <strong style="font-size: 0.85rem; display: block;">Respuesta Rápida</strong>
                        <p style="margin: 0; font-size: 0.75rem; color: #666;">Responde en menos de 1 hora</p>
                    </div>
                </div>
                <div class="skill-badge-item" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #fff; border: 1px solid #eee; border-radius: 8px;">
                    <div class="badge-icon" style="color: #4CAF50;"><i class="fas fa-clock"></i></div>
                    <div class="badge-info">
                        <strong style="font-size: 0.85rem; display: block;">100% Puntual</strong>
                        <p style="margin: 0; font-size: 0.75rem; color: #666;">Excelente cumplimiento de horarios</p>
                    </div>
                </div>
            </div>

            <div class="modal-action-footer flex-center-gap mt-20" style="display: flex; gap: 10px; margin-top: 20px;">
                <button type="button" class="btn btn-ghost" style="flex: 1;" onclick="closeAllModals()">Cerrar</button>
                <button type="button" class="btn btn-primary" style="flex: 2; background: #d81b60; color: #fff; border: none; padding: 10px; border-radius: 20px; font-weight: bold; cursor: pointer;" onclick="seleccionarProveedorDesdeModal(${vendor.id})">
                    <i class="fas fa-check"></i> Seleccionar Proveedor
                </button>
            </div>
        `;
    }

    if (typeof openModal === 'function') openModal('modal-vendor-details');
};

// Aliases para llamadas antiguas
window.openVendorDetails = window.verEstadisticasProveedor;
window.verDetallesProveedor = window.verEstadisticasProveedor;

/* ==========================================================================
   VISOR Y DESCARGA DE CONTRATOS PDF
   ========================================================================== */

/* ==========================================================================
   VISOR Y DESCARGA DE CONTRATOS PDF (CON SOLUCIÓN DE SEGURIDAD X-FRAME)
   ========================================================================== */

window.verContratoProveedor = function(vendorId) {
    const vendor = selectedVendors.find(v => v.id === vendorId);
    const title = document.getElementById('title-modal-pdf');
    const container = document.getElementById('pdf-container');
    const downloadBtn = document.getElementById('btn-download-pdf');

    if (title && vendor) {
        title.textContent = `Contrato: ${vendor.name}`;
    }

    const contractUrl = vendor?.contractUrl;

    if (container) {
        if (contractUrl) {
            // Usamos Google Docs Viewer para evitar bloqueos de X-Frame-Options de servidores externos
            const embedUrl = `https://docs.google.com/gview?url=${encodeURIComponent(contractUrl)}&embedded=true`;
            container.innerHTML = `<iframe src="${embedUrl}" style="width: 100%; height: 100%; border: none;"></iframe>`;
            
            if (downloadBtn) {
                downloadBtn.style.display = 'inline-flex';
                downloadBtn.href = contractUrl;
                downloadBtn.setAttribute('download', `Contrato_${vendor.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
            }
        } else {
            // Vista limpia y elegante cuando Andrea aún no adjunta el documento
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 20px;">
                    <i class="fas fa-file-pdf" style="font-size: 3.8rem; color: #d81b60; margin-bottom: 15px;"></i>
                    <h4 style="margin: 0 0 8px 0; color: #333; font-weight: bold;">Documento en Proceso de Verificación</h4>
                    <p style="font-size: 0.88rem; max-width: 380px; margin: 0; color: #666; line-height: 1.4;">
                        Se adjuntará el PDF oficial firmado una vez finalizado el contrato con el proveedor.
                    </p>
                </div>
            `;
            if (downloadBtn) {
                downloadBtn.style.display = 'none'; // Ocultar botón de descarga si no hay archivo activo
            }
        }
    }

    if (typeof openModal === 'function') {
        openModal('modal-pdf');
    }
};

// 8. Eliminar Proveedor y Guardar en BD
window.prepararEliminarProveedor = (id) => {
    vendorToDeleteId = id;
    if (typeof openModal === 'function') openModal('modal-confirm-delete');
};

window.ejecutarEliminacion = async () => {
    if (vendorToDeleteId) {
        const item = selectedVendors.find(v => v.id === vendorToDeleteId);
        selectedVendors = selectedVendors.filter(v => v.id !== vendorToDeleteId);
        if (item) {
            recommendedVendors.push(item);
        }
        renderVendorLists();
        if (typeof showToast === 'function') showToast('Proveedor eliminado');

        await guardarProveedoresBD();
    }
    if (typeof cerrarModalEliminar === 'function') {
        cerrarModalEliminar();
    } else if (typeof closeAllModals === 'function') {
        closeAllModals();
    }
};

/* ==========================================================================
   9. ASISTENTE VIRTUAL (CHATBOT)
   ========================================================================== */
function initChatbot() {
    const toggler = document.getElementById('chatbot-toggler-btn');
    const closeBtn = document.getElementById('close-chat-btn');
    const sendBtn = document.getElementById('send-btn');
    const input = document.getElementById('chatbot-input');
    const messages = document.getElementById('chatbot-messages');

    if (toggler) toggler.addEventListener('click', () => document.body.classList.toggle('show-chatbot'));
    if (closeBtn) closeBtn.addEventListener('click', () => document.body.classList.remove('show-chatbot'));

    const sendMessage = () => {
        const text = input ? input.value.trim() : '';
        if (!text || !messages) return;

        // Mensaje Enviado
        const outgoing = document.createElement('li');
        outgoing.className = 'chat outgoing';
        outgoing.innerHTML = `<p>${text}</p>`;
        messages.appendChild(outgoing);
        input.value = '';

        // Respuesta Automática simulada
        setTimeout(() => {
            const incoming = document.createElement('li');
            incoming.className = 'chat incoming';
            incoming.innerHTML = `
                <span class="material-symbols-outlined">smart_toy</span>
                <p>¡Claro! Con gusto te ayudo a organizar tus pendientes de boda. ✨</p>
            `;
            messages.appendChild(incoming);
            messages.scrollTop = messages.scrollHeight;
        }, 600);
    };

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
}

/* ==========================================================================
   10. ALERTAS Y CUENTA REGRESIVA
   ========================================================================== */
async function verificarAlertasSilenciosas() {
    const box = document.getElementById('alert-box');
    const userId = obtenerUserIdValido();
    if (!box || !userId) return;

    try {
        const res = await fetch(`${API_URL}/alerts/${userId}`);
        if (res.ok) {
            const data = await res.json();
            if (data.alerts && data.alerts.length > 0) {
                box.classList.remove('hidden');
                box.innerHTML = data.alerts.map(a => `
                    <div class="alert-item ${a.level}">
                        <strong>${a.title}</strong>: ${a.msg}
                    </div>
                `).join('');
            }
        }
    } catch (e) {
        console.log("Sistema de alertas en modo offline.");
    }
}

function iniciarCuentaRegresiva() {
    const weddingDateStr = localStorage.getItem('weddingDate');
    const wrapper = document.getElementById('countdown-wrapper');
    if (!weddingDateStr || !wrapper) return;

    wrapper.classList.remove('hidden');
    const targetDate = new Date(weddingDateStr).getTime();

    setInterval(() => {
        const now = new Date().getTime();
        const diff = targetDate - now;

        if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (document.getElementById('c-days')) document.getElementById('c-days').textContent = String(days).padStart(2, '0');
            if (document.getElementById('c-hours')) document.getElementById('c-hours').textContent = String(hours).padStart(2, '0');
            if (document.getElementById('c-minutes')) document.getElementById('c-minutes').textContent = String(minutes).padStart(2, '0');
            if (document.getElementById('c-seconds')) document.getElementById('c-seconds').textContent = String(seconds).padStart(2, '0');
        }
    }, 1000);
}

/* ==========================================================================
   SISTEMA DE NOTIFICACIONES SINCRONIZADO CON LA BASE DE DATOS (RENDER)
   ========================================================================== */

/* ==========================================================================
   SISTEMA DE NOTIFICACIONES CORREGIDO (APLICA ID DE TU HTML Y PERSISTENCIA)
   ========================================================================== */

let notificationsList = [];

// 1. Cargar notificaciones desde BD o copia local
async function cargarNotificacionesBD() {
    const userId = typeof obtenerUserIdValido === 'function' ? obtenerUserIdValido() : (localStorage.getItem('userId') || 'default_user');

    // Revisar primero copia guardada en localStorage
    const savedLocal = localStorage.getItem('notificationsList');
    if (savedLocal) {
        try { notificationsList = JSON.parse(savedLocal); } catch(e){}
    }

    // Intentar consultar BD en Render
    try {
        const res = await fetch(`${API_URL}/notifications?userId=${userId}`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                notificationsList = data;
            }
        }
    } catch (e) {
        console.warn("Usando respaldo local de notificaciones.");
    }

    // Si está vacío por ser la primera vez
    if (!notificationsList || notificationsList.length === 0) {
        notificationsList = [
            { id: 1, title: "<strong>Andrea</strong> aprobó el proveedor Catering Gourmet.", time: "Hace 10 min", type: "success", read: false },
            { id: 2, title: "Recuerda revisar el contrato de Fotografía.", time: "Hace 1 hora", type: "warning", read: false }
        ];
    }

    localStorage.setItem('notificationsList', JSON.stringify(notificationsList));
    renderNotifications();
}

// 2. Dibujar notificaciones en el <ul> con id "notifications-list"
function renderNotifications() {
    const listContainer = document.getElementById('notifications-list');
    const badge = document.getElementById('unread-notifications-badge');

    // Contar cuántas no están leídas
    const unreadCount = notificationsList.filter(n => !n.read).length;

    // Actualizar o Biswas el badge numérico
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'inline-block';
            badge.classList.remove('hidden');
        } else {
            badge.textContent = '0';
            badge.style.display = 'none';
            badge.classList.add('hidden');
        }
    }

    if (!listContainer) return;

    if (notificationsList.length === 0) {
        listContainer.innerHTML = `<li class="notification-item text-center p-15 text-muted text-xs">No tienes notificaciones.</li>`;
        return;
    }

    listContainer.innerHTML = notificationsList.map(item => {
        const isWarning = item.type === 'warning';
        const iconClass = isWarning ? 'fa-exclamation-triangle text-orange' : 'fa-check-circle text-green';
        const unreadClass = item.read ? '' : 'unread';

        return `
            <li class="notification-item ${unreadClass}">
                <i class="fas ${iconClass}" aria-hidden="true"></i>
                <div>
                    <p class="mb-0 text-small">${item.title}</p>
                    <span class="text-xs text-muted">${item.time || 'Reciente'}</span>
                </div>
            </li>
        `;
    }).join('');
}

// 3. Abrir / Cerrar el menú desplegable
window.toggleNotificationsMenu = function(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('notifications-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
};

// 4. Marcar TODAS como leídas
window.marcarTodasLeidas = async function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation(); // Detener propagación para no abrir/cerrar el menú
    }

    // A. Actualizar en memoria y guardar en localStorage inmediatamente
    notificationsList = notificationsList.map(n => ({ ...n, read: true }));
    localStorage.setItem('notificationsList', JSON.stringify(notificationsList));
    
    // B. Re-renderizar UI
    renderNotifications();

    if (typeof showToast === 'function') {
        showToast('Notificaciones marcadas como leídas');
    }

    // C. Petición a la BD en Render
    const userId = typeof obtenerUserIdValido === 'function' ? obtenerUserIdValido() : (localStorage.getItem('userId') || 'default_user');
    try {
        await fetch(`${API_URL}/notifications/mark-read`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
    } catch (err) {
        console.warn("Actualizado localmente. Pendiente sincronizar con BD.");
    }
};

// 5. Cerrar el menú desplegable si se hace clic fuera de él
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notifications-dropdown');
    const bellWrapper = document.querySelector('.notification-bell-wrapper');
    
    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (bellWrapper && !bellWrapper.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    }
});

// 2. Filtro de Recomendaciones por Categoría
window.filtrarRecomendados = function(categoria, btn) {
    document.querySelectorAll('#heading-prov-rec + .pastel-filters-container .filter-pill').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (typeof renderVendorLists === 'function') {
        renderVendorLists(categoria);
    }
};

// 3. Selección directa de Proveedor desde el Modal
window.seleccionarProveedorDesdeModal = function(vendorId) {
    if (typeof seleccionarRecomendado === 'function') {
        seleccionarRecomendado(vendorId);
    }
    if (typeof closeAllModals === 'function') {
        closeAllModals();
    }
};

// 4. Momentos & Canciones Clave (Sincronizado con BD)
function cargarCancionesGuardadas() {
    const ent = localStorage.getItem('songEntrance') || 'Por definir';
    const dance = localStorage.getItem('songDance') || 'Por definir';
    const cake = localStorage.getItem('songCake') || 'Por definir';

    if (document.getElementById('song-entrance-display')) document.getElementById('song-entrance-display').textContent = ent;
    if (document.getElementById('song-dance-display')) document.getElementById('song-dance-display').textContent = dance;
    if (document.getElementById('song-cake-display')) document.getElementById('song-cake-display').textContent = cake;
}

window.guardarCanciones = async function() {
    const ent = document.getElementById('input-song-entrance')?.value || 'Por definir';
    const dance = document.getElementById('input-song-dance')?.value || 'Por definir';
    const cake = document.getElementById('input-song-cake')?.value || 'Por definir';
    const userId = localStorage.getItem('userId');

    // 1. Guardar localmente
    localStorage.setItem('songEntrance', ent);
    localStorage.setItem('songDance', dance);
    localStorage.setItem('songCake', cake);

    cargarCancionesGuardadas();
    if (typeof closeAllModals === 'function') closeAllModals();

    // 2. Enviar a la Base de Datos en Render para que Andrea las vea
    try {
        await fetch(`${API_URL}/canciones-boda`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, entrada: ent, primerBaile: dance, pastel: cake })
        });
        showToast('Canciones sincronizadas con tu Wedding Planner');
    } catch (error) {
        showToast('Guardado en el navegador (Sin conexión a BD)', 'warning');
    }
};

// 5. Notas Rápidas (Sincronizado con BD)
function cargarNotasRapidas() {
    const input = document.getElementById('quick-notes-input');
    if (input) input.value = localStorage.getItem('quickNotesBride') || '';
}

window.guardarNotasRapidas = async function(val) {
    const userId = localStorage.getItem('userId');
    localStorage.setItem('quickNotesBride', val);

    try {
        await fetch(`${API_URL}/notas-novia`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, nota: val })
        });
        showToast('Notas sincronizadas con la BD');
    } catch (error) {
        showToast('Nota guardada localmente');
    }
};

// 6. Imprimir / Exportar Resumen
window.exportarResumenBoda = function() {
    window.print();
};

// Inicializador
document.addEventListener('DOMContentLoaded', () => {
    cargarCancionesGuardadas();
    cargarNotasRapidas();
});

/* Logout */
window.logout = function() {
    localStorage.removeItem('userId');
    localStorage.removeItem('usuarioLogueado');
    window.location.href = 'index.html';
};

/* ==========================================================================
   GESTIÓN DINÁMICA DE PRESUPUESTO (AGREGAR, EDITAR, ELIMINAR)
   ========================================================================== */

// 1. Alternar visibilidad del formulario para agregar gasto
window.toggleFormGasto = function() {
    const form = document.getElementById('form-nuevo-gasto');
    if (form) form.classList.toggle('hidden');
};

// 2. Renderizar Tabla de Presupuesto con formato, botón Eliminar y alternador de estado
function renderBudget(filter = 'all') {
    const tbody = document.getElementById('budget-table-body');
    const budgetTotalDisplay = document.getElementById('budget-total');
    const budgetLimitDisplay = document.getElementById('budget-limit-display');
    const modalBudgetTotal = document.getElementById('modal-budget-total');
    const budgetBarFill = document.getElementById('budget-bar-fill');

    const presupuestoAsignado = Math.max(0, parseFloat(localStorage.getItem('weddingBudget')) || 0);
    const totalGastado = budgetItems.reduce((acc, curr) => acc + Number(curr.real || 0), 0);

    // Formatear números con comas (Ej: $6,900)
    const gastadoFmt = totalGastado.toLocaleString('es-EC');
    const asignadoFmt = presupuestoAsignado.toLocaleString('es-EC');

    if (budgetTotalDisplay) budgetTotalDisplay.textContent = gastadoFmt;
    if (budgetLimitDisplay) budgetLimitDisplay.textContent = `/ $${asignadoFmt}`;

    if (modalBudgetTotal) {
        modalBudgetTotal.textContent = `$${gastadoFmt} de $${asignadoFmt}`;
        // Alerta visual en rojo si supera el presupuesto asignado
        if (totalGastado > presupuestoAsignado && presupuestoAsignado > 0) {
            modalBudgetTotal.style.color = "#E53935";
            modalBudgetTotal.style.fontWeight = "800";
        } else {
            modalBudgetTotal.style.color = "#FB8C00";
        }
    }

    if (budgetBarFill) {
        let porcentaje = presupuestoAsignado > 0 ? Math.min(100, Math.round((totalGastado / presupuestoAsignado) * 100)) : 0;
        budgetBarFill.style.width = `${porcentaje}%`;
        budgetBarFill.style.background = (totalGastado > presupuestoAsignado && presupuestoAsignado > 0)
            ? 'linear-gradient(90deg, #E53935, #C62828)'
            : 'linear-gradient(90deg, #FFB74D, #FB8C00)';
    }

    if (!tbody) return;

    const filtrados = budgetItems.filter(b => filter === 'all' || b.status === filter);

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted p-20">
                    No hay servicios registrados en esta categoría.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtrados.map((item, index) => {
        const isPaid = item.status === 'paid';
        const badgeClass = isPaid ? 'status-badge paid' : 'status-badge pending';
        const badgeText = isPaid ? 'Pagado' : 'Pendiente';

        return `
            <tr>
                <td><strong>${item.item}</strong></td>
                <td>$${Number(item.real).toLocaleString('es-EC')}</td>
                <td>$${Number(item.estimated || item.real).toLocaleString('es-EC')}</td>
                <td>
                    <span class="${badgeClass}" style="cursor: pointer;" title="Clic para cambiar estado" onclick="toggleEstadoGasto(${index})">
                        ${badgeText}
                    </span>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn-action-delete" title="Quitar servicio" onclick="eliminarGasto(${index})">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 3. Eliminar un servicio/gasto de la lista
window.eliminarGasto = async function(index) {
    const itemEliminado = budgetItems[index];
    budgetItems.splice(index, 1);
    
    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
    renderBudget('all');
    if (typeof showToast === 'function') showToast(`Se eliminó "${itemEliminado.item}"`);

    // Sincronización opcional con Backend en Render
    try {
        await fetch(`${API_URL}/budget/${itemEliminado.id}`, { method: 'DELETE' });
    } catch (e) {
        console.warn("Sincronizado localmente.");
    }
};

// 4. Cambiar de Pagado a Pendiente y viceversa
window.toggleEstadoGasto = function(index) {
    budgetItems[index].status = budgetItems[index].status === 'paid' ? 'pending' : 'paid';
    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
    renderBudget('all');
};

// 5. Guardar nuevo servicio ingresado manualmente
window.guardarNuevoGastoBD = async function() {
    const nombreInput = document.getElementById('gasto-nombre');
    const realInput = document.getElementById('gasto-real');

    const nombre = nombreInput ? nombreInput.value.trim() : '';
    const valor = realInput ? parseFloat(realInput.value) : 0;

    if (!nombre || isNaN(valor) || valor <= 0) {
        alert("Por favor ingresa un nombre y un valor válido.");
        return;
    }

    const nuevoGasto = {
        id: Date.now(),
        item: nombre,
        real: valor,
        estimated: valor,
        status: 'pending'
    };

    budgetItems.push(nuevoGasto);
    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));

    nombreInput.value = '';
    realInput.value = '';
    toggleFormGasto();
    renderBudget('all');

    if (typeof showToast === 'function') showToast(`Servicio "${nombre}" agregado al presupuesto`);
};

/* ==========================================================================
   PERSISTENCIA TOTAL CON BASE DE DATOS (PRESUPUESTO)
   ========================================================================== */

// 1. Cargar datos desde la BD al iniciar la página
async function cargarPresupuestoDesdeBD() {
    const userId = localStorage.getItem('userId');
    try {
        const res = await fetch(`${API_URL}/budget?userId=${userId}`);
        if (res.ok) {
            budgetItems = await res.json();
            localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
        } else {
            budgetItems = JSON.parse(localStorage.getItem('budgetItems')) || [];
        }
    } catch (e) {
        console.warn("Sin conexión con BD. Cargando datos locales.");
        budgetItems = JSON.parse(localStorage.getItem('budgetItems')) || [];
    }
    renderBudget('all');
}

// 2. Renderizar la tabla y el acumulado
function renderBudget(filter = 'all') {
    const tbody = document.getElementById('budget-table-body');
    const budgetTotalDisplay = document.getElementById('budget-total');
    const budgetLimitDisplay = document.getElementById('budget-limit-display');
    const modalBudgetTotal = document.getElementById('modal-budget-total');
    const budgetBarFill = document.getElementById('budget-bar-fill');

    const presupuestoAsignado = Math.max(0, parseFloat(localStorage.getItem('weddingBudget')) || 0);
    const totalGastado = budgetItems.reduce((acc, curr) => acc + Number(curr.real || 0), 0);

    const gastadoFmt = totalGastado.toLocaleString('es-EC');
    const asignadoFmt = presupuestoAsignado.toLocaleString('es-EC');

    if (budgetTotalDisplay) budgetTotalDisplay.textContent = gastadoFmt;
    if (budgetLimitDisplay) budgetLimitDisplay.textContent = `/ $${asignadoFmt}`;

    if (modalBudgetTotal) {
        modalBudgetTotal.textContent = `$${gastadoFmt} de $${asignadoFmt}`;
        if (totalGastado > presupuestoAsignado && presupuestoAsignado > 0) {
            modalBudgetTotal.style.color = "#E53935";
            modalBudgetTotal.style.fontWeight = "800";
        } else {
            modalBudgetTotal.style.color = "#FB8C00";
        }
    }

    if (budgetBarFill) {
        let porcentaje = presupuestoAsignado > 0 ? Math.min(100, Math.round((totalGastado / presupuestoAsignado) * 100)) : 0;
        budgetBarFill.style.width = `${porcentaje}%`;
        budgetBarFill.style.background = (totalGastado > presupuestoAsignado && presupuestoAsignado > 0)
            ? 'linear-gradient(90deg, #E53935, #C62828)'
            : 'linear-gradient(90deg, #FFB74D, #FB8C00)';
    }

    if (!tbody) return;

    const filtrados = budgetItems.filter(b => filter === 'all' || b.status === filter);

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted p-20">
                    No hay servicios registrados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtrados.map((item, index) => {
        const isPaid = item.status === 'paid';
        const badgeClass = isPaid ? 'status-badge paid' : 'status-badge pending';
        const badgeText = isPaid ? 'Pagado' : 'Pendiente';

        return `
            <tr>
                <td><strong>${item.item}</strong></td>
                <td>$${Number(item.real).toLocaleString('es-EC')}</td>
                <td>$${Number(item.estimated || item.real).toLocaleString('es-EC')}</td>
                <td>
                    <span class="${badgeClass}" style="cursor: pointer;" onclick="toggleEstadoGasto(${index})">
                        ${badgeText}
                    </span>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn-action-delete" title="Quitar servicio" onclick="eliminarGasto(${index})">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 3. Eliminar físicamente de la Base de Datos (DELETE)
window.eliminarGasto = async function(index) {
    const itemEliminado = budgetItems[index];
    if (!itemEliminado) return;

    // Actualización visual inmediata
    budgetItems.splice(index, 1);
    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
    renderBudget('all');

    showToast(`Se eliminó "${itemEliminado.item}"`);

    // Sincronización DELETE con backend
    try {
        await fetch(`${API_URL}/budget/${itemEliminado.id}`, {
            method: 'DELETE'
        });
    } catch (e) {
        console.error("Error al eliminar en BD:", e);
    }
};

// 4. Actualizar estado en la Base de Datos (PUT)
window.toggleEstadoGasto = async function(index) {
    const item = budgetItems[index];
    if (!item) return;

    const nuevoEstado = item.status === 'paid' ? 'pending' : 'paid';
    item.status = nuevoEstado;

    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
    renderBudget('all');

    // Sincronización PUT con backend
    try {
        await fetch(`${API_URL}/budget/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nuevoEstado })
        });
    } catch (e) {
        console.error("Error al actualizar estado en BD:", e);
    }
};

// 5. Agregar nuevo gasto a la Base de Datos (POST)
window.guardarNuevoGastoBD = async function() {
    const nombreInput = document.getElementById('gasto-nombre');
    const realInput = document.getElementById('gasto-real');
    const userId = localStorage.getItem('userId');

    const nombre = nombreInput ? nombreInput.value.trim() : '';
    const valor = realInput ? parseFloat(realInput.value) : 0;

    if (!nombre || isNaN(valor) || valor <= 0) {
        alert("Por favor ingresa un nombre y un valor válido.");
        return;
    }

    const nuevoGasto = {
        userId,
        item: nombre,
        real: valor,
        estimated: valor,
        status: 'pending'
    };

    // Sincronización POST con backend
    try {
        const res = await fetch(`${API_URL}/budget`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoGasto)
        });

        if (res.ok) {
            const gastoCreadoBD = await res.json();
            budgetItems.push(gastoCreadoBD);
        } else {
            nuevoGasto.id = Date.now();
            budgetItems.push(nuevoGasto);
        }
    } catch (e) {
        nuevoGasto.id = Date.now();
        budgetItems.push(nuevoGasto);
    }

    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
    
    if (nombreInput) nombreInput.value = '';
    if (realInput) realInput.value = '';
    
    toggleFormGasto();
    renderBudget('all');
    showToast(`Servicio "${nombre}" guardado permanentemente`);
};

// Asegurar la llamada al inicializar la página
document.addEventListener('DOMContentLoaded', () => {
    cargarPresupuestoDesdeBD();
});