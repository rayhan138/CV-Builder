document.addEventListener('DOMContentLoaded', () => {
    const importBtn = document.getElementById('btn-run-import');
    if (!importBtn) return; // Only run on index.html

    const importText = document.getElementById('import-text');
    const importProvider = document.getElementById('import-provider');
    const importApiKey = document.getElementById('import-api-key');
    const importTarget = document.getElementById('import-target');
    const importStatus = document.getElementById('import-status');

    // Load saved API key if exists
    const savedKey = localStorage.getItem('cv_api_key');
    const savedProvider = localStorage.getItem('cv_api_provider');
    if (savedKey) importApiKey.value = savedKey;
    if (savedProvider) importProvider.value = savedProvider;

    importBtn.addEventListener('click', async () => {
        const text = importText.value.trim();
        const provider = importProvider.value;
        const apiKey = importApiKey.value.trim();
        const targetUrl = importTarget.value;

        if (!text) {
            alert('Please paste some LaTeX or text first!');
            return;
        }

        if (targetUrl === 'pdf-compiler') {
            // Direct LaTeX compilation (Zero Backend Method)
            importBtn.disabled = true;
            importBtn.innerText = 'Opening Compiler...';
            const encodedText = encodeURIComponent(text);
            const compilerUrl = `https://latexonline.cc/compile?text=${encodedText}`;
            window.open(compilerUrl, '_blank');
            setTimeout(() => {
                importBtn.disabled = false;
                importBtn.innerText = '✨ Convert & Open Template';
            }, 2000);
            return;
        }

        if (!apiKey) {
            alert('Please enter your API key!');
            return;
        }

        // Save preferences
        localStorage.setItem('cv_api_key', apiKey);
        localStorage.setItem('cv_api_provider', provider);

        try {
            importBtn.disabled = true;
            importStatus.style.display = 'block';
            importStatus.innerText = 'Step 1: Fetching template...';

            // 1. Fetch the raw HTML of the selected template
            const tmplRes = await fetch(targetUrl);
            const tmplHtml = await tmplRes.text();

            // Extract just the .page div to save AI tokens and prevent breaking the whole doc
            const parser = new DOMParser();
            const doc = parser.parseFromString(tmplHtml, 'text/html');
            const pageDiv = doc.querySelector('.page');
            if (!pageDiv) throw new Error('Could not find .page container in template.');

            const templateCode = pageDiv.outerHTML;

            importStatus.innerText = 'Step 2: AI is generating your CV... (this takes 10-20s)';

            let systemPrompt = '';
            
            if (targetUrl === 'template-custom.html') {
                // Completely dynamic generation
                systemPrompt = `You are an expert web developer and CV designer. 
Here is a raw LaTeX or text CV from a user:
<USER_CV>
${text}
</USER_CV>

TASK:
1. Convert this CV into a complete, beautifully styled HTML layout.
2. Attempt to mimic the visual design, margins, and typography that was intended in the LaTeX code (e.g. if it uses tables, make tables; if it uses two columns, use CSS flexbox).
3. EVERY text element MUST have the attribute \`contenteditable="true"\` so the user can edit it.
4. Use inline CSS for all styling. Use modern, professional colors and fonts.
5. Do NOT add any markdown formatting (like \`\`\`html). Return ONLY the raw HTML code. Do NOT wrap it in <html> or <body> tags. Just return the raw elements that will be injected directly into a <div class="page"> container.`;
            } else {
                // Standard injection into predefined templates
                systemPrompt = `You are an expert CV converter. 
Here is a raw LaTeX or text CV from a user:
<USER_CV>
${text}
</USER_CV>

Here is the HTML code for the target CV template:
<HTML_TEMPLATE>
${templateCode}
</HTML_TEMPLATE>

TASK:
1. Extract the user's data from their CV.
2. Inject it exactly into the \`contenteditable="true"\` fields of the HTML template.
3. You MUST keep the exact HTML structure, classes, styles, and IDs.
4. You MAY duplicate repeating elements (like <tr>, <li>, or job sections) if the user has multiple jobs/degrees.
5. Do NOT add any markdown formatting (like \`\`\`html) to your response. Return ONLY the raw HTML code starting with <div class="page"> and ending with </div>.`;
            }

            let generatedHtml = '';

            if (provider === 'gemini') {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: systemPrompt }] }],
                        generationConfig: { temperature: 0.2 }
                    })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error.message);
                generatedHtml = data.candidates[0].content.parts[0].text;
            } else if (provider === 'groq') {
                const res = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.1-8b-instant',
                        messages: [{ role: 'user', content: systemPrompt }],
                        temperature: 0.2
                    })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error.message);
                generatedHtml = data.choices[0].message.content;
            }

            // Clean up markdown if the AI mistakenly added it
            generatedHtml = generatedHtml.replace(/```html/gi, '').replace(/```/g, '').trim();

            importStatus.innerText = 'Step 3: Opening your new CV...';

            // 3. Save to sessionStorage and redirect
            sessionStorage.setItem('imported_cv_html', generatedHtml);
            window.location.href = targetUrl + '?import=true';

        } catch (err) {
            console.error(err);
            alert(`Error during import: ${err.message}`);
            importBtn.disabled = false;
            importStatus.style.display = 'none';
        }
    });
});
