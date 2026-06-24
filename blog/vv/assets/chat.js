document.addEventListener("DOMContentLoaded", () => {
    // Inject HTML
    const chatHtml = `
        <div id="chat-toggle" title="Chat con AI">💬</div>
        <div id="chat-sidebar">
            <div id="chat-sidebar-header">
                <span>AI Tutor</span>
                <button id="chat-sidebar-close">✖</button>
            </div>
            <div id="chat-messages">
                <div class="chat-msg bot">Ciao! Sono il tuo tutor AI. Fammi pure domande sul testo che stai leggendo.</div>
            </div>
            <div id="chat-input-area">
                <input type="text" id="chat-input" placeholder="Chiedi qualcosa..." />
                <button id="chat-send">Invia</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatHtml);

    const toggleBtn = document.getElementById('chat-toggle');
    const closeBtn = document.getElementById('chat-sidebar-close');
    const sendBtn = document.getElementById('chat-send');
    const inputEl = document.getElementById('chat-input');
    const messagesEl = document.getElementById('chat-messages');

    toggleBtn.addEventListener('click', () => {
        document.body.classList.add('chat-active');
        toggleBtn.style.display = 'none';
        inputEl.focus();
    });

    closeBtn.addEventListener('click', () => {
        document.body.classList.remove('chat-active');
        toggleBtn.style.display = 'flex';
    });

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${sender}`;
        msgDiv.textContent = text;
        messagesEl.appendChild(msgDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // Cronologia dei messaggi per la chat
    let chatHistory = [];

    async function handleSend() {
        const text = inputEl.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        inputEl.value = '';

        let apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            apiKey = prompt("Per usare l'assistente AI locale, inserisci la tua API Key di Gemini (verrà salvata nel browser):");
            if (apiKey) {
                localStorage.setItem('gemini_api_key', apiKey);
            } else {
                addMessage("⚠️ API Key necessaria per rispondere. Ricarica la pagina per riprovare.", "bot");
                return;
            }
        }

        // Estrai il contesto principale della pagina (limitato per non superare token limits in modo naive)
        const contentContainer = document.querySelector('.wrap') || document.body;
        const pageContent = contentContainer.innerText.substring(0, 5000); 
        
        // Costruisci i messaggi
        if (chatHistory.length === 0) {
            chatHistory.push({
                role: "user",
                parts: [{ text: `Sei un tutor universitario esperto. Usa il seguente testo tratto dai miei appunti per rispondere alle domande. Cerca di essere chiaro e conciso. Rispondi in italiano.\n\nTESTO DELLA PAGINA:\n${pageContent}` }]
            });
            chatHistory.push({
                role: "model",
                parts: [{ text: "Ricevuto. Sono pronto a rispondere alle tue domande sul testo." }]
            });
        }

        chatHistory.push({ role: "user", parts: [{ text }] });

        try {
            const botMsgDiv = document.createElement('div');
            botMsgDiv.className = 'chat-msg bot';
            botMsgDiv.textContent = "Sto pensando...";
            messagesEl.appendChild(botMsgDiv);
            messagesEl.scrollTop = messagesEl.scrollHeight;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: chatHistory })
            });

            if (!response.ok) {
                if (response.status === 400 || response.status === 403) {
                    localStorage.removeItem('gemini_api_key');
                    throw new Error("API Key non valida o permessi negati. Ho rimosso la chiave, ricarica la pagina e reinseriscila.");
                }
                throw new Error(\`Errore HTTP: \${response.status}\`);
            }

            const data = await response.json();
            const botReply = data.candidates[0].content.parts[0].text;
            
            botMsgDiv.textContent = botReply;
            chatHistory.push({ role: "model", parts: [{ text: botReply }] });
            
        } catch (error) {
            console.error(error);
            messagesEl.lastChild.textContent = "❌ " + error.message;
            // Rimuovi l'ultimo messaggio user per permettere il retry
            chatHistory.pop();
        }
    }

    sendBtn.addEventListener('click', handleSend);
    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
});