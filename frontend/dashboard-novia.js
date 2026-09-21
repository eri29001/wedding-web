const API_URL = 'https://wedding-web-lygz.onrender.com/api'; 

let calendarInstance;
let currentRatingContext = ''; 
let currentRatingValues = {}; 
let countdownInterval;
let cropper; 
let tempCroppedImage = ""; 
let chatHistory = [];
let tempFile = null;

let guestsList = [
    { id: 1, name: 'Alán Pérez', group: 'Familia Novio', table: 1, status: 'Confirmado' },
    { id: 2, name: 'Familia Gómez', group: 'Familia Novia', table: 2, status: 'Confirmado' },
    { id: 3, name: 'Juan y Laura', group: 'Amigos', table: 5, status: 'Pendiente' },
    { id: 4, name: 'Tíos Roberto y Ana', group: 'Familia Novia', table: 3, status: 'Confirmado' },
    { id: 5, name: 'Carlos y Sofía', group: 'Trabajo', table: 7, status: 'Pendiente' },
    { id: 6, name: 'Abuela María', group: 'Familia Novia', table: 2, status: 'Confirmado' },
    { id: 7, name: 'Equipo Fútbol', group: 'Amigos Novio', table: 8, status: 'Pendiente' },
    { id: 8, name: 'Primos Lejanos', group: 'Familia Novio', table: 4, status: 'Confirmado' },
    { id: 9, name: 'Jefe Esteban', group: 'Trabajo', table: 7, status: 'Confirmado' },
    { id: 10, name: 'Vecinos Calle 8', group: 'Amigos', table: 9, status: 'Pendiente' }
];

/* 1. INICIALIZACIÓN */
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Aplicación Iniciada. API conectada a:", API_URL);

    // 1. Configuración de Usuario y Base
    closeAllModals(); 
    loadUserName();
    updateNavbarAvatar();
    
    // 2. Componentes Principales
    initDashboardCalendar();
    renderVendorLists(); 
    updateGuestCounters(); 
    initCountdown();
    
    // 3. Lógica de Negocio
    initExcelLogic();
    verificarAlertasSilenciosas(); 
    initChecklistLogic();
    
    // 4. Chatbot
    initChatbot(); 

    // 5. Verificación de Encuestas
    checkSurveyStatus('btn-rate-andrea', 'survey_andrea_sent');
    checkSurveyStatus('btn-rate-vendors', 'survey_vendors_sent');

    // 6. Animaciones Iniciales
    setTimeout(() => { updateProgress(100); }, 1000);

    setupGlobalListeners();

    cargarNombreUsuario();

    renderizarMisProveedores();

    renderizarRecomendados();

});


/* =======================================================
   2. GESTIÓN DE MODALES Y UI
   ======================================================= */
function setupGlobalListeners() {
    // Cerrar modales con overlay
    const overlay = document.getElementById('modal-overlay');
    if(overlay) {
        overlay.addEventListener('click', (e) => {
            if(e.target === overlay) closeAllModals();
        });
    }

    // Botones de cerrar genéricos
    const closeButtons = document.querySelectorAll('.close-modal-modern, .close-modal-white, .btn-close-profile, .btn-close-cropper');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if(btn.classList.contains('btn-close-cropper')) {
                toggleModal('modal-cropper', false);
                toggleModal('modal-profile', true);
            } else {
                closeAllModals();
            }
        });
    });

    // Botones específicos de Perfil
    const avatarBtn = document.getElementById('navbar-avatar-btn');
    if(avatarBtn) avatarBtn.addEventListener('click', () => openModal('modal-profile'));

    const btnSaveProfile = document.getElementById('btn-save-profile');
    if(btnSaveProfile) btnSaveProfile.addEventListener('click', saveProfileToDB);

    const btnCrop = document.getElementById('btn-perform-crop');
    if(btnCrop) btnCrop.addEventListener('click', performCrop);

    // Input de subir imagen (Avatar)
    const uploadInput = document.getElementById('upload-avatar');
    if(uploadInput) {
        uploadInput.addEventListener('change', handleImageUpload);
    }
}

// Función Universal para ABRIR Modales
window.openModal = function(id) {
    const el = document.getElementById(id);
    const overlay = document.getElementById('modal-overlay');
    
    if (el) {
        if(overlay) overlay.classList.remove('hidden');
        el.classList.remove('hidden');
        document.body.classList.add('modal-open');
        
        // Estilos para asegurar centrado
        el.style.position = 'fixed';
        el.style.top = '50%';
        el.style.left = '50%';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.zIndex = '1001'; 
        
        // Ocultar icono chatbot si estorba
        const chatToggle = document.getElementById('chatbot-toggler-btn');
        if(chatToggle) chatToggle.style.display = 'none';
    }
};

// Función Universal para CERRAR Modales
window.closeAllModals = function() {
    document.querySelectorAll('.custom-modal, dialog').forEach(m => m.classList.add('hidden'));
    const overlay = document.getElementById('modal-overlay');
    if(overlay) overlay.classList.add('hidden');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = 'auto'; // Restaurar scroll
    
    // Restaurar icono chatbot
    const chatToggle = document.getElementById('chatbot-toggler-btn');
    if(chatToggle && !document.body.classList.contains('show-chatbot')) {
        chatToggle.style.display = 'flex';
        chatToggle.classList.remove('hide-icon');
        chatToggle.style.opacity = '1';
        chatToggle.style.pointerEvents = 'auto';
    }

    // Detener videos si hay iframe
    const iframe = document.querySelector('#modal-video iframe');
    if(iframe) { const tempSrc = iframe.src; iframe.src = tempSrc; }
};

// Utilidad interna para togglear modales específicos (usado en lógica interna)
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if(!modal) return;
    if(show) {
        window.openModal(modalId);
    } else {
        modal.classList.add('hidden');
        // Si no quedan modales visibles, ocultar overlay
        const visibleModals = document.querySelectorAll('.custom-modal:not(.hidden)');
        if(visibleModals.length === 0) {
            const overlay = document.getElementById('modal-overlay');
            if(overlay) overlay.classList.add('hidden');
            document.body.classList.remove('modal-open');
        }
    }
}

function loadUserName() {
    const savedName = localStorage.getItem('usuarioLogueado');
    const displayElement = document.getElementById('user-greeting');
    if (displayElement) displayElement.innerText = savedName ? `Hola, ${savedName}` : "Hola, Novia";
}

// ==========================================
// 1. LÓGICA DE CÁLCULO 
// ==========================================
function recalcularProgreso() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]'); 
    const total = checkboxes.length;
    if (total === 0) return; 

    const completadas = document.querySelectorAll('input[type="checkbox"]:checked').length;
    const porcentaje = Math.round((completadas / total) * 100);
    updateProgress(porcentaje);
}

// ==========================================
// 2. FUNCIÓN VISUAL
window.updateProgress = function(percent) {
    // Si por error llega la lista de tareas, forzamos que percent sea 100
    if (typeof percent !== 'number') percent = 100;

    const bar = document.getElementById('progress-bar');
    const txt = document.getElementById('progress-text');
    const celebrationCard = document.getElementById('container-botones-calificacion');

    // 1. Llenamos la barra visualmente
    if (bar) bar.style.width = percent + '%';
    if (txt) txt.innerText = percent + '%';

    // 2. MOSTRAR BOTONES (Como el percent es 100, entrará siempre aquí)
    if (celebrationCard) {
        if (percent >= 100) {
            celebrationCard.classList.remove('hidden');
            celebrationCard.style.display = 'block'; 
            console.log("Modo Prueba: Botones de calificación activados.");
        } else {
            celebrationCard.classList.add('hidden');
            celebrationCard.style.display = 'none';
        }
    }
};

window.logout = function() { localStorage.clear(); window.location.href = 'index.html'; };

/* =======================================================
   3. CALENDARIO Y EVENTOS
   ======================================================= */
function initGenericCalendar(calendarEl, eventsData, onEventClick, isEditable = false) {
    if (!calendarEl) return null;

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        height: 'auto',
        editable: isEditable,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listWeek'
        },
        events: eventsData,
        eventClick: function(info) {
            info.jsEvent.preventDefault();
            if (onEventClick) onEventClick(info);
        }
    });

    calendar.render();
    return calendar;
}

function initDashboardCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    
    const today = new Date(); 
    const y = today.getFullYear(); 
    const m = String(today.getMonth() + 1).padStart(2, '0');
    
    const eventsData = [
        { title: 'Prueba Menú', start: `${y}-${m}-15`, color: '#8E24AA', extendedProps: { urgency: 'medium', completed: false, desc: 'Degustación...', audience: 'Novios' } },
        { title: 'Pago Salón', start: `${y}-${m}-20`, color: '#D81B60', extendedProps: { urgency: 'urgent', completed: false, desc: 'Pago 50%', audience: 'Novia' } },
        { title: 'Cita Vestido', start: `${y}-${m}-25`, color: '#aaa', extendedProps: { urgency: 'completed', completed: true, desc: 'Prueba final', audience: 'Novia' } }
    ];

    calendarInstance = initGenericCalendar(calendarEl, eventsData, function(info) {
        openEventDetails(info.event);
    });
}

function filterCalendarEvents(calendarInstance, filterType) {
    if (!calendarInstance) return;
    const allEvents = calendarInstance.getEvents(); 
    allEvents.forEach(event => {
        const props = event.extendedProps;
        let shouldShow = true;
        if (filterType === 'all') {
            shouldShow = true;
        } else if (filterType === 'completed') {
            shouldShow = props.completed === true;
        } else {
            shouldShow = (props.urgency === filterType && !props.completed);
        }
        event.setProp('display', shouldShow ? 'auto' : 'none');
    });
}

window.filtrarCalendario = function(filter, btnElement) {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active')); 
    if(btnElement) btnElement.classList.add('active');
    filterCalendarEvents(calendarInstance, filter);
};

function openEventDetails(event) {
    const props = event.extendedProps;
    const elDate = document.getElementById('evt-date');
    if(elDate) elDate.innerText = event.start.toLocaleDateString();
    
    const elAud = document.getElementById('evt-audience');
    if(elAud) elAud.innerText = props.audience || 'General';
    
    const elDesc = document.getElementById('evt-desc');
    if(elDesc) elDesc.innerText = props.desc || 'Sin descripción.';
    
    const badge = document.getElementById('evt-priority');
    if(badge) {
        if(props.urgency === 'urgent') { 
            badge.innerText = 'Alta'; badge.className = 'priority-pill high'; 
        } else { 
            badge.innerText = 'Normal'; badge.className = 'priority-pill'; badge.style.background = '#eee'; badge.style.color = '#333'; 
        }
    }
    window.openModal('modal-event-details');
}


/* =======================================================
   4. GESTIÓN DE PROVEEDORES
   ======================================================= */
let recommendedVendors = [
    { id: 1, name: 'Flores del Campo', cat: 'Decoración', desc: 'Estilo rústico y natural' },
    { id: 2, name: 'DJ SoundWave', cat: 'Música', desc: 'Luces, sonido y animación' },
    { id: 3, name: 'Sweet Bakery', cat: 'Pastel', desc: 'Diseños únicos y modernos' },
    { id: 4, name: 'Luxury Cars', cat: 'Transporte', desc: 'Autos clásicos para novios' }
];

let selectedVendors = [
    { id: 101, name: 'Hacienda La Danesa', cat: 'Lugar', status: 'Contrato Firmado', signed: true },
    { id: 102, name: 'Focus Photography', cat: 'Foto', status: 'Contrato Firmado', signed: true },
    { id: 103, name: 'Catering Deluxe', cat: 'Comida', status: 'Contrato Firmado', signed: true }
];

function renderVendorLists() {
    // 1. LISTA DE RECOMENDADOS (Sin cambios, solo la pintamos igual)
    const recList = document.getElementById('recommended-vendors-list');
    if (recList) {
        recList.innerHTML = '';
        if (recommendedVendors.length === 0) {
            recList.innerHTML = '<p style="color:#888; font-size:0.9rem;">No hay más recomendaciones disponibles.</p>';
        } else {
            recommendedVendors.forEach((vendor, index) => {
                recList.innerHTML += `
                    <div class="vendor-item">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h4 class="vendor-name-link" onclick="openProviderStats('${vendor.name}')">✨ ${vendor.name}</h4>
                        </div>
                        <p style="font-size:0.9rem; color:#666; margin:5px 0;">${vendor.desc || 'Proveedor recomendado'}</p>
                        <button class="btn btn-select-vendor" style="margin-top:10px; width:100%;" onclick="moveToSelected(${index})">
                            Seleccionar
                        </button>
                    </div>`;
            });
        }
    }

    // 2. LISTA DE MIS PROVEEDORES (Aquí agregamos el botón Eliminar)
    const selList = document.getElementById('selected-vendors-list');
    if (selList) {
        selList.innerHTML = '';
        if (selectedVendors.length === 0) {
            selList.innerHTML = '<p style="color:#888; font-size:0.9rem;">Aún no has seleccionado proveedores.</p>';
        } else {
            // NOTA: Agregamos el parámetro 'index' al forEach para saber cuál borrar
            selectedVendors.forEach((vendor, index) => {
                const borderColor = vendor.signed ? 'var(--primary-green)' : 'var(--primary-orange)'; 
                const statusColor = vendor.signed ? 'var(--pastel-green-text)' : 'var(--pastel-yellow-text)';
                const statusBg = vendor.signed ? 'var(--pastel-green-bg)' : 'var(--pastel-yellow-bg)';
                const btnClass = vendor.signed ? 'btn btn-contract' : 'btn btn-ghost';
                const btnText = vendor.signed ? '<i class="fas fa-file-contract"></i> Ver Contrato' : '✍️ Pendiente';
                const clickAction = vendor.signed ? 'openPdf()' : '';

                selList.innerHTML += `
                    <div class="vendor-item" style="border-left: 5px solid ${borderColor}; position: relative;">
                        
                        <button onclick="removeFromSelected(${index})" title="Eliminar proveedor" 
                                style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: #ff5252; cursor: pointer; font-size: 1.1rem;">
                            <i class="fas fa-trash-alt"></i>
                        </button>

                        <h4 class="vendor-name-link" onclick="openProviderStats('${vendor.name}')" style="margin-right: 25px;">
                            💼 ${vendor.name}
                        </h4>
                        
                        <span style="background:${statusBg}; color:${statusColor}; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">
                            ${vendor.status}
                        </span>
                        
                        <div style="margin-top:10px;">
                            <button class="${btnClass}" style="width:100%;" onclick="${clickAction}">${btnText}</button>
                        </div>
                    </div>`;
            });
        }
    }
}

// === FUNCIONES DE ACCIÓN ===

// Mover de Recomendados -> Seleccionados
window.moveToSelected = function(index) {
    const vendor = recommendedVendors[index];
    // Lo agregamos a seleccionados
    selectedVendors.push({ 
        id: vendor.id, 
        name: vendor.name, 
        cat: vendor.cat, 
        desc: vendor.desc, // Guardamos la descripción por si lo regresamos luego
        status: 'Pendiente de Firma', 
        signed: false 
    });
    // Lo quitamos de recomendados
    recommendedVendors.splice(index, 1);
    
    renderVendorLists();
    
    // Feedback visual opcional
    // alert(`Has seleccionado a ${vendor.name}`);
};

// Variable global para recordar a quién vamos a borrar
let indiceParaEliminar = null;

window.removeFromSelected = function(index) {
    console.log("Intentando abrir modal para índice:", index); 
    indiceParaEliminar = index;
    
    const modal = document.getElementById('modal-confirm-delete');
    const overlay = document.getElementById('modal-overlay');
    if(modal) modal.classList.remove('hidden');
    if(overlay) overlay.classList.remove('hidden');
};

window.ejecutarEliminacion = function() {
    if (indiceParaEliminar !== null) {
        const vendor = selectedVendors[indiceParaEliminar];

        // --- Lógica de borrado ---
        
        // 1. Devolver a recomendados
        recommendedVendors.push({
            id: vendor.id,
            name: vendor.name,
            cat: vendor.cat,
            desc: vendor.desc || "Proveedor disponible nuevamente"
        });

        // 2. Eliminar de seleccionados
        selectedVendors.splice(indiceParaEliminar, 1);

        // 3. Renderizar de nuevo
        renderVendorLists();
        
        // 4. Resetear variable y cerrar modal
        indiceParaEliminar = null;
        cerrarModalEliminar();
        alert("Proveedor eliminado"); 
    }
};

// 3. CERRAR EL MODAL DE CONFIRMACIÓN
window.cerrarModalEliminar = function() {
    indiceParaEliminar = null; 
    const modal = Id('modal-confirm-delete');
    const overlay = document.getElementById('modal-overlay');
    
    if(modal) modal.classList.add('hidden');
    if(overlay) overlay.classList.add('hidden');
};

window.openProviderStats = function(nombre) {
    const content = document.getElementById('vendor-detail-content');
    if(!content) return;
    const p1 = Math.floor(Math.random() * 15 + 85); 
    
    content.innerHTML = `
        <div class="provider-profile-header">
            <div class="provider-avatar"><i class="fas fa-gem"></i></div>
            <h2>${nombre}</h2>
            <div class="provider-badges"><span class="badge match">98% Match</span></div>
        </div>
        <div class="provider-stats-body">
            <h4 style="color:#D81B60; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:5px;">Desempeño</h4>
            <div class="stat-row-modern">
                <span class="stat-label">Calidad</span>
                <div class="stat-bar-container"><div class="stat-bar-value" style="width:${p1}%; background:#2196F3;"></div></div>
                <span class="stat-number">${p1}%</span>
            </div>
            <div class="stat-row-modern">
                <span class="stat-label">Puntualidad</span>
                <div class="stat-bar-container"><div class="stat-bar-value" style="width:100%; background:#4CAF50;"></div></div>
                <span class="stat-number">100%</span>
            </div>
        </div>`;
    window.openModal('modal-vendor-details');
};

/* =======================================================
   5. GESTIÓN DE INVITADOS
   ======================================================= */
window.openGuestsModal = function() { 
    renderGuests('all'); 
    window.openModal('modal-guests'); 
    const form = document.getElementById('modal-add-guest-form');
    if(form) form.classList.add('hidden');
};

// Renderizar tabla (Incluye lógica de ID y Eliminar)
window.renderGuests = function(filter) {
    const tbody = document.getElementById('guests-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const filteredGuests = guestsList.filter(guest => filter === 'all' || guest.status === filter);
    
    filteredGuests.forEach(guest => {
        const row = document.createElement('tr');
        const statusBadge = guest.status === 'Confirmado' 
            ? `<span class="status-badge paid">Confirmado</span>` 
            : `<span class="status-badge pending">Pendiente</span>`;

        row.innerHTML = `
            <td>${guest.name}</td>
            <td><span class="badge-group">${guest.group}</span></td>
            <td>${guest.table || '-'}</td>
            <td>${statusBadge}</td>
            <td class="actions-cell">
                <button class="btn-action-delete" onclick="deleteGuest(${guest.id})" title="Eliminar invitado">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
};

window.filterGuests = function() { 
    const searchVal = document.getElementById('guest-search').value.toLowerCase();
    const filterVal = document.getElementById('guest-filter').value;
    
    const tbody = document.getElementById('guests-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    const filtered = guestsList.filter(g => {
        const matchesStatus = (filterVal === 'all' || g.status === filterVal);
        const matchesSearch = g.name.toLowerCase().includes(searchVal) || g.group.toLowerCase().includes(searchVal);
        return matchesStatus && matchesSearch;
    });

    filtered.forEach(guest => {
        const statusBadge = guest.status === 'Confirmado' ? '<span class="status-badge paid">Confirmado</span>' : '<span class="status-badge pending">Pendiente</span>';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${guest.name}</td>
            <td><span class="badge-group">${guest.group}</span></td>
            <td>${guest.table}</td>
            <td>${statusBadge}</td>
            <td class="actions-cell">
                <button class="btn-action-delete" onclick="deleteGuest(${guest.id})"><i class="fas fa-trash-alt"></i></button>
            </td>`;
        tbody.appendChild(row);
    });
};

window.openAddGuestModal = function() { 
    const formModal = document.getElementById('modal-add-guest-form');
    if(!formModal) return;
    formModal.classList.remove('hidden'); 
    // Asegurar posicionamiento
    formModal.style.position = 'fixed';
    formModal.style.top = '50%';
    formModal.style.left = '50%';
    formModal.style.transform = 'translate(-50%, -50%)';
    formModal.style.zIndex = '1002'; 
};

window.closeAddGuestModal = function() {
    const formModal = document.getElementById('modal-add-guest-form');
    if(formModal) formModal.classList.add('hidden');
};

// Agregar Nuevo Invitado
window.addNewGuest = function() {
    const name = document.getElementById('new-guest-name').value;
    const group = document.getElementById('new-guest-group').value;
    const table = document.getElementById('new-guest-table').value;
    const status = document.getElementById('new-guest-status').value;
    
    if(!name) return alert("Escribe un nombre");
    
    // Generamos ID único basado en fecha
    const newId = Date.now(); 

    guestsList.push({ id: newId, name, group, table, status });
    document.getElementById('new-guest-name').value = '';
    
    closeAddGuestModal();
    renderGuests('all');
    updateGuestCounters();
};

// Eliminar Invitado
window.deleteGuest = function(id) {
    if(confirm('¿Estás segura de eliminar a este invitado?')) {
        const index = guestsList.findIndex(g => g.id === id);
        if (index > -1) {
            guestsList.splice(index, 1);
            
            // Refrescar tabla manteniendo filtro actual si es posible
            const filterSelect = document.getElementById('guest-filter');
            const currentFilter = filterSelect ? filterSelect.value : 'all';
            
            // Si hay búsqueda activa, llamar a filterGuests, si no, render normal
            const searchInput = document.getElementById('guest-search');
            if(searchInput && searchInput.value !== '') {
                filterGuests();
            } else {
                renderGuests(currentFilter);
            }
            updateGuestCounters();
        }
    }
};

function updateGuestCounters() {
    const totalEl = document.getElementById('total-guests');
    const confirmedEl = document.getElementById('confirmed-guests');
    if(totalEl) totalEl.innerText = guestsList.length; 
    if(confirmedEl) confirmedEl.innerText = guestsList.filter(g => g.status === 'Confirmado').length;
}


/* =======================================================
   6. PRESUPUESTO
   ======================================================= */
let budgetItems = [
    { item: 'Hacienda', real: 5000, estimated: 5000, status: 'Pagado' },
    { item: 'Catering', real: 4500, estimated: 4500, status: 'Pagado' },
    { item: 'Decoración', real: 2000, estimated: 2500, status: 'Pendiente' },
    { item: 'Música', real: 1200, estimated: 1500, status: 'Pendiente' },
    { item: 'Fotografía', real: 1800, estimated: 1800, status: 'Pagado' }
];

window.openBudgetModal = function() { 
    renderBudget('Todo'); 
    window.openModal('modal-budget'); 
};

window.renderBudget = function(filter) {
    const tbody = document.getElementById('budget-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const filteredItems = budgetItems.filter(item => {
        if (filter === 'Todo') return true;
        return item.status === filter;
    });

    filteredItems.forEach(item => {
        const badgeClass = item.status === 'Pagado' ? 'paid' : 'pending';
        const row = `
            <tr>
                <td>${item.item}</td>
                <td>$${item.real.toLocaleString()}</td>
                <td>$${item.estimated.toLocaleString()}</td>
                <td><span class="status-badge ${badgeClass}">${item.status}</span></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
};

/* =======================================================
   7. CHATBOT INTELIGENTE (REPARADO)
   ======================================================= */
function initChatbot() {
    const toggler = document.getElementById('chatbot-toggler-btn'); 
    const closeBtn = document.getElementById('close-chat-btn');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('send-btn');
    const attachBtn = document.querySelector('.chat-input label'); 

    // Crear Input File invisible si no existe
    let fileInput = document.getElementById('chat-file-hidden');
    if(!fileInput) {
        fileInput = document.createElement('input');
        fileInput.id = 'chat-file-hidden';
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.jpg,.png,.jpeg';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
    }

    // Interacciones UI
    if (toggler) {
        toggler.addEventListener('click', () => { 
            document.body.classList.add('show-chatbot'); 
            // Ocultar el botón para que no estorbe
            toggler.style.opacity = '0'; 
            toggler.style.pointerEvents = 'none'; 
            if(input) input.focus();
        });
    }

    if(input) {
        input.setAttribute('rows', '1');
        input.addEventListener('input', function() {
            this.style.height = 'auto'; 
            this.style.height = (this.scrollHeight) + 'px'; 
            this.style.overflowY = this.scrollHeight > 120 ? 'auto' : 'hidden';
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); 
                sendMessage();
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => { 
            document.body.classList.remove('show-chatbot'); 
            if (toggler) {
                toggler.style.opacity = '1'; 
                toggler.style.pointerEvents = 'auto'; 
            }
        });
    }

    if(attachBtn) attachBtn.addEventListener('click', (e) => { e.preventDefault(); fileInput.click(); });
    
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            tempFile = {
                inlineData: { data: reader.result.split(',')[1], mimeType: file.type },
                fileName: file.name
            };
            addMessage(`📎 <b>${file.name}</b> adjunto.`, 'user');
            if(input) input.focus();
        };
    };

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
}

// Función de Envío Mejorada con Debugging
async function sendMessage() {
    const input = document.getElementById('chatbot-input');
    const messagesContainer = document.getElementById('chatbot-messages');
    const text = input.value.trim();

    if (!text && !tempFile) return;
    
    // Limpiar input
    input.value = '';
    input.style.height = 'auto'; 

    // Mostrar mensaje usuario
    if (text) addMessage(text, 'user');
    if (text) chatHistory.push({ role: 'user', content: text });

    // Mostrar "Pensando..."
    const loadingDiv = document.createElement('li');
    loadingDiv.className = 'chat incoming';
    loadingDiv.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>Pensando...</p>`;
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        const userName = localStorage.getItem('usuarioLogueado') || "Novia";
        const payload = {
            messages: chatHistory, 
            message: text,            
            isNovia: true,
            role: 'novia',        
            userName: userName,
            fileData: tempFile ? tempFile.inlineData : null 
        };
        
        console.log("📨 Enviando mensaje al servidor:", `${API_URL}/ia/chat`);
        
        const res = await fetch(`${API_URL}/ia/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`Error HTTP: ${res.status}`);
        }

        const data = await res.json();
        loadingDiv.remove(); // Quitar "pensando"

        if (data.success) {
            addMessage(data.response, 'bot');
            chatHistory.push({ role: 'assistant', content: data.response });

            if (data.shareSuggestion && data.shareSuggestion.suggestShare) {
                showShareButtons(data.shareSuggestion);
            }
            tempFile = null;
        } else {
            addMessage(`⚠️ El servidor respondió pero hubo un error: ${data.response || 'Desconocido'}`, 'bot');
        }

    } catch (error) {
        loadingDiv.remove();
        console.error("❌ Error de conexión Chatbot:", error);
        addMessage(`❌ Error de conexión. Asegúrate de que API_URL es correcta. \nDetalle: ${error.message}`, 'bot');
    }
}

function addMessage(html, sender) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const li = document.createElement('li');
    li.classList.add('chat', sender === 'user' ? 'outgoing' : 'incoming');
    
    if (sender === 'user') {
        li.innerHTML = `<p>${html.replace(/\n/g, '<br>')}</p>`;
    } else {
        li.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>${html.replace(/\n/g, '<br>')}</p>`;
    }
    
    messagesContainer.appendChild(li);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showShareButtons(suggestionData) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const div = document.createElement('div');
    div.className = 'chat incoming';
    div.style.listStyle = 'none'; 
    div.innerHTML = `
        <div style="margin-left: 35px; background: #f1f1f1; padding: 10px; border-radius: 10px;">
            <p style="font-size: 0.9rem; margin-bottom: 5px;">¿Guardar en la carpeta de Andrea?</p>
            <button class="quick-btn confirm-btn" style="background:#4CAF50; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; margin-right:5px;">Sí</button>
            <button class="quick-btn cancel-btn" style="background:#f44336; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">No</button>
        </div>
    `;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const userName = localStorage.getItem('usuarioLogueado') || "Novia";

    div.querySelector('.confirm-btn').onclick = async () => {
        div.innerHTML = `<div style="margin-left: 35px;"><span style="font-size:0.8rem; color:#D81B60;">Enviando...</span></div>`;
        try {
            await fetch(`${API_URL}/ia/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    saveToInbox: true,  
                    isNovia: true,
                    role: 'novia',
                    userName: userName,
                    summaryData: suggestionData, 
                    fileData: tempFile ? tempFile.inlineData : null 
                })
            });
            div.innerHTML = `<div style="margin-left: 35px;"><span style="font-size:0.8rem; color:green;">✅ Guardado exitosamente.</span></div>`;
            tempFile = null; 
        } catch (e) { div.innerHTML = "Error al guardar."; }
    };

    div.querySelector('.cancel-btn').onclick = () => {
        div.remove();
        tempFile = null;
    };
}


/* =======================================================
   8. PERFIL, IMAGEN Y ALERTAS
   ======================================================= */
function handleImageUpload(e) {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const imgElement = document.getElementById('image-to-crop');
            if(imgElement) {
                imgElement.src = evt.target.result;
                toggleModal('modal-profile', false);
                toggleModal('modal-cropper', true);
                
                if(cropper) cropper.destroy();
                cropper = new Cropper(imgElement, {
                    aspectRatio: 1, 
                    viewMode: 1,
                    autoCropArea: 1,
                });
            }
        };
        reader.readAsDataURL(file);
    }
}

function performCrop() {
    if(!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 300, height: 300 }); 
    tempCroppedImage = canvas.toDataURL("image/jpeg", 0.8); 
    
    const previewImg = document.getElementById('preview-avatar');
    const previewInitial = document.getElementById('preview-initial');
    if(previewImg) {
        previewImg.src = tempCroppedImage;
        previewImg.classList.remove('hidden');
    }
    if(previewInitial) previewInitial.classList.add('hidden');

    toggleModal('modal-cropper', false);
    toggleModal('modal-profile', true);
}

function saveProfileToDB() {
    const nameInput = document.getElementById('profile-name');
    const partnerInput = document.getElementById('profile-partner');
    const dateInput = document.getElementById('profile-date');
    const budgetInput = document.getElementById('profile-budget');
    const styleInput = document.getElementById('profile-style');
    const btnSave = document.getElementById('btn-save-profile');

    const name = nameInput.value.trim();
    const storedUserId = localStorage.getItem('userId');

    if (!name) {
        nameInput.style.border = "2px solid #ef4444"; 
        nameInput.focus();
        return; 
    }
    if (!storedUserId) {
        alert("Error de sesión: No se encontró el ID de usuario.");
        return;
    }

    const originalText = btnSave.innerText;
    btnSave.innerText = "Guardando...";

    const datos = {
        userId: storedUserId,
        nombre: name,
        pareja: partnerInput ? partnerInput.value : '',
        fecha_boda: dateInput ? dateInput.value : '',
        presupuesto: budgetInput ? parseFloat(budgetInput.value) : 0,
        estilo: styleInput ? styleInput.value : '',
        avatarBase64: tempCroppedImage || "" 
    };

    fetch(`${API_URL}/guardar-perfil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    })
    .then(response => response.json())
    .then(data => {
        if(data.success) {
            localStorage.setItem('usuarioLogueado', name);
            if(datos.fecha_boda) localStorage.setItem('weddingDate', datos.fecha_boda);
            if(data.nueva_imagen || tempCroppedImage) localStorage.setItem('avatarImage', data.nueva_imagen || tempCroppedImage);
            
            updateNavbarAvatar();
            initCountdown();
            verificarAlertasSilenciosas(); 

            toggleModal('modal-profile', false);
            window.openModal('modal-success');
        } else {
            alert("Error al guardar: " + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Error de conexión con el servidor.");
    })
    .finally(() => {
        btnSave.innerText = originalText;
    });
}

function updateNavbarAvatar() {
    const avatarBtn = document.getElementById('navbar-avatar-btn');
    if (!avatarBtn) return; 

    const nombreUsuario = localStorage.getItem('usuarioLogueado'); 
    const fotoAvatar = localStorage.getItem('avatarImage'); 

    if (fotoAvatar && fotoAvatar.length > 20) {
        avatarBtn.innerText = ""; 
        avatarBtn.style.backgroundImage = `url(${fotoAvatar})`;
        avatarBtn.style.backgroundSize = "cover";
        avatarBtn.style.backgroundPosition = "center";
    } else if (nombreUsuario) {
        const inicial = nombreUsuario.charAt(0).toUpperCase(); 
        avatarBtn.style.backgroundImage = "none"; 
        avatarBtn.innerText = inicial; 
    } else {
        avatarBtn.innerText = "N";
    }
}

async function verificarAlertasSilenciosas() {
    const box = document.getElementById('alert-box');
    if(!box) return;

    try {
        const userId = localStorage.getItem('userId'); 
        if(!userId) return;

        const response = await fetch(`${API_URL}/alerts/${userId}`);
        const data = await response.json();
        
        if (!data.success || !data.alerts || data.alerts.length === 0) {
            box.style.display = 'none';
            return; 
        }

        box.style.display = 'block'; 
        box.innerHTML = ''; 
        data.alerts.forEach(alerta => {
            const div = document.createElement('div');
            div.className = `alert-item ${alerta.level}`; 
            div.innerHTML = `
                <div class="alert-icon">
                    ${alerta.level === 'HIGH' ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-info-circle"></i>'}
                </div>
                <div class="alert-text">
                    <strong>${alerta.title}</strong>
                    <span>${alerta.msg}</span>
                </div>
                <button class="close-alert" onclick="this.parentElement.remove()">×</button>
            `;
            box.appendChild(div);
        });
    } catch (error) {
        console.log("Sistema de alertas en silencio (Offline o Error)");
        box.style.display = 'none';
    }
}


/* 9. CHECKLIST (TAREAS) */

let checklistItems = [];

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initChecklistLogic();
});

// Busca esta función en tu código y REEMPLÁZALA completa:

function initChecklistLogic() {
    console.log("Iniciando lógica de Checklist...");

    // 1. Cargar tareas desde la base de datos al iniciar
    // (Asegúrate de tener la función obtenerTareasDesdeBD definida como te pasé antes)
    if(typeof obtenerTareasDesdeBD === 'function') {
        obtenerTareasDesdeBD();
    }

    // 2. Configurar input de Nueva Tarea (Enter para guardar)
    const input = document.getElementById('inputNuevaTarea');
    if(input) {
        // Clonamos el nodo para eliminar listeners viejos (buenas prácticas)
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        
        newInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') guardarNuevaTarea();
        });
        
        // Enfocar el input si alguien hace clic en el contenedor vacío
        newInput.addEventListener('focus', function() {
            // Opcional: efectos visuales al enfocar
        });
    }

    // ============================================================
    // 3. AQUÍ ESTÁ LA MAGIA DEL BOTÓN "VER PLANIFICACIÓN COMPLETA"
    // ============================================================
    const btnAbrir = document.getElementById('btn-abrir-modal');
    
    if (btnAbrir) {
        console.log("Botón 'Ver planificación' encontrado y activado.");
        
        // Usamos cloneNode para limpiar cualquier evento basura anterior
        const newBtn = btnAbrir.cloneNode(true);
        btnAbrir.parentNode.replaceChild(newBtn, btnAbrir);
        
        newBtn.addEventListener('click', function(e) {
            e.preventDefault(); // Evita que la página salte hacia arriba si es un <a>
            e.stopPropagation(); // Evita conflictos con otros clicks
            abrirModalPlanificacion(); // Llama a la función que abre el modal
        });
    } else {
        console.error("ADVERTENCIA: No encontré el botón con id='btn-abrir-modal' en el HTML. Revisa el Paso 1.");
    }
}

// ==========================================
// 2. CONEXIÓN CON BACKEND (CRUD)
// ==========================================

// A. LEER (GET)
async function obtenerTareasDesdeBD() {
    const uId = localStorage.getItem('userId');
    if (!uId) return console.warn("No hay usuario logueado");

    try {
        const response = await fetch(`${API_URL}/checklist/${uId}`);
        if (!response.ok) throw new Error('Error al obtener tareas');
        
        // Guardamos los datos en la variable global
        checklistItems = await response.json();
        
        // Renderizamos la vista
        renderChecklist();
        
    } catch (error) {
        console.error("Error cargando checklist:", error);
        // Opcional: mostrar error visual
        const container = document.getElementById('checklist-container');
        if(container) container.innerHTML = '<p class="text-danger">Error de conexión</p>';
    }
}

// B. CREAR (POST)
async function guardarNuevaTarea() {
    const input = document.getElementById('inputNuevaTarea');
    const texto = input ? input.value.trim() : '';
    const uId = localStorage.getItem('userId');

    if (!texto || !uId) return;

    // Datos a enviar al servidor
    const nuevaTareaPayload = {
        userId: uId,
        task_text: texto,  // Ajusta este nombre según tu BD (ej: 'text', 'description')
        priority: 'Normal'
    };

    try {
        const response = await fetch(`${API_URL}/checklist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevaTareaPayload)
        });

        if (response.ok) {
            input.value = ''; // Limpiar input
            toggleInputTarea(); // Ocultar input visualmente
            obtenerTareasDesdeBD(); // Recargar lista desde el servidor
        } else {
            alert("No se pudo guardar la tarea");
        }
    } catch (error) {
        console.error("Error guardando tarea:", error);
    }
}

// C. ACTUALIZAR (PATCH - Check/Uncheck)
async function cambiarEstadoTarea(id, estadoActual) {
    // 1. Optimismo UI: Cambiamos visualmente primero para que se sienta rápido
    const tareaLocal = checklistItems.find(t => t.id === id);
    if(tareaLocal) tareaLocal.completed = estadoActual; 
    renderChecklist(); 

    // 2. Enviar cambio al servidor
    try {
        // Ajusta 'is_completed' según se llame tu columna en BD
        await fetch(`${API_URL}/checklist/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_completed: estadoActual }) 
        });
        // Si todo va bien, no hacemos nada más. Si falla, el catch lo atrapa.
    } catch (error) {
        console.error("Error actualizando estado:", error);
        // Si falló, revertimos el cambio visual (Rollback)
        if(tareaLocal) tareaLocal.completed = !estadoActual;
        renderChecklist();
        alert("Error de conexión al actualizar");
    }
}

// D. ELIMINAR (DELETE)
async function eliminarTarea(id) {
    if(!confirm("¿Borrar esta tarea permanentemente?")) return;

    try {
        const response = await fetch(`${API_URL}/checklist/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Eliminamos localmente para no esperar al fetch completo
            checklistItems = checklistItems.filter(t => t.id !== id);
            renderChecklist();
        } else {
            alert("Error al eliminar en el servidor");
        }
    } catch (error) {
        console.error("Error eliminando tarea:", error);
    }
}

// ==========================================
// 3. RENDERIZADO VISUAL 
/* ================================================================
   LOGICA DEL WIDGET DE TAREAS (Fusión: Diseño Nuevo + Datos Reales)
   ================================================================ */

window.renderChecklist = function() {
    const containerWidget = document.getElementById('checklist-container');
    const containerModal = document.getElementById('lista-completa-container');
    
    // ---------------------------------------------------------
    // 1. NORMALIZACIÓN DE DATOS (Tu código que sí funciona)
    // ---------------------------------------------------------
    const listaNormalizada = checklistItems.map(t => {
        // Buscamos el texto en todas las variables posibles para evitar "undefined"
        const textoTarea = t.task_text || t.text || t.texto || t.description || t.title || t.name || "Tarea sin nombre";
        
        // Normalizamos el estado de completado
        const estaCompletada = (t.is_completed === true || t.is_completed === 1 || t.completed === true || t.completed === 1 || t.status === 'completed');

        return {
            id: t.id,
            text: textoTarea, 
            completed: estaCompletada,
            priority: t.priority || 'Normal'
        };
    });

    // ---------------------------------------------------------
    // 2. RENDERIZADO DEL WIDGET (Diseño Nuevo: Solo 3 items)
    // ---------------------------------------------------------
    if (containerWidget) {
        containerWidget.innerHTML = ''; // Limpiar contenido previo
        
        if (listaNormalizada.length === 0) {
            // DISEÑO: Estado Vacío (Cuando no hay tareas)
            containerWidget.innerHTML = `
                <div style="text-align:center; padding:30px 0; color:#aaa;">
                    <div style="font-size:1.8rem; margin-bottom:10px; opacity:0.5;">🎉</div>
                    <p style="margin:0; font-size:0.95rem; font-weight:500;">¡Todo al día!</p>
                    <small style="font-size:0.8rem;">Usa el botón + para añadir pendientes</small>
                </div>
            `;
        } else {
            // A. Mostramos solo las PRIMERAS 3 tareas
            listaNormalizada.slice(0, 3).forEach(tarea => {
                const isChecked = tarea.completed ? 'checked' : '';
                // Estilo tachado si está completa
                const styleText = tarea.completed ? 'text-decoration: line-through; color: #bbb;' : 'color: #555;';
                
                // HTML Específico para el Widget (Más simple que el del modal)
                const htmlItem = `
                    <div class="checklist-item-widget" style="display:flex; align-items:center; padding:12px 0; border-bottom:1px solid #fcfcfc;">
                        <input type="checkbox" class="custom-check" ${isChecked} 
                               onchange="cambiarEstadoTarea(${tarea.id})"
                               style="margin-right:12px; cursor:pointer; accent-color:#e88f98;">
                        
                        <span style="flex:1; ${styleText} font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${tarea.text}
                        </span>
                    </div>
                `;
                containerWidget.insertAdjacentHTML('beforeend', htmlItem);
            });
            
            // B. Si hay más de 3, mostramos el aviso "+ X más"
            if (listaNormalizada.length > 3) {
                const restantes = listaNormalizada.length - 3;
                containerWidget.insertAdjacentHTML('beforeend', `
                    <div style="text-align:center; padding-top:12px;">
                        <span style="font-size:0.8rem; color:#e88f98; font-weight:600; background:#fff0f3; padding:4px 12px; border-radius:20px;">
                            + ${restantes} tareas más pendientes...
                        </span>
                    </div>
                `);
            }
        }
    }

    // ---------------------------------------------------------
    // 3. RENDERIZADO DEL MODAL (Lista Completa)
    // ---------------------------------------------------------
    if (containerModal) {
        containerModal.innerHTML = '';
        listaNormalizada.forEach(tarea => {
            // Aquí seguimos usando tu función 'generarHTMLTarea' que tiene el botón de borrar y más detalles
            // Asegúrate de que esa función use 'tarea.text' y no 'tarea.task_text' porque ya normalizamos arriba
            containerModal.insertAdjacentHTML('beforeend', generarHTMLTarea(tarea, 'modal'));
        });
    }
    
    // Actualizar barra de progreso si existe
    if(typeof updateProgress === 'function') {
        updateProgress(100);;
    }
};

/* ================================================================
   FUNCIÓN NUEVA: Mostrar/Ocultar el input al pulsar el botón '+'
   ================================================================ */
window.toggleInputTarea = function() {
    const row = document.getElementById('nueva-tarea-row');
    const input = document.getElementById('inputNuevaTarea');
    
    if (row) {
        if (row.style.display === 'none' || row.style.display === '') {
            // Mostrar con animación simple
            row.style.display = 'flex'; 
            // Poner el cursor automáticamente en el input
            if(input) input.focus();
        } else {
            row.style.display = 'none';
        }
    }
};

/* ================================================================
   FUNCIÓN PARA MARCAR TAREA COMO COMPLETADA/PENDIENTE
   ================================================================ */
window.cambiarEstadoTarea = function(idTarea) {
    // 1. Buscar la tarea en el arreglo global 'checklistItems'
    const tarea = checklistItems.find(t => t.id === idTarea);
    
    if (tarea) {
        // 2. Invertir el estado (Si era true pasa a false, y viceversa)
        // Detectamos el estado actual mirando todas las posibles variables
        const estabaCompleta = (tarea.is_completed === true || tarea.is_completed === 1 || tarea.completed === true);
        const nuevoEstado = !estabaCompleta;

        // 3. Actualizar el dato en memoria localmente
        tarea.completed = nuevoEstado;
        tarea.is_completed = nuevoEstado; // Actualizamos ambas por si acaso

        // 4. VOLVER A RENDERIZAR PARA VER EL CAMBIO VISUAL
        renderChecklist(); 
        
        console.log(`Tarea ${idTarea} cambiada a: ${nuevoEstado ? 'Completada' : 'Pendiente'}`);

        // ---------------------------------------------------------
        // 5. AQUÍ IRÍA LA LLAMADA AL SERVIDOR 
        fetch(`/api/tareas/${idTarea}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: nuevoEstado })
        }).catch(err => console.error("Error guardando en BD:", err));
    }
};

// Generador de HTML (Estilo Consistente)
function generarHTMLTarea(tarea, contexto) {
    const uniqueId = `${contexto}-${tarea.id}`; 
    const isChecked = tarea.completed;
    
    const textStyle = isChecked ? 'text-decoration: line-through; color: #aaa;' : 'color: #333;';
    const rowOpacity = isChecked ? 'opacity: 0.8;' : 'opacity: 1;';
    
    return `
        <div class="checklist-item-row" id="row-${uniqueId}" 
             style="display:flex; align-items:center; padding:10px 0; border-bottom:1px solid #f0f0f0; ${rowOpacity}">
            
            <input type="checkbox" id="check-${uniqueId}" 
                ${isChecked ? 'checked' : ''} 
                onchange="cambiarEstadoTarea(${tarea.id}, this.checked)"
                style="transform: scale(1.3); cursor: pointer; margin-right: 12px; accent-color: #e88f98;">
            
            <span style="flex:1; font-size: 0.95rem; ${textStyle} transition: all 0.3s;">
                ${tarea.text}
            </span>

            ${tarea.priority === 'Alta' && !isChecked ? 
                '<span style="background:#ffecec; color:#ff6b6b; font-size:0.7rem; padding:2px 8px; border-radius:10px; margin-right:10px;">Alta</span>' 
                : ''}
            
            <button onclick="eliminarTarea(${tarea.id})" 
                  style="background:none; border:none; cursor:pointer; color:#ff6b6b; font-size:1.2rem; padding:0 5px;"
                  title="Eliminar tarea">
                  &times;
            </button>
        </div>
    `;
}

// ==========================================
// 4. FUNCIONES DE UTILIDAD (MODAL & TOGGLE)
// ==========================================

window.toggleInputTarea = function() {
    const row = document.getElementById('nueva-tarea-row');
    const input = document.getElementById('inputNuevaTarea');
    if (row) {
        if (row.classList.contains('hidden') || row.style.display === 'none') {
            row.classList.remove('hidden');
            row.style.display = 'flex'; 
            if(input) setTimeout(() => input.focus(), 100);
        } else {
            row.classList.add('hidden');
            row.style.display = 'none';
        }
    }
};

/* ==========================================
   4. FUNCIONES DEL MODAL (ACTUALIZADAS)
   ========================================== */

window.abrirModalPlanificacion = function() {
    const modal = document.getElementById('modal-full-checklist');
    
    if(modal) {
        // 1. Mostrar con Flex (quitamos hidden si existe, o usamos display directo)
        modal.classList.remove('hidden'); 
        
        // 2. Pequeño retardo para permitir que el navegador procese el display:flex antes de la opacidad
        // Esto permite que la animación de entrada (fade-in) funcione
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // 3. BLOQUEAR SCROLL DE LA PÁGINA DE FONDO
        document.body.style.overflow = 'hidden'; 
        
        // 4. Refrescar datos
        renderChecklist();
    }
};

window.cerrarModalPlanificacion = function() {
    const modal = document.getElementById('modal-full-checklist');
    
    if(modal) {
        // 1. Quitar clase de animación
        modal.classList.remove('show');
        
        // 2. Esperar a que termine la animación (0.3s) para ocultarlo del todo
        setTimeout(() => {
            modal.classList.add('hidden'); // O style.display = 'none' según tu HTML
        }, 300);

        // 3. REACTIVAR SCROLL DE LA PÁGINA
        document.body.style.overflow = 'auto'; 
    }
};

// Cerrar si hacen clic fuera de la tarjeta (en el fondo oscuro)
document.getElementById('modal-full-checklist')?.addEventListener('click', function(e) {
    if (e.target === this) {
        cerrarModalPlanificacion();
    }
});

function updateProgress(tareas) {
    const total = tareas.length;
    const completadas = tareas.filter(t => t.completed).length;
    const porcentaje = total === 0 ? 0 : Math.round((completadas / total) * 100);
    
    const textPorcentaje = document.getElementById('progress-text');
    if(textPorcentaje) textPorcentaje.innerText = `${porcentaje}% Completado`;
    
    const barra = document.querySelector('.progress-bar-fill'); 
    if(barra) barra.style.width = `${porcentaje}%`;
}
/* =======================================================
   10. UTILIDADES Y OTROS
   ======================================================= */
function initCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);

    const savedDate = localStorage.getItem('weddingDate'); 
    const wrapper = document.getElementById('countdown-wrapper');
    const emptyBtn = document.getElementById('btn-setup-date');

    if (!savedDate) {
        if(wrapper) wrapper.classList.add('hidden'); 
        if(emptyBtn) emptyBtn.classList.remove('hidden'); 
        return;
    }

    if(wrapper) wrapper.classList.remove('hidden');
    if(emptyBtn) emptyBtn.classList.add('hidden');
    const targetDate = new Date(savedDate + "T00:00:00").getTime();

    countdownInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            clearInterval(countdownInterval);
            if(wrapper) wrapper.innerHTML = "<h2 style='color:#d63384; font-family:Playfair Display'>¡Llegó el Gran Día! 💍</h2>";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const elDays = document.getElementById('c-days');
        const elHours = document.getElementById('c-hours');
        const elMins = document.getElementById('c-minutes');
        const elSecs = document.getElementById('c-seconds');

        if(elDays) elDays.innerText = days < 10 ? '0' + days : days;
        if(elHours) elHours.innerText = hours < 10 ? '0' + hours : hours;
        if(elMins) elMins.innerText = minutes < 10 ? '0' + minutes : minutes;
        if(elSecs) elSecs.innerText = seconds < 10 ? '0' + seconds : seconds;
    }, 1000);
}

// Lógica de calificación (Estrellas)
function checkSurveyStatus(btnId, storageKey) {
    if (localStorage.getItem(storageKey) === 'true') {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.style.display = 'none'; 
            const parent = btn.parentElement;
            if(!parent.querySelector(`.msg-${btnId}`)) {
                const msg = document.createElement('div');
                msg.className = `msg-${btnId}`; 
                msg.innerHTML = '✅ Gracias por tu opinión';
                msg.style.color = 'var(--primary-green)';
                msg.style.fontWeight = 'bold';
                msg.style.marginTop = '5px';
                parent.appendChild(msg);
            }
        }
    }
}
window.openMultiVendorRatingModal = function() { openRate('Proveedores'); };
window.openPlannerRatingModal = function() { openRate('Andrea'); };

window.openRate = function(tipo) {
    currentRatingContext = tipo;
    const container = document.getElementById('rating-form-container');
    const title = document.getElementById('rating-title');
    if(title) title.innerText = 'Calificar: ' + tipo;
    if(container) {
        container.innerHTML = ''; currentRatingValues = {}; 
        if (tipo === 'Andrea') {
            ['Puntualidad', 'Creatividad', 'Resolución', 'Amabilidad'].forEach((crit, index) => {
                const id = `andrea-${index}`; currentRatingValues[id] = 0;
                container.innerHTML += `<div class="rate-row"><h4>${crit}</h4><div class="stars-container" data-id="${id}">${generateStarsHTML(id)}</div></div>`;
            });
        } else {
            selectedVendors.forEach((vendor, index) => {
                const id = `vendor-${index}`; currentRatingValues[id] = 0;
                container.innerHTML += `<div class="rate-row"><h4>${vendor.name}</h4><div class="stars-container" data-id="${id}">${generateStarsHTML(id)}</div></div>`;
            });
        }
        window.openModal('modal-rate'); attachStarInteractions();
    }
};

function generateStarsHTML(uniqueId) {
    let html = ''; for (let i = 1; i <= 5; i++) html += `<i class="fa-solid fa-star star" data-id="${uniqueId}" data-value="${i}"></i>`; return html;
}

function attachStarInteractions() {
    const stars = document.querySelectorAll('#rating-form-container .star');
    stars.forEach(star => {
        const container = star.closest('.stars-container');
        const id = container.dataset.id;
        star.addEventListener('mouseover', function() { highlightStars(container, parseInt(this.dataset.value)); });
        star.addEventListener('mouseout', function() { highlightStars(container, currentRatingValues[id]); });
        star.addEventListener('click', function() { const value = parseInt(this.dataset.value); currentRatingValues[id] = value; highlightStars(container, value); });
        highlightStars(container, 0);
    });
}

function highlightStars(container, value) {
    const stars = container.querySelectorAll('.star');
    stars.forEach(s => { s.style.color = parseInt(s.dataset.value) <= value ? '#FFC107' : '#e0e0e0'; });
}

window.submitRating = function() {
    let allRated = true; Object.values(currentRatingValues).forEach(val => { if (val === 0) allRated = false; });
    if (!allRated) return alert("Por favor, califica todo antes de enviar.");
    closeAllModals();
    if (currentRatingContext === 'Andrea') { localStorage.setItem('survey_andrea_sent', 'true'); checkSurveyStatus('btn-rate-andrea', 'survey_andrea_sent'); } 
    else { localStorage.setItem('survey_vendors_sent', 'true'); checkSurveyStatus('btn-rate-vendors', 'survey_vendors_sent'); }
    setTimeout(() => { window.openModal('modal-thank-you'); }, 300);
};

// Utilidades PDF, Video, Excel
window.openPdf = function() { window.openModal('modal-pdf'); };

/* LÓGICA DE VIDEO*/

// 1. Función para ABRIR 
window.openVideoModal = function() {
    const modal = document.getElementById('modal-video');
    const chatToggler = document.getElementById('chatbot-toggler-btn'); 

    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
        document.body.classList.remove('show-chatbot'); 
        if (chatToggler) {
            chatToggler.style.display = 'none';
        }
    }
};

// 2. Función para CERRAR 
window.closeVideoModal = function() {
    const modal = document.getElementById('modal-video');
    const chatToggler = document.getElementById('chatbot-toggler-btn');

    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto'; 
        if (chatToggler) {
            chatToggler.style.display = 'flex'; 
        }
        const iframe = modal.querySelector('iframe');
        if (iframe) {
            const tempSrc = iframe.src;
            iframe.src = '';         
            iframe.src = tempSrc; 
        }
    }
};

function initExcelLogic() { 
    const input = document.getElementById('excel-upload-input'); const btn = document.querySelector('.btn-excel-dashed');
    if(btn && input) {
        btn.addEventListener('click', () => { input.click(); });
        input.addEventListener('change', () => { if (input.files.length > 0) { btn.innerHTML = `<i class="fa-solid fa-file-excel"></i> ${input.files[0].name}`; btn.style.borderColor = 'var(--primary-green)'; btn.style.color = 'var(--primary-green)'; btn.style.background = '#e8f5e9'; alert(`Archivo cargado.`); } }); 
    }
}

/* FILTROS DE PRESUPUESTO*/
window.filterBudgetTable = function(filtroIngles, btnElement) {
    const container = btnElement.closest('.pastel-filters-container');
    const botones = container.querySelectorAll('.filter-pill');
    botones.forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    const mapaEstados = {
        'all': 'Todo',
        'paid': 'Pagado',
        'pending': 'Pendiente'
    };
    renderBudget(mapaEstados[filtroIngles]);
};

/*Cargar datos de perfil de novia*/
async function cargarNombreUsuario() {
    const spanNombre = document.getElementById('user-name-display');
    const userId = localStorage.getItem('userId');
    
    // LOCALSTORAGE
    let storedName = localStorage.getItem('userName') || localStorage.getItem('usuarioLogueado');
    
    if (storedName && spanNombre) {
        spanNombre.innerText = storedName.split(' ')[0];
    }

    // Consultar BD
    if (userId) {
        try {
            const res = await fetch(`${API_URL}/profile/${userId}`);
            const data = await res.json();
            
            if (data.success && data.user.name) {
                localStorage.setItem('userName', data.user.name);
                localStorage.setItem('usuarioLogueado', data.user.name); 
                
                if (spanNombre) spanNombre.innerText = data.user.name.split(' ')[0];
                if (data.user.wedding_date) {
                    localStorage.setItem('weddingDate', data.user.wedding_date);
                }
            }
        } catch (error) {
            console.log("Modo offline: usando datos en caché");
        }
    }
}

