(async function () {
    // configs
    const API_KEY = "";
    const MODEL_NAME = "gemini-2.5-flash"; // only change if limit reached
    const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}?key=${API_KEY}`;
    const GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    const GENERATION_CONFIG = { temperature: 0.0, maxOutputTokens: 8192, topP: 0.9, topK: 40 };
    const SAFETY_SETTINGS = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
    ];

    const SEL = {
        BLOCK: ".css-1erl2aq",
        Q_TEXT: ".css-gri5r8 .css-ybrhvy .css-g2bbpm",
        ANSWERS: ".css-1tfphom .css-ybrhvy",
        RADIO_GROUP: "div[role=radiogroup]",
        ITEM_TEXT: [".css-1f00xev .css-g2bbpm", ".css-2si5p7 .css-g2bbpm"],
        TARGET: ".css-gri5r8",
    };

    // test API
    async function testConfig() {
        console.log("Checking API configuration...");
        try {
            const response = await fetch(BASE_URL);
            const data = await response.json();
            if (response.ok) {
                console.log("✅ Configuration valid:", data.displayName || MODEL_NAME);
                return true;
            } else {
                console.error("❌ Configuration invalid:", data.error?.message || "Unknown error");
                alert(`API Error: ${data.error?.message || "Please check your API_KEY/MODEL_NAME."}`);
                return false;
            }
        } catch (error) {
            console.error("❌ Connection error:", error.message);
            return false;
        }
    }

    // data processing
    function extractDataFromBlock(block) {
        const qText = block.querySelector(SEL.Q_TEXT)?.textContent.replace(/\s+/g, " ").trim();
        const ansContainer = block.querySelector(SEL.ANSWERS);
        if (!qText || !ansContainer) return null;

        const isRadio = ansContainer.querySelector(SEL.RADIO_GROUP);
        const typeRaw = isRadio ? "radio" : "checkbox";
        const typeLabel = isRadio ? "Single Choice" : "Multiple Choice";

        const answers = [];
        SEL.ITEM_TEXT.forEach((sel) => {
            ansContainer.querySelectorAll(sel).forEach((el) => answers.push(el.textContent.replace(/\s+/g, " ").trim()));
        });

        return { qText, answers, typeRaw, typeLabel };
    }

    // inject control button
    function injectControlButtons() {
        const containerId = "gemini-controls-container";
        const oldContainer = document.getElementById(containerId);
        if (oldContainer) oldContainer.remove();

        const container = document.createElement("div");
        container.id = containerId;
        container.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px;";
        const btnStyle = `padding: 12px 20px; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: sans-serif; font-weight: bold; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: transform 0.2s;`;

        // button copy all
        const copyBtn = document.createElement("button");
        copyBtn.innerText = "Copy All Quizzes";
        copyBtn.style.cssText = btnStyle + "background: #0056b3;";
        copyBtn.onmouseover = () => (copyBtn.style.transform = "scale(1.05)");
        copyBtn.onmouseout = () => (copyBtn.style.transform = "scale(1)");
        copyBtn.onclick = () => {
            const blocks = document.querySelectorAll(SEL.BLOCK);
            let fullContent = "";
            blocks.forEach((block, index) => {
                const data = extractDataFromBlock(block);
                if (data) {
                    fullContent += `Question ${index + 1}: ${data.qText}\n`;
                    fullContent += `Type: ${data.typeLabel}\n`;
                    fullContent += `Options:\n${data.answers.map((a) => `[ ] ${a}`).join("\n")}\n\n`;
                    fullContent += "-----------------------------------\n\n";
                }
            });
            navigator.clipboard.writeText(fullContent).then(() => {
                const originalText = copyBtn.innerText;
                copyBtn.innerText = "✅ Copied!";
                copyBtn.style.background = "#28a745";
                setTimeout(() => {
                    copyBtn.innerText = originalText;
                    copyBtn.style.background = "#0056b3";
                }, 2000);
            });
        };

        // button reload
        const reloadBtn = document.createElement("button");
        reloadBtn.innerText = "🔄 Reload Page";
        reloadBtn.style.cssText = btnStyle + "background: #6c757d;";
        reloadBtn.onmouseover = () => (reloadBtn.style.transform = "scale(1.05)");
        reloadBtn.onmouseout = () => (reloadBtn.style.transform = "scale(1)");
        reloadBtn.onclick = () => location.reload();

        container.appendChild(reloadBtn);
        container.appendChild(copyBtn);
        document.body.appendChild(container);
    }

    // gemini prompt, batch questions
    async function callGeminiBatch(questionsData) {
        const instructionPrompt = ` You are a UX/UI expert and exam solver. I will provide a JSON array of questions. Your task is to analyze each question and select the correct option(s) from the provided "options" list. 
        **Requirements:**
            1. Return ONLY a valid JSON array. No Markdown formatting (like \`\`\`json), no explanations.
            2. The output JSON must strictly follow this structure:
                [
                    { "index": <number>, "correct_option": "<string>" }, // for radio/single choice
                    { "index": <number>, "correct_option": ["<string>", "<string>",... ] }, // for checkbox/multiple choice
                    ...
                ]
            3. For "radio" type, "correct_option" is a single string.
            4. For "checkbox" type, "correct_option" is an array of strings.
            5. The content of "correct_option" must MATCH EXACTLY with one of the provided options.`;
        const dataPrompt = `Here is the data:\n${JSON.stringify(questionsData, null, 2)}`;

        const requestBody = {
            contents: [
                { role: "user", parts: [{ text: instructionPrompt }] },
                { role: "user", parts: [{ text: dataPrompt }] },
            ],
            tools: [{ googleSearch: {} }],
            generationConfig: GENERATION_CONFIG,
            safetySettings: SAFETY_SETTINGS,
        };

        try {
            console.log("Sending batch request to Gemini...");
            const response = await fetch(GENERATE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
            const data = await response.json();
            if (data.error) return { error: `API Error: ${data.error.message}` };

            let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!resultText) {
                if (data.promptFeedback) return { error: "Blocked by Safety Filters" };
                return { error: "No candidate text found" };
            }

            resultText = resultText
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

            return JSON.parse(resultText);
        } catch (error) {
            return { error: `Network/Parsing Error: ${error.message}` };
        }
    }

    // render result
    function renderResult(target, result, isError = false) {
        const uiId = "gemini-result-ui";
        let ui = target.querySelector(`.${uiId}`);
        if (!ui) {
            ui = document.createElement("div");
            ui.className = uiId;
            ui.style.cssText = "margin-top:8px; padding:8px; border-radius:4px; font-family:sans-serif; font-size:14px;";
            target.appendChild(ui);
        }

        if (isError) {
            ui.innerHTML = `<strong>Error:</strong> ${result}`;
            ui.style.color = "red";
            ui.style.backgroundColor = "#ffe6e6";
            ui.style.border = "1px solid red";
        } else {
            // handle array
            const answerText = Array.isArray(result) ? result.join("; ") : result;
            ui.innerHTML = `<strong>Answer:</strong> ${answerText}`;
            ui.style.color = "darkgreen";
            ui.style.backgroundColor = "#e6fffa";
            ui.style.border = "1px solid green";
        }
    }

    // main execution process
    // test config
    const isConfigValid = await testConfig();
    if (!isConfigValid) {
        console.error("Stopping script execution due to invalid configuration.");
        return;
    }

    // inject control buttons
    injectControlButtons();

    // scrape data
    const blocks = document.querySelectorAll(SEL.BLOCK);
    console.log(`Found ${blocks.length} blocks.`);

    const questionsData = [];

    // extract data
    blocks.forEach((block, index) => {
        const target = block.querySelector(SEL.TARGET);
        if (!target) return;

        const ui = document.createElement("div");
        ui.className = "gemini-result-ui";
        ui.style.cssText = "margin-top:8px; padding:8px; background:#f0f0f0; border-radius:4px; font-family:sans-serif; font-size:14px; color:#666;";
        ui.innerText = "⏳ Adding to batch queue...";

        // remove old ui if exists
        const oldUi = target.querySelector(".gemini-result-ui");
        if (oldUi) oldUi.remove();
        target.appendChild(ui);

        const data = extractDataFromBlock(block);
        if (data) {
            questionsData.push({
                index: index + 1, // 1-based index
                question: data.qText,
                type: data.typeRaw,
                options: data.answers,
            });
            ui.innerText = "⏳ Batch Processing...";
        } else {
            ui.innerText = "⚠️ Skipping (No data)";
        }
    });

    if (questionsData.length === 0) {
        console.log("No valid questions found.");
        return;
    }

    // batch process prompts
    console.log("Payload:", questionsData);
    const batchResult = await callGeminiBatch(questionsData);

    // distribute results
    if (batchResult.error) {
        blocks.forEach((block) => {
            const target = block.querySelector(SEL.TARGET);
            if (target) renderResult(target, batchResult.error, true);
        });
    } else if (Array.isArray(batchResult)) {
        console.log("Batch Response:", batchResult);

        batchResult.forEach((item) => {
            const blockIndex = item.index - 1;
            if (blocks[blockIndex]) {
                const target = blocks[blockIndex].querySelector(SEL.TARGET);
                if (target) renderResult(target, item.correct_option, false);
            }
        });
        console.log("Distribution answers completed.");
    } else {
        console.error("Unexpected response format:", batchResult);
    }
})();
