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
function renderBudget(filter = 'all') {
    const tbody = document.getElementById('budget-table-body');
    const budgetTotalDisplay = document.getElementById('budget-total');
    const budgetLimitDisplay = document.getElementById('budget-limit-display');
    const modalBudgetTotal = document.getElementById('modal-budget-total');
    const budgetBarFill = document.getElementById('budget-bar-fill');

    // 1. Obtener el Presupuesto Total guardado por la novia en el Perfil
    const presupuestoAsignado = parseFloat(localStorage.getItem('weddingBudget')) || 0;

    // 2. Calcular la suma total de gastos reales en la lista
    const totalGastado = budgetItems.reduce((acc, curr) => acc + Number(curr.real || 0), 0);

    // 3. Actualizar los valores en la tarjeta y en el modal
    if (budgetTotalDisplay) {
        budgetTotalDisplay.textContent = totalGastado.toLocaleString();
    }
    
    if (budgetLimitDisplay) {
        budgetLimitDisplay.textContent = `/ $${presupuestoAsignado.toLocaleString()}`;
    }

    if (modalBudgetTotal) {
        modalBudgetTotal.textContent = `$${totalGastado.toLocaleString()} de $${presupuestoAsignado.toLocaleString()}`;
    }

    // 4. Calcular el porcentaje consumido para la barra de progreso
    if (budgetBarFill) {
        let porcentaje = 0;
        if (presupuestoAsignado > 0) {
            porcentaje = Math.min(100, Math.round((totalGastado / presupuestoAsignado) * 100));
        }
        
        budgetBarFill.style.width = `${porcentaje}%`;

        // Alerta visual en rojo si el gasto total supera el presupuesto asignado
        if (totalGastado > presupuestoAsignado && presupuestoAsignado > 0) {
            budgetBarFill.style.background = 'linear-gradient(90deg, #E53935, #C62828)';
        } else {
            budgetBarFill.style.background = 'linear-gradient(90deg, #FFB74D, #FB8C00)';
        }
    }

    // 5. Renderizar las filas dentro de la tabla del modal
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtrados = budgetItems.filter(b => filter === 'all' || b.status === filter);

    filtrados.forEach(b => {
        const statusBadge = b.status === 'paid' 
            ? '<span class="status-badge paid">Pagado</span>' 
            : '<span class="status-badge pending">Pendiente</span>';
            
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${b.item}</strong></td>
            <td>$${Number(b.real).toLocaleString()}</td>
            <td>$${Number(b.estimated).toLocaleString()}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });

    // Dentro de renderBudget()
    if (totalGastado > presupuestoAsignado && presupuestoAsignado > 0) {
        budgetTotalDisplay.style.color = '#E53935'; // Rojo de alerta
        budgetBarFill.style.background = 'linear-gradient(90deg, #E53935, #C62828)';
    } else {
        budgetTotalDisplay.style.color = '#E65100'; // Naranja original
        budgetBarFill.style.background = 'linear-gradient(90deg, #FFB74D, #FB8C00)';
    }
}

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
   8. PROVEEDORES
   ========================================================================== */
async function cargarProveedoresBD() {
    const userId = obtenerUserIdValido();
    if (userId) {
        try {
            const res = await fetch(`${API_URL}/vendors/${userId}`);
            if (res.ok) {
                const data = await res.json();
                recommendedVendors = data.recommended || [];
                selectedVendors = data.selected || [];
            }
        } catch (e) { console.warn("Error al cargar proveedores."); }
    }

    if (recommendedVendors.length === 0 && selectedVendors.length === 0) {
        recommendedVendors = [
            { id: 101, name: "Lumina Studio (Foto & Video)", category: "Fotografía", rating: "5.0 ★" },
            { id: 102, name: "Florería Rosas & Miel", category: "Decoración", rating: "4.9 ★" }
        ];
        selectedVendors = [
            { id: 201, name: "Palacio Eventos Guayaquil", category: "Salón de Eventos", phone: "+593990001122" }
        ];
    }

    renderVendorLists();
}

function renderVendorLists() {
    const recContainer = document.getElementById('recommended-vendors-list');
    const selContainer = document.getElementById('selected-vendors-list');

    if (recContainer) {
        recContainer.innerHTML = recommendedVendors.map(v => `
            <div class="vendor-item">
                <strong class="vendor-name-link" onclick="openVendorDetails(${v.id})">${v.name}</strong>
                <p class="text-muted text-small">${v.category} - ${v.rating}</p>
            </div>
        `).join('');
    }

    if (selContainer) {
        selContainer.innerHTML = selectedVendors.map(v => `
            <div class="vendor-item flex-between-center">
                <div>
                    <strong class="vendor-name-link" onclick="openVendorDetails(${v.id})">${v.name}</strong>
                    <p class="text-muted text-small">${v.category}</p>
                </div>
                <button class="btn-action-delete" onclick="prepararEliminarProveedor(${v.id})"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
    }
}

window.openVendorDetails = (id) => {
    const vendor = [...recommendedVendors, ...selectedVendors].find(v => v.id === id);
    const content = document.getElementById('vendor-detail-content');
    if (content && vendor) {
        content.innerHTML = `
            <h4>${vendor.name}</h4>
            <p class="text-muted mb-15">${vendor.category}</p>
            <p><strong>Contacto:</strong> ${vendor.phone || 'Disponible bajo previa reserva'}</p>
        `;
    }
    openModal('modal-vendor-details');
};

window.prepararEliminarProveedor = (id) => {
    vendorToDeleteId = id;
    openModal('modal-confirm-delete');
};

window.ejecutarEliminacion = () => {
    if (vendorToDeleteId) {
        selectedVendors = selectedVendors.filter(v => v.id !== vendorToDeleteId);
        renderVendorLists();
    }
    cerrarModalEliminar();
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

/* Logout */
window.logout = function() {
    localStorage.removeItem('userId');
    localStorage.removeItem('usuarioLogueado');
    window.location.href = 'index.html';
};