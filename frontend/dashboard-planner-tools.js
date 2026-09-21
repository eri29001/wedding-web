document.addEventListener('DOMContentLoaded', function() {
    const API_BASE_URL = 'https://wedding-web-lygz.onrender.com/api'; // Tu servidor Render
    // 1. DATOS INICIALES (MOCK DATA LOCAL)
    const bridesList = [
        { id: 'novia1', name: 'Erika Arroba', email: 'earrobalopez@gmail.com' },
        { id: 'novia2', name: 'Maria Gonzalez', email: 'maria.gonzalez@boda.com' },
        { id: 'novia3', name: 'Sofia Martinez', email: 'sofia.martinez@email.com' },
        { id: 'novia4', name: 'Carla Ruiz', email: 'carla.ruiz@wedding.com' },
        { id: 'novia5', name: 'Valentina Lopez', email: 'valentina.lopez@dream.com' },
        { id: 'novia6', name: 'Lucia Fernandez', email: 'lucia.fer@mail.com' },
        { id: 'novia7', name: 'Isabella Rojas', email: 'isabella.rojas@future.com' }
    ];

    window.eventsDB = {
        'novia1': [
            { id: 'ev1', title: 'Prueba Menú', start: '2025-05-10', extendedProps: { priority: 'Medio', deadline: '2025-05-12', desc: 'Prueba de 3 tiempos', link: '' }, color: '#3788d8' }
        ],
        'novia2': [
            { id: 'ev2', title: 'Cita DJ', start: '2025-06-15', extendedProps: { priority: 'Urgente', deadline: '2025-06-15', desc: 'Definir playlist', link: '' }, color: '#D81B60' }
        ]
    };

    window.selectedProvidersData = [
        { provider: 'Flores del Valle', category: 'Decoración', brideId: 'novia1', dateRange: null },
        { provider: 'DJ BeatMaster', category: 'Música', brideId: 'novia1', dateRange: '10 Feb - 12 Feb' },
        { provider: 'Catering Deluxe', category: 'Catering', brideId: 'novia2', dateRange: null }
    ];
    
    window.contractsDB = {}; 
    window.currentBrideId = 'novia1';
    window.currentEventObj = null; 
    window.clickedDateStr = null;
    window.calendar = null;
    window.currentProviderIndex = -1;
    window.currentSuppliers = []; // Para la IA de proveedores

    // ==========================================
    // 2. INICIALIZACIÓN DE COMPONENTES BÁSICOS
    // ==========================================

    // A. Selector de Clientes
    const selector = document.getElementById('clientSelector');
    if(selector) {
        bridesList.forEach(b => {
            let opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            selector.appendChild(opt);
        });
        
        // Listener para cambio de novia
        selector.addEventListener('change', (e) => {
            window.currentBrideId = e.target.value;
            if(window.calendar) window.calendar.refetchEvents(); 
        });
    }

    renderContractsTable();
    
    // Inyectar estilos necesarios (Chatbot flotante)
    injectMissingStyles(); 

    // ==========================================
    // 3. CALENDARIO (FULLCALENDAR)
    // ==========================================
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
        window.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'es',
            height: 500, 
            contentHeight: 'auto',
            aspectRatio: 1.8,
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth' }, 
            dateClick: function(info) {
                window.currentEventObj = null;
                window.clickedDateStr = info.dateStr;
                openEventModal();
            },
            eventClick: function(info) {
                window.currentEventObj = info.event;
                openEventModal(info.event);
            },
            events: function(fetchInfo, successCallback, failureCallback) {
                const events = window.eventsDB[window.currentBrideId] || [];
                successCallback(events);
            }
        });
        window.calendar.render();
    }

    // 4. CHATBOT IA 
    
    // UI Elements
    const chatbotToggler = document.querySelector(".chat-toggler");
    const closeBtn = document.querySelector(".close-btn");
    const chatInput = document.querySelector(".chat-input textarea");
    const sendChatBtn = document.querySelector(".chat-input span");
    const chatbox = document.querySelector(".chatbox");
    const body = document.body;

    // Toggles
    if (chatbotToggler) chatbotToggler.addEventListener("click", () => body.classList.toggle("show-chatbot"));
    if (closeBtn) closeBtn.addEventListener("click", () => body.classList.remove("show-chatbot"));

    // Funciones Chat
    const createChatLi = (message, className) => {
        const chatLi = document.createElement("li");
        chatLi.classList.add("chat", className);
        let chatContent = className === "outgoing" 
            ? `<p></p>` 
            : `<span class="material-symbols-outlined">smart_toy</span><p></p>`;
        chatLi.innerHTML = chatContent;
        chatLi.querySelector("p").textContent = message;
        return chatLi;
    }

    const handleChat = async () => {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        chatbox.appendChild(createChatLi(userMessage, "outgoing"));
        chatbox.scrollTo(0, chatbox.scrollHeight);
        chatInput.value = ""; 

        const loadingLi = createChatLi("Consultando a la IA...", "incoming");
        chatbox.appendChild(loadingLi);
        chatbox.scrollTo(0, chatbox.scrollHeight);

        try {
            const response = await fetch(`${API_BASE_URL}/ia/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    context: "wedding_planner", 
                    history: [] 
                })
            });

            const data = await response.json();
            chatbox.removeChild(loadingLi);
            
            if (data.success) {
                chatbox.appendChild(createChatLi(data.response, "incoming"));
            } else {
                chatbox.appendChild(createChatLi("Ups, la IA no devolvió respuesta. Revisa la consola.", "incoming"));
            }

        } catch (error) {
            chatbox.removeChild(loadingLi);
            chatbox.appendChild(createChatLi("❌ Error de conexión con el servidor.", "incoming"));
            console.error("Error Chat:", error);
        }
        chatbox.scrollTo(0, chatbox.scrollHeight);
    }

    if(sendChatBtn) sendChatBtn.addEventListener("click", handleChat);
    if(chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if(e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
                e.preventDefault();
                handleChat();
            }
        });
    }

    // 5. HERRAMIENTAS IA: PROVEEDORES Y RESÚMENES
    
    // --- A. GESTIÓN DE PROVEEDORES---
    const uploadSupplierBtn = document.getElementById('uploadSupplierBtn');
    const deleteSupplierBtn = document.getElementById('deleteSupplierBtn');
    const supplierStatus = document.getElementById('supplierStatus');
    const suppliersTableBody = document.querySelector('#suppliersTable tbody');
    const supplierSearch = document.getElementById('supplierSearch');

    async function fetchSuppliers() {
        if(!suppliersTableBody) return;
        try {
            suppliersTableBody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
            const res = await fetch(`${API_BASE_URL}/suppliers`); // Endpoint de proveedores
            const data = await res.json();
            window.currentSuppliers = Array.isArray(data) ? data : [];
            renderSuppliers(window.currentSuppliers);
        } catch (error) {
            console.error('Error al cargar proveedores:', error);
            suppliersTableBody.innerHTML = '<tr><td colspan="4">Error de conexión con la base de datos.</td></tr>';
        }
    }

    function renderSuppliers(suppliers) {
        if(!suppliersTableBody) return;
        suppliersTableBody.innerHTML = '';
        if (suppliers.length === 0) {
            suppliersTableBody.innerHTML = '<tr><td colspan="4">No hay proveedores. Sube un archivo CSV/JSON.</td></tr>';
            return;
        }
        // Ordenar por rating
        suppliers.sort((a, b) => (b.rating || 0) - (a.rating || 0)); 
        
        suppliers.forEach(supplier => {
            const row = suppliersTableBody.insertRow();
            row.insertCell().textContent = supplier.name || 'Sin Nombre';
            row.insertCell().textContent = supplier.category || 'Varios';
            row.insertCell().textContent = (supplier.rating ? parseFloat(supplier.rating).toFixed(1) : 'N/A');
            row.insertCell().textContent = supplier.contact || '-';
        });
    }

    // Inicializar carga de proveedores si existe la tabla
    if(suppliersTableBody) fetchSuppliers();

    // Eventos de Proveedores
    if(uploadSupplierBtn) {
        uploadSupplierBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('supplierFileInput');
            if (fileInput && fileInput.files.length > 0) {
                const fileName = fileInput.files[0].name;
                if(supplierStatus) supplierStatus.textContent = `✅ Base (${fileName}) procesada por IA.`;
                alert("Funcionalidad de subida pendiente de backend (multipart/form-data). Simulando recarga...");
                fetchSuppliers(); 
            } else {
                alert('Selecciona un archivo primero.');
            }
        });
    }

    if(deleteSupplierBtn) {
        deleteSupplierBtn.addEventListener('click', () => {
            if (confirm('¿Borrar base de datos local de la vista?')) {
                window.currentSuppliers = [];
                renderSuppliers([]);
                if(supplierStatus) supplierStatus.textContent = `❌ Vista limpiada.`;
            }
        });
    }

    if(supplierSearch) {
        supplierSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = window.currentSuppliers.filter(s =>
                (s.name && s.name.toLowerCase().includes(term)) ||
                (s.category && s.category.toLowerCase().includes(term))
            );
            renderSuppliers(filtered);
        });
    }

    // --- B. RESUMEN DE REUNIONES (IA) ---
    const summarizeBtn = document.getElementById('summarizeBtn');
    const meetingTranscription = document.getElementById('meetingTranscription');
    const aiSummaryResult = document.getElementById('aiSummaryResult');
    const summaryOutput = document.getElementById('summaryOutput');

    if(summarizeBtn && meetingTranscription) {
        summarizeBtn.addEventListener('click', async () => {
            const text = meetingTranscription.value.trim();
            if (text.length < 20) return alert('El texto es muy corto.');

            summarizeBtn.disabled = true;
            summarizeBtn.textContent = 'Analizando...';
            if(aiSummaryResult) aiSummaryResult.style.display = 'block';
            if(summaryOutput) summaryOutput.textContent = 'La IA está leyendo la transcripción...';

            try {
                const res = await fetch(`${API_BASE_URL}/ia/chat`, { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message: `Analiza esta reunión y dame un resumen ejecutivo y 3 puntos clave: "${text}"`,
                        context: "wedding_planner_summary"
                    })
                });
                
                const data = await res.json();
                if(summaryOutput) {
                    summaryOutput.innerHTML = data.success ? data.response.replace(/\n/g, '<br>') : 'Error en la IA.';
                }
            } catch (error) {
                if(summaryOutput) summaryOutput.textContent = 'Error de conexión.';
            } finally {
                summarizeBtn.disabled = false;
                summarizeBtn.textContent = 'Resumir y Recomendar';
            }
        });
    }

});

// 6. FUNCIONES GLOBALES 

window.openEventModal = function(event = null) {
    const btnDelete = document.getElementById('btnDeleteEvent');
    const modalTitle = document.querySelector('#eventModal h3');
    
    // Limpiar campos
    ['evtTitle', 'evtDeadline', 'evtDesc', 'evtLink'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const prioritySelect = document.getElementById('evtPriority');
    if(prioritySelect) prioritySelect.value = 'Medio';

    if(event) {
        if(modalTitle) modalTitle.innerText = 'Editar Evento';
        document.getElementById('evtTitle').value = event.title;
        document.getElementById('evtDeadline').value = event.extendedProps.deadline || '';
        document.getElementById('evtDesc').value = event.extendedProps.desc || '';
        document.getElementById('evtLink').value = event.extendedProps.link || '';
        
        let priority = 'Medio';
        if(event.backgroundColor === '#D81B60') priority = 'Urgente';
        if(event.backgroundColor === '#2e7d32') priority = 'Bajo';
        if(prioritySelect) prioritySelect.value = priority;
        
        if(btnDelete) btnDelete.style.display = 'block';
    } else {
        if(modalTitle) modalTitle.innerText = 'Nuevo Evento';
        const deadlineInput = document.getElementById('evtDeadline');
        if(deadlineInput) deadlineInput.value = window.clickedDateStr || ''; 
        if(btnDelete) btnDelete.style.display = 'none';
    }
    openModal('eventModal');
};

window.saveEvent = function() {
    const title = document.getElementById('evtTitle').value;
    const deadline = document.getElementById('evtDeadline').value;
    const desc = document.getElementById('evtDesc').value;
    const link = document.getElementById('evtLink').value;
    const priority = document.getElementById('evtPriority').value;

    let color = '#3788d8'; 
    if(priority === 'Urgente') color = '#D81B60'; 
    if(priority === 'Bajo') color = '#2e7d32'; 

    if(!title) return alert("El título es obligatorio");

    if(window.currentEventObj) {
        window.currentEventObj.setProp('title', title);
        window.currentEventObj.setProp('color', color);
        window.currentEventObj.setExtendedProp('deadline', deadline);
        window.currentEventObj.setExtendedProp('desc', desc);
        window.currentEventObj.setExtendedProp('link', link);
    } else {
        const newId = 'ev' + new Date().getTime();
        const newEvent = {
            id: newId,
            title: title,
            start: window.clickedDateStr,
            color: color,
            extendedProps: { deadline, desc, link }
        };
        
        if(!window.eventsDB[window.currentBrideId]) window.eventsDB[window.currentBrideId] = [];
        window.eventsDB[window.currentBrideId].push(newEvent);
        if(window.calendar) window.calendar.refetchEvents();
    }
    closeModal('eventModal');
};

window.deleteEvent = function() {
    if(window.currentEventObj && confirm("¿Eliminar este evento?")) {
        window.currentEventObj.remove();
        closeModal('eventModal');
    }
};

window.renderContractsTable = function() {
    const tbody = document.getElementById('activeContractsTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const selectedData = window.selectedProvidersData || [];
    selectedData.forEach((item, index) => {


        const key = `${item.provider}_${item.brideId}`;
        const hasContract = window.contractsDB[key];
        
        let contractHtml = hasContract 
            ? `<span style="color:#2e7d32; font-size:0.8rem; font-weight:600;"><i class="fas fa-check-circle"></i> Subido</span>`
            : `<button onclick="openContractModal('${item.provider}', '${item.brideId}')" class="btn-action btn-upload"><i class="fas fa-upload"></i> Subir</button>`;

        let dateHtml = item.dateRange 
            ? `<button class="btn-action btn-date-display" onclick="openDateModal('${item.provider}', ${index})">${item.dateRange}</button>`
            : `<button class="btn-action btn-calendar" onclick="openDateModal('${item.provider}', ${index})">Asignar Fechas</button>`;

        tbody.innerHTML += `
            <tr>
                <td><strong>${item.provider}</strong></td>
                <td>${item.category}</td>
                <td><span class="tag-bride">${item.brideId}</span></td>
                <td>${contractHtml}</td>
                <td>${dateHtml}</td>
            </tr>`;
    });
};

window.openDateModal = function(provName, index) {
    window.currentProviderIndex = index;
    openModal('dateModal');
};

window.saveProviderDates = function() {
    closeModal('dateModal');
};

window.openContractModal = function(provider, brideId) {
    const inputKey = document.getElementById('contractTargetKey');
    if(inputKey) inputKey.value = `${provider}_${brideId}`;
    openModal('contractModal');
};

window.saveContract = function() {
    const inputKey = document.getElementById('contractTargetKey');
    if(inputKey) {
        window.contractsDB[inputKey.value] = true;
        renderContractsTable();
    }
    closeModal('contractModal');
};

window.openModal = function(id) {
    const el = document.getElementById(id);
    if(el) {
        el.style.display = 'flex';
        document.body.classList.add('modal-open'); 
    }
};

window.closeModal = function(id) {
    const el = document.getElementById(id);
    if(el) {
        el.style.display = 'none';
        document.body.classList.remove('modal-open'); 
    }
};

window.logout = function() { window.location.href = 'index.html'; };

// 7. UTILIDADES VISUALES 
function injectMissingStyles() {
    const styleId = 'chatbot-styles-fix';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .chat-toggler, #chat-toggler {
                position: fixed !important; bottom: 30px !important; right: 35px !important;
                height: 50px !important; width: 50px !important;
                background: #8e44ad !important; color: white !important;
                border: none !important; border-radius: 50% !important;
                display: flex !important; align-items: center; justify-content: center;
                cursor: pointer !important; z-index: 99999 !important;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: all 0.3s ease;
            }
            .chat-toggler:hover { transform: translateY(-5px); }
            .chatbot, .chatbot-container {
                position: fixed !important; right: 35px !important; bottom: 90px !important;
                width: 320px !important; max-width: 90% !important;
                background: white !important; border-radius: 15px !important;
                box-shadow: 0 5px 25px rgba(0,0,0,0.2); overflow: hidden;
                transform: scale(0.5); opacity: 0; pointer-events: none;
                transition: all 0.3s ease; z-index: 99998 !important;
            }
            body.show-chatbot .chatbot, body.show-chatbot .chatbot-container {
                opacity: 1 !important; pointer-events: auto !important; transform: scale(1) !important;
            }
        `;
        document.head.appendChild(style);
    }
}