document.addEventListener('DOMContentLoaded', function() {

    // ======================================================
    // 1. LÓGICA DE SCROLL Y REVEAL EN NAVEGACIÓN
    // ======================================================
    const sections = document.querySelectorAll("section, footer");
    const navLinks = document.querySelectorAll(".main-header nav a");
    const reveals = document.querySelectorAll(".reveal-on-scroll");

    function updateMenu() {
        let current = "";
        const scrollPosition = window.scrollY;

        sections.forEach((section) => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (scrollPosition >= (sectionTop - sectionHeight / 3)) {
                current = section.getAttribute("id");
            }
        });

        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 10) {
            current = "contacto";
        }

        navLinks.forEach((link) => {
            link.classList.remove("active");
            const href = link.getAttribute("href");
            if (href && href.includes(current)) {
                link.classList.add("active");
            }
        });
    }

    function reveal() {
        const windowHeight = window.innerHeight;
        const elementVisible = 80;

        reveals.forEach((reveal) => {
            const elementTop = reveal.getBoundingClientRect().top;
            if (elementTop < windowHeight - elementVisible) {
                reveal.classList.add("active");
            } else {
                reveal.classList.remove("active");
            }
        });
    }

    window.addEventListener("scroll", updateMenu);
    window.addEventListener("scroll", reveal);
    updateMenu();
    reveal();


    // ======================================================
    // 2. MENÚ RESPONSIVO PARA MÓVIL (BOTÓN HAMBURGUESA)
    // ======================================================
    const mobileToggle = document.getElementById("mobileToggle");
    const navMenu = document.getElementById("navMenu") || document.querySelector(".main-header nav");

    if (mobileToggle && navMenu) {
        // Toggle abrir / cerrar menú táctil
        mobileToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            navMenu.classList.toggle("active");
            const isOpen = navMenu.classList.contains("active");
            const icon = mobileToggle.querySelector("i");
            if (icon) {
                icon.className = isOpen ? "fas fa-times" : "fas fa-bars";
            }
        });

        // Cerrar menú al presionar cualquier enlace
        navLinks.forEach((link) => {
            link.addEventListener("click", () => {
                if (navMenu.classList.contains("active")) {
                    navMenu.classList.remove("active");
                    const icon = mobileToggle.querySelector("i");
                    if (icon) icon.className = "fas fa-bars";
                }
            });
        });

        // Cerrar menú al hacer clic fuera
        document.addEventListener("click", (e) => {
            if (!navMenu.contains(e.target) && !mobileToggle.contains(e.target) && navMenu.classList.contains("active")) {
                navMenu.classList.remove("active");
                const icon = mobileToggle.querySelector("i");
                if (icon) icon.className = "fas fa-bars";
            }
        });
    }


    // ======================================================
    // 3. ENVÍO DEL FORMULARIO DE CONTACTO AL BACKEND
    // ======================================================
    const contactForm = document.getElementById("publicContactForm");

    if (contactForm) {
        contactForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = document.getElementById("btnSendContact");
            const successMsg = document.getElementById("contactSuccessMessage");
            const originalText = btn ? btn.innerText : "Enviar Mensaje";

            if (btn) {
                btn.disabled = true;
                btn.innerText = "Enviando...";
            }
            if (successMsg) successMsg.style.display = "none";

            const payload = {
                name: document.getElementById("contactName")?.value.trim() || "",
                email: document.getElementById("contactEmail")?.value.trim() || "",
                phone: document.getElementById("contactPhone")?.value.trim() || "",
                message: document.getElementById("contactMessage")?.value.trim() || ""
            };

            try {
                const res = await fetch("https://wedding-web-lygz.onrender.com/api/contact", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    contactForm.reset();
                    if (successMsg) successMsg.style.display = "block";
                } else {
                    alert("¡Gracias por escribir! Te responderemos muy pronto.");
                }
            } catch (err) {
                console.error("Error al enviar formulario:", err);
                alert("¡Gracias por escribir! Nos pondremos en contacto contigo pronto.");
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            }
        });
    }


    // ======================================================
    // 4. CHATBOT PÚBLICO PARA INVITADOS / VISITANTES
    // ======================================================
    const chatbotToggler = document.querySelector("#chatbot-toggler");
    const chatbotContainer = document.querySelector("#chatbot-container");
    const closeChatBtn = document.querySelector(".close-chat-btn");
    const chatInput = document.querySelector("#chatbot-input");
    const sendChatBtn = document.querySelector("#send-button");
    const chatBox = document.querySelector("#chatbot-messages");
    const typingIndicator = document.querySelector("#typing-indicator");

    // 4.1 Base de Conocimiento Superficial
    const getBotResponse = (input) => {
        const lowerInput = input.toLowerCase();

        // Saludos
        if (lowerInput.includes("hola") || lowerInput.includes("buenos") || lowerInput.includes("buenas")) {
            return "¡Hola! Soy el asistente virtual de Andrea Figueroa. Estoy aquí para guiarte. ¿Estás buscando ayuda para planificar tu boda?";
        }

        // Servicios
        if (lowerInput.includes("servicios") || lowerInput.includes("hacen") || lowerInput.includes("paquetes") || lowerInput.includes("planificación")) {
            return "Ofrecemos planificación completa, parcial y coordinación del día del evento. Como cada boda es única, Andrea personaliza cada detalle. Te sugiero escribirle para ver qué se ajusta a ti.";
        }

        // Precios
        if (lowerInput.includes("precio") || lowerInput.includes("costo") || lowerInput.includes("cuesta") || lowerInput.includes("cotización") || lowerInput.includes("presupuesto")) {
            return "Los precios varían según la magnitud y los detalles de tu sueño. Para darte un valor exacto, Andrea necesita conocerte. ¡Escríbele directamente por WhatsApp para una cotización rápida!";
        }

        // Ubicación
        if (lowerInput.includes("donde") || lowerInput.includes("ubicación") || lowerInput.includes("ciudad") || lowerInput.includes("ecuador")) {
            return "Andrea Figueroa opera principalmente en Ecuador, creando bodas de ensueño en diversas locaciones. Si tienes un lugar en mente, ¡cuéntaselo!";
        }

        // Contacto / WhatsApp
        if (lowerInput.includes("contacto") || lowerInput.includes("celular") || lowerInput.includes("teléfono") || lowerInput.includes("whatsapp")) {
            return "Puedes contactar a Andrea directamente al +593 99 074 0574 o haciendo clic en el icono de WhatsApp en la esquina inferior.";
        }

        // Citas
        if (lowerInput.includes("cita") || lowerInput.includes("reunión") || lowerInput.includes("agendar")) {
            return "¡Me encanta esa idea! Las primeras citas son vitales para conectar. Por favor, envía un mensaje al WhatsApp para coordinar la agenda de Andrea.";
        }

        // Respuesta por defecto
        return "Esa es una excelente pregunta. Mi asesoría es inicial, pero Andrea es la experta en esos detalles. Te recomiendo contactarla directamente aquí: <a href='https://wa.me/593990740574' target='_blank' style='color: var(--accent); text-decoration: underline; font-weight: bold;'>Contactar por WhatsApp</a>";
    };

    // 4.2 Creador de Mensajes
    const createMessageLi = (message, className) => {
        const div = document.createElement("div");
        div.classList.add("message", className);
        div.innerHTML = message; 
        return div;
    };

    // 4.3 Manejador de Envíos del Chatbot
    const handleChat = () => {
        if (!chatInput || !chatBox) return;
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        // Añadir mensaje del usuario
        chatBox.appendChild(createMessageLi(userMessage, "user-message"));
        chatBox.scrollTop = chatBox.scrollHeight;
        chatInput.value = "";

        // Indicador "Escribiendo..."
        if (typingIndicator) typingIndicator.style.display = "block";
        chatBox.scrollTop = chatBox.scrollHeight;

        // Responder con retraso simulado
        setTimeout(() => {
            const botMessage = getBotResponse(userMessage);
            if (typingIndicator) typingIndicator.style.display = "none";
            chatBox.appendChild(createMessageLi(botMessage, "bot-message"));
            chatBox.scrollTop = chatBox.scrollHeight;
        }, 600); 
    };

    // Event Listeners del Chat
    if (chatbotToggler) {
        chatbotToggler.addEventListener("click", () => {
            chatbotContainer.classList.toggle("visible");
            chatbotToggler.classList.toggle("hidden");
            
            if (chatbotContainer.classList.contains("visible") && chatBox && chatBox.children.length === 0) {
                setTimeout(() => {
                    const welcomeMsg = "¡Hola! Bienvenida al espacio de Andrea Figueroa. ¿En qué puedo orientarte hoy brevemente antes de que hables con la experta?";
                    chatBox.appendChild(createMessageLi(welcomeMsg, "bot-message"));
                }, 300);
            }
        });
    }

    if (closeChatBtn) {
        closeChatBtn.addEventListener("click", () => {
            chatbotContainer.classList.remove("visible");
            chatbotToggler.classList.remove("hidden");
        });
    }

    if (sendChatBtn) sendChatBtn.addEventListener("click", handleChat);

    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleChat();
            }
        });
    }
});