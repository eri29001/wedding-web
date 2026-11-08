document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = 'https://wedding-web-lygz.onrender.com/api';
    
    // Obtener token y datos de la novia logueada
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Redireccionar si no hay sesión activa (seguridad del lado cliente)
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // 1. Mostrar Saludo Personalizado
    const welcomeHeader = document.getElementById('welcomeHeader');
    if (welcomeHeader) {
        welcomeHeader.textContent = `¡Bienvenida, ${user.name || 'Novia'}! 💍`;
    }

    // 2. Inicializar Cargas de Datos y Eventos
    await cargarResumenYProgreso();
    inicializarWeddIAChat();

    // ==============================================================
    // 1. CARGA DE PROGRESO DE CHECKLIST Y ESTADO DE LA BODA
    // ==============================================================
    async function cargarResumenYProgreso() {
        try {
            const response = await fetch(`${API_URL}/checklist`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Actualizar barra de progreso del checklist
                const progressBar = document.getElementById('progressBar');
                const progressPercentage = document.getElementById('progressPercentage');
                const completion = data.stats?.completionPercentage || 0;

                if (progressBar) progressBar.style.width = `${completion}%`;
                if (progressPercentage) progressPercentage.textContent = `${completion}%`;

                // Verificar si la boda pasó a Modo Solo Lectura
                if (data.isWeddingCompleted) {
                    bloquearEdicionSoloLectura('¡Felicidades! Tu boda ha finalizado. La plataforma se encuentra en Modo Solo Lectura.');
                }
            }
        } catch (error) {
            console.error('Error al cargar progreso del checklist:', error);
        }
    }

    // Helper para mostrar alerta de Solo Lectura e inhabilitar formularios
    function bloquearEdicionSoloLectura(mensaje) {
        const banner = document.getElementById('readOnlyBanner');
        if (banner) {
            banner.innerHTML = `<i class="fas fa-lock"></i> ${mensaje}`;
            banner.style.display = 'block';
        }

        // Deshabilitar botones de creación/edición en la vista
        const actionButtons = document.querySelectorAll('.btn-editable, input[type="checkbox"]');
        actionButtons.forEach(btn => btn.disabled = true);
    }

    // ==============================================================
    // 2. INTEGRACIÓN CON WeddIA (ASISTENTE IA DE GEMINI)
    // ==============================================================
    function inicializarWeddIAChat() {
        const chatForm = document.getElementById('chatForm');
        const chatInput = document.getElementById('chatInput');
        const fileInput = document.getElementById('fileInput');
        const chatMessages = document.getElementById('chatMessages');

        if (!chatForm || !chatInput || !chatMessages) return;

        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const promptText = chatInput.value.trim();
            const file = fileInput?.files[0];

            if (!promptText && !file) return;

            // Renderizar mensaje de la novia en el chat
            agregarMensajeChat('Novia', promptText || '📄 [Documento adjunto]', 'user-message');
            chatInput.value = '';

            // Indicator de "WeddIA pensando..."
            const loadingBubble = agregarMensajeChat('WeddIA', '✨ Analizando datos de tu boda...', 'ai-message loading');

            try {
                let fileBase64 = null;
                let mimeType = null;

                // Si la novia adjuntó cotización o contrato en PDF/Imagen
                if (file) {
                    fileBase64 = await convertFileToBase64(file);
                    mimeType = file.type;
                    if (fileInput) fileInput.value = ''; // Limpiar input file
                }

                // Petición al endpoint de IA (aiController.js)
                const response = await fetch(`${API_URL}/ai/ask`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        prompt: promptText,
                        fileBase64: fileBase64 ? fileBase64.split(',')[1] : null,
                        mimeType: mimeType
                    })
                });

                const data = await response.json();
                loadingBubble.remove(); // Remover indicador de carga

                if (response.ok && data.success) {
                    agregarMensajeChat('WeddIA', data.reply, 'ai-message');
                } else {
                    agregarMensajeChat('WeddIA', `⚠️ ${data.message || 'No pude procesar tu consulta.'}`, 'ai-message error');
                }

            } catch (error) {
                console.error('Error al comunicarse con WeddIA:', error);
                if (loadingBubble) loadingBubble.remove();
                agregarMensajeChat('WeddIA', '⚠️ Error de conexión con la IA.', 'ai-message error');
            }
        });
    }

    // Helper para agregar burbujas de mensaje en la UI del chat
    function agregarMensajeChat(remitente, texto, claseEstilo) {
        const chatMessages = document.getElementById('chatMessages');
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${claseEstilo}`;
        bubble.innerHTML = `<strong>${remitente}:</strong> <p>${texto.replace(/\n/g, '<br>')}</p>`;
        
        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll al final
        return bubble;
    }

    // Helper para convertir archivos (PDF/Imágenes) a Base64 para Gemini
    function convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    }
});