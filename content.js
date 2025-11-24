// global: html selectors
const SELECTORS = {
    MAIN_QUIZ_CONTAINER: [".css-1h9exxh", ".css-1q19euh", ".css-k546vy"],
    QUIZ_BLOCK: ".css-1erl2aq",
    QUESTION_CONTAINER_TEXT: ".css-gri5r8 .css-ybrhvy .css-g2bbpm",

    ANSWERS_CONTAINER: ".css-1tfphom .css-ybrhvy",
    RADIO_GROUP: "div[role=radiogroup]",
    RADIO_ITEM_TEXT: ".css-1f00xev .css-g2bbpm",
    CHECKBOX_GROUP: "div[role=group]",
    CHECKBOX_ITEM_TEXT: ".css-2si5p7 .css-g2bbpm",

    INJECTION_POINT: ".css-gri5r8", // container injection point

    HEADER_TYPE_1: ".css-j3t1im",
    HEADER_TYPE_1_TARGET: ".css-1amwc74",
    HEADER_TYPE_2: ".css-w4x7ls",
    HEADER_TYPE_2_TARGET: ".cds-FullscreenDialogHeader-slot1",
};

// global: get clean text from content elements
function getCleanText(element) {
    if (!element) return null;
    return element.textContent.replace(/\s+/g, " ").trim();
}

// global: Gemini API call
async function callGeminiAPI(question, answers, apiKey, modelName, targetElement, questionType, avoidAnswer = null) {
    let uiContainer = targetElement.querySelector(".csr-manual-guess-container");
    if (uiContainer) {
        const errorP = uiContainer.querySelector(".gemini-error-paragraph");
        const successP = uiContainer.querySelector(".gemini-success-paragraph");
        const successSpan = uiContainer.querySelector(".gemini-success-content");

        if (errorP) errorP.style.display = "none";
        if (successP) successP.style.display = "block";
        if (successSpan) successSpan.textContent = "Solving...";
    }

    const answersString = answers.map((answer) => `"${answer}"`).join(", ");
    let instructionPrompt = `You are a question answering AI. Your job is to read and analyze the question's requirements and give the correct answer(s). DON'T add any further explaination. The answer(s) MUST be in the following list of options only: ${answersString}.`;

    // avoid repeating previous unreasonable answer
    if (avoidAnswer) {
        instructionPrompt += `\nHere is the previous answer which I find unreasonable, MUST RECONSIDER before giving the next answer(s): "${avoidAnswer}".`;
        console.log("Re-solving with constraint: Avoid", avoidAnswer);
    }

    let questionPrompt = `Question: "${question}"`;
    if (questionType === "radio") {
        questionPrompt += " (Radio choice, choose only 1).";
    } else if (questionType === "checkbox") {
        questionPrompt += " (Multiple choice, separate by comma).";
    }

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [{ text: instructionPrompt }],
            },
            {
                role: "user",
                parts: [{ text: questionPrompt }],
            },
        ],
        tools: [
            {
                googleSearch: {}, // enable Google Search tool
            },
        ],
        generationConfig: {
            temperature: 0.0, // creativity level, 0 = most precise
            maxOutputTokens: 250, // maximum tokens in response
            topP: 0.9, // probability threshold, 0.9 = most likely
            topK: 40, // token selection pool size
            // stopSequences: ["\n", "."], // stop generating encountered
        },
        safetySettings: [
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_LOW_AND_ABOVE",
            },
        ],
    };
    const quizString = {
        instruction: instructionPrompt,
        question: questionPrompt,
        answers: answersString,
        avoid: avoidAnswer,
    };
    console.log("REQUEST BODY:", quizString); // DEBUG

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`; // endpoint URL
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        // console.log("RESPONSE DATA:", data); // DEBUG

        // handle errors
        if (data.error) {
            if (targetElement) {
                injectOrUpdateResultUI(targetElement, null, question, answers, apiKey, modelName, data.error.message);
            }
            return null;
        }
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("RESPONSE RESULT:", resultText); // DEBUG

        // inject or update UI
        if (resultText) {
            if (targetElement) {
                injectOrUpdateResultUI(targetElement, resultText, question, answers, apiKey, modelName);
            } else {
                console.warn("Cannot find question block to inject result.");
            }
        }

        return resultText;
    } catch (error) {
        console.error("API Error:", error); // log API error
        return null;
    }
}

// global: inject or update result UI
function injectOrUpdateResultUI(targetElement, resultText, question, answers, apiKey, modelName, errorMessage = null) {
    let container = targetElement.querySelector(".csr-manual-guess-container");

    if (!container) {
        container = document.createElement("div");
        container.className = "manual-coursera-tool-container border border-success border-5";
        targetElement.appendChild(container);
    }

    const isError = !!errorMessage;
    const successDisplay = isError ? "none" : "block";
    const errorDisplay = isError ? "block" : "none";

    // container content
    container.innerHTML = `
        <div class="font-weight-bold px-2 my-2" style="display: flex; gap: 10px;">
            <button class="btn-resolve" style="padding: 6px 12px; background: dodgerblue; color: white; border-radius: 5px; border:none; cursor:pointer;">
                <h6>Re-solve this question</h6>
            </button>
            <button class="btn-copy" style="padding: 6px 12px; background: forestgreen; color: white; border-radius: 5px; border:none; cursor:pointer;">
                <h6>Copy question & answers</h6>
            </button>
        </div>
        <div class="gemini-guess font-weight-bold px-2 my-2">
            <p class="gemini-success-paragraph" style="display: ${successDisplay}; margin-bottom: 0;">
                Gemini guess: <span class="text-success gemini-success-content">${resultText || ""}</span>
            </p>
            <p class="gemini-error-paragraph" style="display: ${errorDisplay}; margin-bottom: 0;">
                Error: <span class="text-danger gemini-error-content">${errorMessage || ""}</span>
            </p>
        </div>
    `;

    const resolveBtn = container.querySelector(".btn-resolve");
    const copyBtn = container.querySelector(".btn-copy");

    // resolve click
    resolveBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log("Re-solving...");
        let type = "radio"; // default
        const answersBlock = targetElement.parentElement.querySelector(SELECTORS.ANSWERS_CONTAINER); // targetElement is QUESTION_BLOCK
        if (answersBlock && answersBlock.querySelector(SELECTORS.CHECKBOX_GROUP)) {
            type = "checkbox";
        }

        // cache previous answer
        let previousWrongAnswer = null;
        const successSpan = container.querySelector(".gemini-success-content");
        const successP = container.querySelector(".gemini-success-paragraph");

        // only cache if previous answer was available
        if (successP && successP.style.display !== "none" && successSpan && successSpan.textContent) {
            previousWrongAnswer = successSpan.textContent.trim();
        }

        await callGeminiAPI(question, answers, apiKey, modelName, targetElement, type, previousWrongAnswer);
    });

    // copy click
    copyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const copyContent = `${question}\n\n${answers.join("\n")}`;
        navigator.clipboard
            .writeText(copyContent)
            .then(() => {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = "<h6>Copied!</h6>";
                setTimeout(() => (copyBtn.innerHTML = originalText), 2000);
            })
            .catch((err) => console.error("Copy failed:", err));
    });
}

// global: wait for element to appear
function waitForElement(selectors, timeout = 120000) {
    // default timeout 120s
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];

    return new Promise((resolve) => {
        for (const selector of selectorList) {
            const element = document.querySelector(selector);
            if (element) {
                return resolve(element);
            }
        }

        const observer = new MutationObserver((mutations) => {
            for (const selector of selectorList) {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                    return;
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            console.warn(`Timeout: None of the containers [${selectorList.join(", ")}] found after ${timeout}ms.`);
            resolve(null);
        }, timeout);
    });
}

// global: quiz solving
async function processQuizzes(mainQuizContainer, apiKey, modelName, intervalTime = 2500) {
    console.log("Main quiz container detected, extracting data from ALL quizzes...");

    const quizBlocks = Array.from(mainQuizContainer.querySelectorAll(SELECTORS.QUIZ_BLOCK));
    if (quizBlocks.length === 0) {
        console.warn("No quiz blocks found.");
        return;
    }
    console.log(`Found ${quizBlocks.length} questions.`);

    for (const [index, quizEl] of quizBlocks.entries()) {
        // extract question text
        const questionEl = quizEl.querySelector(SELECTORS.QUESTION_CONTAINER_TEXT);
        const questionText = getCleanText(questionEl);

        if (!questionText) {
            console.warn(`Skipping Question #${index + 1}: Text not found.`);
            continue;
        }

        // detect radio or checkbox question and extract answers
        const answers = [];
        let questionType = "unknown";
        const answersContainer = quizEl.querySelector(SELECTORS.ANSWERS_CONTAINER);

        if (answersContainer) {
            // radio group
            if (answersContainer.querySelector(SELECTORS.RADIO_GROUP)) {
                questionType = "radio";
                const items = answersContainer.querySelectorAll(SELECTORS.RADIO_ITEM_TEXT);
                items.forEach((el) => answers.push(getCleanText(el)));
            }
            // checkbox group
            else if (answersContainer.querySelector(SELECTORS.CHECKBOX_GROUP)) {
                questionType = "checkbox";
                const items = answersContainer.querySelectorAll(SELECTORS.CHECKBOX_ITEM_TEXT);
                items.forEach((el) => answers.push(getCleanText(el)));
            }
        }

        if (answers.length === 0) {
            console.warn(`Skipping Question #${index + 1}: No answer choices found or unknown type.`);
            continue;
        }

        const targetInjectionBlock = quizEl.querySelector(SELECTORS.INJECTION_POINT);

        // check if already answered
        if (targetInjectionBlock.querySelector(".csr-manual-guess-container")) {
            console.log(`Question #${index + 1} already answered. Skipping.`);
            continue;
        }

        console.log(`Processing Q${index + 1} (${questionType}): ${questionText.substring(0, 30)}...`);

        // API call
        if (apiKey) {
            await callGeminiAPI(questionText, answers, apiKey, modelName, targetInjectionBlock, questionType);
            console.log(`Waiting ${intervalTime}ms before next question...`);
            await new Promise((resolve) => setTimeout(resolve, intervalTime));
        } else {
            console.warn("API Key not found.");
            break;
        }
    }

    console.log("All quizzes processed!");
}

// global: message listener for starting the solving process
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_solving") {
        console.log("Starting quizzes solver...");
        runSolver();
        sendResponse({ status: "started" });
    }
});

// global: main solver function
async function runSolver() {
    chrome.storage.local.get(["geminiApiKey", "geminiModel", "requestInterval"], async (result) => {
        const apiKey = result.geminiApiKey;
        const modelName = result.geminiModel || "gemini-2.0-flash-lite";
        const intervalTime = result.requestInterval || 2500; // default interval

        if (!apiKey) {
            console.warn("API Key not found. Please check your settings.");
            alert("Please enter API Key in the extension popup.");
            return;
        } else {
            console.log(`API Key found. Model: ${modelName}. Interval: ${intervalTime}ms.`);
        }

        const mainQuizContainer = await waitForElement(SELECTORS.MAIN_QUIZ_CONTAINER);
        if (mainQuizContainer) {
            processQuizzes(mainQuizContainer, apiKey, modelName, intervalTime);
        } else {
            console.error("Stopped execution: Main quiz container not found.");
        }
    });
}

// ---------- ---------- ---------- ---------- ----------
// global: create injecting solve button
function createSolveButtonUI() {
    const btn = document.createElement("button");
    btn.innerHTML = `Solve Quizzes`;
    btn.style.cssText = `
        background: linear-gradient(135deg, #28a745, #218838);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        font-weight: 600;
        cursor: pointer;
        font-family: 'Source Sans Pro', Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        transition: transform 0.1s ease, box-shadow 0.1s ease;
    `;
    btn.onmouseover = () => {
        btn.style.transform = "translateY(-1px)";
        btn.style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
    };
    btn.onmouseout = () => {
        btn.style.transform = "translateY(0)";
        btn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
    };

    // click event
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Starting quizzes solver...");
        runSolver();
    });
    return btn;
}

// global: inject solve button into page UI
function injectPageSolveButton() {
    // type 1: .css-j3t1im
    const headerType1 = document.querySelector(SELECTORS.HEADER_TYPE_1);
    if (headerType1 && !headerType1.querySelector(".manual-coursera-tool-solve")) {
        const target = headerType1.querySelector(SELECTORS.HEADER_TYPE_1_TARGET);
        if (target) {
            target.style.setProperty("max-width", "30%", "important"); // override inline style

            const container = document.createElement("div");
            container.className = "cds-1 css-1amwc74 cds-3 cds-grid-item cds-48 cds-72 cds-87 manual-coursera-tool-solve";
            container.style.cssText = "max-width: 30%; text-align: center; display: flex; align-items: center; justify-content: center;";
            container.appendChild(createSolveButtonUI());

            target.parentNode.insertBefore(container, target.nextSibling);
            console.log("Injected Solve Button (Type 1)");
        }
    }

    // type 2: .css-w4x7ls
    const headerType2 = document.querySelector(SELECTORS.HEADER_TYPE_2);
    if (headerType2 && !headerType2.querySelector(".manual-coursera-tool-solve")) {
        const target = headerType2.querySelector(SELECTORS.HEADER_TYPE_2_TARGET);
        if (target) {
            const container = document.createElement("div");
            container.className = "cds-FullscreenDialogHeader-slot1 manual-coursera-tool-solve";
            container.style.cssText = "text-align: center; display: flex; align-items: center; justify-content: center; margin-left: 10px;";
            container.appendChild(createSolveButtonUI());

            target.parentNode.insertBefore(container, target.nextSibling);
            console.log("Injected Solve Button (Type 2)");
        }
    }
}

// global: auto init button injection on page load
(function autoInit() {
    console.log("Extension content script loaded. Observing for UI headers...");

    injectPageSolveButton();
    const observer = new MutationObserver(() => {
        injectPageSolveButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
