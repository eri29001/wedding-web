// URL base de tu API en Render (o localhost en desarrollo)
const API_URL = 'https://wedding-web-lygz.onrender.com/api';

let calendar = null;
let currentBrideId = null;
let currentEventObj = null;
let clickedDateStr = null;
let selectedProvidersData = [];

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Validación de seguridad en cliente: solo planners o admins
    if (!token || (user.role !== 'planner' && user.role !== 'admin')) {
        console.warn("🔒 Acceso restringido. Redirigiendo a login...");
        window.location.href = 'login.html';
        return;
    }

    // 1. Inicializaciones principales
    await cargarNoviasSelector();
    await cargarProveedoresGenerales();
    inicializarCalendario();
    inicializarChatbotPlanner();
});

// ==============================================================
// 1. SELECCIÓN Y CARGA DINÁMICA DE NOVIAS (DESDE POSTGRESQL)
// ==============================================================
async function cargarNoviasSelector() {
    const selector = document.getElementById('clientSelector');
    if (!selector) return;

    try {
        const response = await fetch(`${API_URL}/profile/novias`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();

        selector.innerHTML = '';

        if (response.ok && data.success && data.novias.length > 0) {
            data.novias.forEach((novia, index) => {
                const opt = document.createElement('option');
                opt.value = novia.user_id || novia.id;
                opt.textContent = `${novia.novia_nombre || novia.name} (${novia.partner_name || 'Sin pareja'})`;
                selector.appendChild(opt);

                if (index === 0) currentBrideId = opt.value;
            });

            // Cargar proveedores contratados de la primera novia
            await cargarContratosProveedores(currentBrideId);
        } else {
            selector.innerHTML = '<option value="">No hay novias registradas</option>';
        }
    } catch (error) {
        console.error('Error al cargar la lista de novias:', error);
    }
}

async function changeBrideFilter() {
    const selector = document.getElementById('clientSelector');
    if (!selector) return;

    currentBrideId = selector.value;
    if (calendar) calendar.refetchEvents();
    await cargarContratosProveedores(currentBrideId);
}

// ==============================================================
// 2. INTEGRACIÓN Y CONFIGURACIÓN DEL CALENDARIO (FULLCALENDAR)
// ==============================================================
function inicializarCalendario() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        height: 500,
        contentHeight: 'auto',
        headerToolbar: { 
            left: 'prev,next today', 
            center: 'title', 
            right: 'dayGridMonth' 
        },
        dateClick: function(info) {
            currentEventObj = null;
            clickedDateStr = info.dateStr;
            openEventModal();
        },
        eventClick: function(info) {
            currentEventObj = info.event;
            openEventModal(info.event);
        },
        events: async function(fetchInfo, successCallback, failureCallback) {
            if (!currentBrideId) return successCallback([]);

            try {
                const response = await fetch(`${API_URL}/calendar?userId=${currentBrideId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await response.json();

                if (response.ok && data.success) {
                    const formattedEvents = data.events.map(evt => ({
                        id: evt.id,
                        title: evt.title,
                        start: evt.event_date || evt.start,
                        color: evt.priority === 'Urgente' ? '#D81B60' : (evt.priority === 'Bajo' ? '#2e7d32' : '#3788d8'),
                        extendedProps: {
                            priority: evt.priority,
                            deadline: evt.deadline,
                            desc: evt.description,
                            link: evt.link,
                            target: evt.target_role || evt.target
                        }
                    }));
                    successCallback(formattedEvents);
                } else {
                    successCallback([]);
                }
            } catch (error) {
                console.error('Error al obtener eventos del calendario:', error);
                failureCallback(error);
            }
        }
    });

    calendar.render();
}

// Guardar/Actualizar Evento en la BD
async function saveEvent() {
    const title = document.getElementById('evtTitle').value.trim();
    const target = document.getElementById('evtTarget').value.trim();
    const deadline = document.getElementById('evtDeadline').value;
    const desc = document.getElementById('evtDesc').value.trim();
    const link = document.getElementById('evtLink').value.trim();
    const priority = document.getElementById('evtPriority').value;

    if (!title) return alert("El título del evento es obligatorio");

    const payload = {
        userId: currentBrideId,
        title,
        target_role: target,
        deadline: deadline || clickedDateStr,
        description: desc,
        link,
        priority,
        event_date: clickedDateStr || deadline
    };

    try {
        const method = currentEventObj ? 'PATCH' : 'POST';
        const url = currentEventObj ? `${API_URL}/calendar/${currentEventObj.id}` : `${API_URL}/calendar`;

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            calendar.refetchEvents();
            closeModal('eventModal');
        } else {
            alert(`⚠️ ${data.message || 'Error al guardar el evento.'}`);
        }
    } catch (error) {
        console.error('Error al guardar evento:', error);
    }
}

async function deleteEvent() {
    if (!currentEventObj) return;

    if (confirm("¿Deseas eliminar este evento del calendario?")) {
        try {
            const response = await fetch(`${API_URL}/calendar/${currentEventObj.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.ok) {
                currentEventObj.remove();
                closeModal('eventModal');
            }
        } catch (error) {
            console.error('Error al eliminar evento:', error);
        }
    }
}

// ==============================================================
// 3. GESTIÓN DE PROVEEDORES Y CONTRATOS
// ==============================================================
async function cargarProveedoresGenerales() {
    const tbody = document.getElementById("generalTableBody");
    if (!tbody) return;

    try {
        const response = await fetch(`${API_URL}/providers`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();

        if (response.ok && data.success && data.providers.length > 0) {
            let html = '';
            data.providers.forEach(prov => {
                const rating = parseFloat(prov.rating || 4.5).toFixed(1);
                html += `
                    <tr>
                        <td>
                            <span class="provider-link" onclick="showProviderDetails('${prov.name}', '${rating}', ${prov.id})">
                                ${prov.name}
                            </span>
                        </td>
                        <td>${prov.category || 'General'}</td>
                        <td><span class="rating-stars">★</span> ${rating}</td>
                        <td style="text-align:right;">
                            <span style="color:#2e7d32; font-size:0.8rem;">● ${prov.status || 'Activo'}</span>
                        </td>
                    </tr>`;
            });
            tbody.innerHTML = html;
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay proveedores registrados.</td></tr>';
        }
    } catch (error) {
        console.error('Error al cargar proveedores generales:', error);
    }
}

async function cargarContratosProveedores(brideId) {
    const tbody = document.getElementById('activeContractsTable');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_URL}/providers/selected?userId=${brideId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();

        tbody.innerHTML = '';
        selectedProvidersData = data.selected || [];

        if (selectedProvidersData.length > 0) {
            selectedProvidersData.forEach((item, index) => {
                const contractHtml = item.contract_url 
                    ? `<span style="color:#2e7d32; font-size:0.8rem;"><i class="fas fa-check-circle"></i> Subido</span>`
                    : `<button onclick="openContractModal('${item.provider_name}', '${item.id}')" class="btn-action btn-upload"><i class="fas fa-upload"></i> Subir</button>`;
                
                const dateHtml = item.start_date && item.end_date
                    ? `<button class="btn-action btn-date-display" onclick="openDateModal('${item.provider_name}', ${item.id})">${item.start_date} - ${item.end_date}</button>`
                    : `<button class="btn-action btn-calendar" onclick="openDateModal('${item.provider_name}', ${item.id})">Asignar Fechas</button>`;

                tbody.innerHTML += `
                    <tr>
                        <td><span class="provider-link" onclick="showProviderDetails('${item.provider_name}', '5.0', ${item.provider_id})">${item.provider_name}</span></td>
                        <td>${item.category || 'Servicio'}</td>
                        <td><span class="tag-bride">${item.bride_name || 'Novia'}</span></td>
                        <td>${contractHtml}</td>
                        <td>${dateHtml}</td>
                    </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;">No hay proveedores seleccionados para esta novia.</td></tr>';
        }
    } catch (error) {
        console.error('Error al cargar contratos de proveedores:', error);
    }
}

// Ficha de detalle de evaluacion del proveedor
async function showProviderDetails(name, score, providerId) {
    document.getElementById('detail-prov-name').innerText = name;
    document.getElementById('detail-score').innerText = score;
    document.querySelectorAll('.detail-bar-fill').forEach(el => el.style.width = '0%');
    openModal('providerDetailModal');

    try {
        const response = await fetch(`${API_URL}/providers/${providerId}/reviews`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();

        const stats = data.stats || {
            calidad: 90,
            precio: 85,
            servicio: 95,
            puntualidad: 92
        };

        setTimeout(() => {
            updateStat('calidad', stats.calidad);
            updateStat('precio', stats.precio);
            updateStat('servicio', stats.servicio);
            updateStat('puntualidad', stats.puntualidad);
        }, 150);

    } catch (error) {
        updateStat('calidad', 90);
        updateStat('precio', 85);
        updateStat('servicio', 95);
        updateStat('puntualidad', 92);
    }
}

function updateStat(id, val) {
    const bar = document.getElementById(`bar-${id}`);
    const label = document.getElementById(`val-${id}`);
    if (bar) bar.style.width = val + '%';
    if (label) label.innerText = val + '%';
}

// ==============================================================
// 4. MODAL HELPERS & UTILIDADES
// ==============================================================
function openModal(id) { 
    document.getElementById(id).style.display = 'flex'; 
    document.body.classList.add('modal-open'); 
}

function closeModal(id) { 
    document.getElementById(id).style.display = 'none'; 
    document.body.classList.remove('modal-open'); 
}

function openEventModal(event = null) {
    const btnDelete = document.getElementById('btnDeleteEvent');
    document.getElementById('evtTitle').value = '';
    document.getElementById('evtTarget').value = ''; 
    document.getElementById('evtDeadline').value = '';
    document.getElementById('evtDesc').value = '';
    document.getElementById('evtLink').value = '';
    
    if (event) {
        document.querySelector('#eventModal h3').innerText = 'Editar Evento';
        document.getElementById('evtTitle').value = event.title;
        document.getElementById('evtTarget').value = event.extendedProps.target || ''; 
        document.getElementById('evtDeadline').value = event.extendedProps.deadline || '';
        document.getElementById('evtDesc').value = event.extendedProps.desc || '';
        document.getElementById('evtLink').value = event.extendedProps.link || '';
        btnDelete.style.display = 'block';
    } else {
        document.querySelector('#eventModal h3').innerText = 'Nuevo Evento';
        document.getElementById('evtDeadline').value = clickedDateStr || ''; 
        btnDelete.style.display = 'none';
    }
    openModal('eventModal');
}

// ==============================================================
// 5. INTEGRACIÓN DEL CHATBOT CON EL BACKEND (WeddIA)
// ==============================================================
function inicializarChatbotPlanner() {
    const chatToggler = document.querySelector("#chat-toggler");
    const closeBtn = document.querySelector(".chatbot .close-btn");
    const chatbox = document.querySelector(".chatbox");
    const chatInput = document.querySelector(".chat-input textarea");
    const sendChatBtn = document.querySelector("#send-btn");

    if (chatToggler) chatToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));
    if (closeBtn) closeBtn.addEventListener("click", () => document.body.classList.remove("show-chatbot"));

    const createChatLi = (message, className) => {
        const chatLi = document.createElement("li");
        chatLi.classList.add("chat", className);
        chatLi.innerHTML = className === "outgoing" 
            ? `<p></p>` 
            : `<span class="material-symbols-rounded">smart_toy</span><p></p>`;
        chatLi.querySelector("p").textContent = message; 
        return chatLi;
    };

    const handleChat = async () => {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;
        
        chatInput.value = "";
        chatbox.appendChild(createChatLi(userMessage, "outgoing"));
        chatbox.scrollTo(0, chatbox.scrollHeight);
        
        const loadingLi = createChatLi("Consultando reporte ejecutivo a WeddIA...", "incoming");
        chatbox.appendChild(loadingLi);
        chatbox.scrollTo(0, chatbox.scrollHeight);

        try {
            const response = await fetch(`${API_URL}/ai/ask`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ prompt: userMessage })
            });

            const data = await response.json();
            chatbox.removeChild(loadingLi);
            
            if (response.ok && data.success) {
                chatbox.appendChild(createChatLi(data.reply, "incoming"));
            } else {
                chatbox.appendChild(createChatLi(`Error: ${data.message || 'La IA no respondió.'}`, "incoming"));
            }
        } catch (error) {
            chatbox.removeChild(loadingLi);
            chatbox.appendChild(createChatLi("Error de conexión con el servidor WeddIA.", "incoming"));
        }
        
        chatbox.scrollTo(0, chatbox.scrollHeight);
    };

    if (sendChatBtn) sendChatBtn.addEventListener("click", handleChat);
    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) { 
                e.preventDefault(); 
                handleChat(); 
            }
        });
    }
}