const initApp = () => {
    // PDF Download Logic
    const downloadBtn = document.getElementById('download-pdf');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            // Simply trigger the browser's native print dialog
            // The @media print CSS handles the formatting
            window.print();
        });
    }

    // Photo Upload Logic
    const photoContainer = document.getElementById('cv-photo');
    const photoInput = document.getElementById('photo-upload');
    
    if (photoContainer && photoInput) {
        photoContainer.addEventListener('click', () => {
            photoInput.click();
        });

        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    let img = photoContainer.querySelector('img');
                    if (!img) {
                        img = document.createElement('img');
                        photoContainer.appendChild(img);
                    }
                    img.src = e.target.result;
                    photoContainer.classList.add('has-photo');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Optional: Prevent default Enter key behavior on single-line fields
    // to avoid messing up the layout
    const singleLineFields = document.querySelectorAll('.single-line');
    singleLineFields.forEach(field => {
        field.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                field.blur();
            }
        });
    });

    // Initialize AI Assistant
    initAIAssistant();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}


function initAIAssistant() {
    const toolbar = document.querySelector('.cv-toolbar');
    if (!toolbar) return;

    // 1. Inject Ask AI Button
    const askBtn = document.createElement('button');
    askBtn.className = 'btn-ai';
    askBtn.innerHTML = '✨ Ask AI';
    // Insert before download button
    const downloadBtn = document.getElementById('download-pdf');
    toolbar.insertBefore(askBtn, downloadBtn);

    // 2. Inject Chat Modal HTML
    const modalHtml = `
        <div id="ai-chat-modal" class="hidden">
            <div class="ai-header">
                <span>AI Assistant</span>
                <button id="ai-close-btn">&times;</button>
            </div>
            <div id="ai-chat-messages">
                <div class="ai-msg bot">Hi! I can help improve your CV text or generate LaTeX code. What would you like to do?</div>
            </div>
            <div class="ai-input-area">
                <textarea id="ai-prompt" rows="2" placeholder="e.g. Make my experience sound more professional..."></textarea>
                <div class="ai-actions">
                    <select id="ai-provider" title="Select AI Provider" style="font-size: 0.8rem; padding: 4px; border: 1px solid #d1d5db; border-radius: 2px;">
                        <option value="gemini">Gemini</option>
                        <option value="groq">Groq</option>
                    </select>
                    <input type="password" id="ai-api-key" placeholder="Gemini API Key" title="Enter your API Key">
                    <button id="ai-send-btn" class="btn-send">Send</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 3. Setup Logic
    const modal = document.getElementById('ai-chat-modal');
    const closeBtn = document.getElementById('ai-close-btn');
    const sendBtn = document.getElementById('ai-send-btn');
    const promptInput = document.getElementById('ai-prompt');
    const apiKeyInput = document.getElementById('ai-api-key');
    const chatMessages = document.getElementById('ai-chat-messages');
    const providerSelect = document.getElementById('ai-provider');

    // Handle provider change
    const updateProvider = () => {
        const provider = providerSelect.value;
        apiKeyInput.placeholder = provider === 'gemini' ? 'Gemini API Key' : 'Groq API Key';
        const savedKey = localStorage.getItem(`${provider}_api_key`);
        apiKeyInput.value = savedKey || '';
    };

    const savedProvider = localStorage.getItem('ai_provider');
    if (savedProvider) providerSelect.value = savedProvider;
    
    providerSelect.addEventListener('change', updateProvider);
    updateProvider();

    askBtn.addEventListener('click', () => {
        modal.classList.toggle('hidden');
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    const addMessage = (text, sender) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-msg ${sender}`;
        
        // Simple markdown code block parser
        if (text.includes('```')) {
            text = text.replace(/```(?:.*?)\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        }
        // Basic newline to <br> for plain text outside of <pre> (naive approach)
        // For simplicity, we just set innerHTML since we parsed the code block.
        // But let's handle newlines carefully so we don't break code blocks.
        // A better naive approach: 
        if (!text.includes('<pre>')) {
             text = text.replace(/\n/g, '<br>');
        }
        msgDiv.innerHTML = text;
        
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    sendBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        
        if (!prompt) return;
        if (!apiKey) {
            alert('Please enter your API Key to use the AI Assistant.');
            return;
        }

        const provider = providerSelect.value;
        localStorage.setItem(`${provider}_api_key`, apiKey);
        localStorage.setItem('ai_provider', provider);
        
        addMessage(prompt, 'user');
        promptInput.value = '';
        addMessage('Thinking...', 'bot');

        // Extract CV text context
        const cvText = document.querySelector('.page').innerText;
        const fullPrompt = `Here is the current text of my CV:\n\n${cvText}\n\nUser Request: ${prompt}`;

        try {
            let response;
            let botReply = '';

            if (provider === 'gemini') {
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: fullPrompt }] }]
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                botReply = data.candidates[0].content.parts[0].text;
            } else if (provider === 'groq') {
                response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'llama3-8b-8192',
                        messages: [{ role: 'user', content: fullPrompt }]
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                botReply = data.choices[0].message.content;
            }

            chatMessages.lastChild.remove();
            addMessage(botReply, 'bot');

        } catch (err) {
            chatMessages.lastChild.remove();
            addMessage(`Error: ${err.message || 'Check your internet or API key.'}`, 'bot');
            console.error(err);
        }
    });
}

// Initialize Context Menu for Deletion
const initContextMenu = () => {
    if (document.getElementById('cv-context-menu')) return; // Prevent duplicates

    const ctxMenu = document.createElement('div');
    ctxMenu.id = 'cv-context-menu';
    ctxMenu.innerHTML = '🗑️ Delete Item';
    document.body.appendChild(ctxMenu);

    // Create the hover delete button
    const hoverBtn = document.createElement('div');
    hoverBtn.id = 'cv-hover-delete';
    hoverBtn.innerHTML = '×';
    hoverBtn.title = 'Delete this item';
    document.body.appendChild(hoverBtn);

    let ctxTarget = null;
    let hoverTarget = null;
    const deletableSelector = 'tr, li, .section-title, .cv-section-title, .main-title, .sidebar-title, .section, .job-item, .timeline-item, .exp-header, .cv-table-no-border, .cv-section-title + div';

    const undoStack = [];

    const deleteElement = (el) => {
        if (!el) return;
        undoStack.push({
            parent: el.parentNode,
            nextSibling: el.nextSibling,
            element: el
        });
        el.remove();
    };

    // Global Undo Listener
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
            // If user is actively typing in a text field, let the browser handle native text undo
            if (document.activeElement && document.activeElement.isContentEditable) {
                return; 
            }
            
            if (undoStack.length > 0) {
                e.preventDefault(); // Prevent default browser behavior
                const last = undoStack.pop();
                if (last.nextSibling) {
                    last.parent.insertBefore(last.element, last.nextSibling);
                } else {
                    last.parent.appendChild(last.element);
                }
            }
        }
    });

    // Hover logic
    document.addEventListener('mouseover', (e) => {
        const deletable = e.target.closest(deletableSelector);
        
        if (deletable && !deletable.closest('.cv-toolbar') && !deletable.classList.contains('page') && deletable.tagName !== 'BODY' && deletable.tagName !== 'HTML') {
            hoverTarget = deletable;
            const rect = deletable.getBoundingClientRect();
            hoverBtn.style.display = 'block';
            
            // Position at top right of the element
            // Adding scroll offsets to handle scrolled pages
            hoverBtn.style.top = (rect.top + window.scrollY - 10) + 'px';
            hoverBtn.style.left = (rect.right + window.scrollX - 10) + 'px';
        } else if (e.target !== hoverBtn) {
            hoverBtn.style.display = 'none';
        }
    });

    hoverBtn.addEventListener('click', () => {
        if (hoverTarget) {
            deleteElement(hoverTarget);
            hoverBtn.style.display = 'none';
        }
    });

    // Right-click logic (kept as fallback)
    document.addEventListener('contextmenu', (e) => {
        const deletable = e.target.closest(deletableSelector);
        
        if (!deletable || deletable.closest('.cv-toolbar') || deletable.classList.contains('page') || deletable.tagName === 'BODY' || deletable.tagName === 'HTML') {
            return;
        }

        e.preventDefault();
        ctxTarget = deletable;
        
        ctxMenu.style.display = 'block';
        ctxMenu.style.left = e.pageX + 'px';
        ctxMenu.style.top = e.pageY + 'px';
    });

    document.addEventListener('click', (e) => {
        if (e.target !== ctxMenu) {
            ctxMenu.style.display = 'none';
        }
    });

    ctxMenu.addEventListener('click', () => {
        if (ctxTarget) {
            deleteElement(ctxTarget);
            ctxMenu.style.display = 'none';
        }
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContextMenu);
} else {
    initContextMenu();
}
