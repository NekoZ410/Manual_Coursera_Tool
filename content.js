// global: html selectors
const SELECTORS = {
    MAIN_WRAPPER: "TUNNELVISIONWRAPPER_CONTENT_ID",
    QUIZ_BLOCK: "css-1erl2aq",
    QUESTION_BLOCK: "css-gri5r8",
    QUESTION_CONTENT: "css-g2bbpm",
    ANSWERS_BLOCK: "css-1tfphom",
    ANSWER_ITEM: "css-1f00xev",
    ANSWER_CONTENT: "css-g2bbpm",
};

// global: Gemini API call
async function callGeminiAPI(question, answers, apiKey, modelName, targetElement, avoidAnswer = null) {
    let uiContainer = targetElement.querySelector(".csr-manual-guess-container");
    if (uiContainer) {
        const errorP = uiContainer.querySelector(".gemini-error-paragraph");
        const successP = uiContainer.querySelector(".gemini-success-paragraph");
        const successSpan = uiContainer.querySelector(".gemini-success-content");

        if (errorP) errorP.style.display = "none";
        if (successP) successP.style.display = "block";
        if (successSpan) successSpan.textContent = "Solving...";
    }

    const answersString = answers.join(", "); // concatenate answers
    let promptText = `You are a question answering AI. Your job is to read and analyze the question requirements and provide the correct answer as per the requirement of the question. If there are multiple answers, separate them with commas. Do not add any explanation. The options are: (${answersString})`;

    if (avoidAnswer) {
        promptText += `\n\nThis is the previous wrong answer, avoid it: ${avoidAnswer}`;
        console.log(`Constraint added: Avoid "${avoidAnswer}"`);
    }

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [{ text: promptText }],
            },
            {
                role: "user",
                parts: [{ text: `Question: (${question})` }],
            },
        ],
        generationConfig: {
            temperature: 0.0, // creativity level, 0 = most precise
            maxOutputTokens: 250, // maximum tokens in response
            topP: 0.9, // probability threshold, 0.9 = most likely
            topK: 40, // token selection pool size
            // stopSequences: ["\n", "."], // stop generating when these sequences are encountered
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
    // console.log("REQUEST BODY:", JSON.stringify(requestBody, null, 2)); // DEBUG

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

        if (data.error) {
            if (targetElement) {
                injectOrUpdateResultUI(targetElement, null, question, answers, apiKey, modelName, data.error.message);
            }
            return null;
        }
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("RESPONSE RESULT:", resultText); // DEBUG

        if (resultText) {
            if (targetElement) {
                injectOrUpdateResultUI(targetElement, resultText, question, answers, apiKey, modelName);
            } else {
                console.warn("Cannot find question block to inject result.");
            }
        }

        return resultText;
    } catch (error) {
        console.error("API Error:", error);
        return null;
    }
}

// global: inject or update result UI
function injectOrUpdateResultUI(targetElement, resultText, question, answers, apiKey, modelName, errorMessage = null) {
    let container = targetElement.querySelector(".csr-manual-guess-container");

    if (!container) {
        container = document.createElement("div");
        container.className = "csr-manual-guess-container border border-success border-5";
        targetElement.appendChild(container);
    }

    const isError = !!errorMessage;
    const successDisplay = isError ? "none" : "block";
    const errorDisplay = isError ? "block" : "none";

    // container content
    container.innerHTML = `
        <div class="gemini-guess font-weight-bold px-2 my-2">
            <p class="gemini-success-paragraph" style="display: ${successDisplay}; margin-bottom: 0;">
                Gemini guess: <span class="text-success gemini-success-content">${resultText || ""}</span>
            </p>
            <p class="gemini-error-paragraph" style="display: ${errorDisplay}; margin-bottom: 0;">
                Error: <span class="text-danger gemini-error-content">${errorMessage || ""}</span>
            </p>
        </div>
        <div class="font-weight-bold px-2 my-2" style="display: flex; gap: 10px;">
            <button class="btn-resolve" style="padding: 6px 12px; background: dodgerblue; color: white; border-radius: 5px; border:none; cursor:pointer;">
                <h6>Re-solve this question</h6>
            </button>
            <button class="btn-copy" style="padding: 6px 12px; background: forestgreen; color: white; border-radius: 5px; border:none; cursor:pointer;">
                <h6>Copy question & answers</h6>
            </button>
        </div>
    `;

    const resolveBtn = container.querySelector(".btn-resolve");
    const copyBtn = container.querySelector(".btn-copy");

    // resolve click
    resolveBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log("Re-solving...");

        let currentWrongAnswer = null;
        const successSpan = container.querySelector(".gemini-success-content");
        const successP = container.querySelector(".gemini-success-paragraph");
        
        if (successP && successP.style.display !== "none" && successSpan && successSpan.textContent.trim() !== "") {
            currentWrongAnswer = successSpan.textContent.trim();
        }

        await callGeminiAPI(question, answers, apiKey, modelName, targetElement, currentWrongAnswer);
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
function waitForElement(id, timeout = 120000) {
    // default timeout 120s
    return new Promise((resolve) => {
        if (document.getElementById(id)) {
            return resolve(document.getElementById(id));
        }

        const observer = new MutationObserver((mutations) => {
            if (document.getElementById(id)) {
                observer.disconnect();
                resolve(document.getElementById(id));
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            console.warn(`Timeout: Element #${id} not found after ${timeout}ms.`);
            resolve(null);
        }, timeout);
    });
}

// global: quiz solving
async function processQuizzes(wrapper, apiKey, modelName, intervalTime = 2500) {
    console.log("Wrapper detected, extracting data from ALL quizzes...");

    const quizBlocks = Array.from(wrapper.querySelectorAll(`.${SELECTORS.QUIZ_BLOCK}`));
    if (quizBlocks.length === 0) {
        console.warn("No quiz blocks found.");
        return;
    }
    console.log(`Found ${quizBlocks.length} questions.`);

    for (const [index, quizEl] of quizBlocks.entries()) {
        // query question text relative to the current quiz element
        const questionSelectorString = `.${SELECTORS.QUESTION_BLOCK} .${SELECTORS.QUESTION_CONTENT} p span span`;
        const questionEl = quizEl.querySelector(questionSelectorString);
        const questionText = questionEl ? questionEl.innerText : null;

        if (!questionText) {
            console.warn(`Skipping Question #${index + 1}: Text not found.`);
            continue;
        }

        // query answers text relative to the current quiz element
        const answers = [];
        const answersBlock = quizEl.querySelector(`.${SELECTORS.ANSWERS_BLOCK}`);
        if (answersBlock) {
            const answerItems = answersBlock.querySelectorAll(`.${SELECTORS.ANSWER_ITEM}`);
            answerItems.forEach((item) => {
                const answerTextEl = item.querySelector(`.${SELECTORS.ANSWER_CONTENT} p span span`);
                if (answerTextEl) answers.push(answerTextEl.innerText);
            });
        }

        const targetInjectionBlock = quizEl.querySelector(`.${SELECTORS.QUESTION_BLOCK}`);

        // check if already answered
        if (targetInjectionBlock.querySelector(".csr-manual-guess-container")) {
            console.log(`Question #${index + 1} already answered. Skipping.`);
            continue;
        }

        console.log(`Processing Q${index + 1}: ${questionText.substring(0, 30)}...`);

        // API call
        if (apiKey) {
            await callGeminiAPI(questionText, answers, apiKey, modelName, targetInjectionBlock);
            console.log(`Waiting ${intervalTime}ms before next question...`);
            await new Promise((resolve) => setTimeout(resolve, intervalTime));
        } else {
            console.warn("API Key not found.");
            break; // stop processing if no API key
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

        const wrapper = await waitForElement(SELECTORS.MAIN_WRAPPER);
        if (wrapper) {
            processQuizzes(wrapper, apiKey, modelName, intervalTime);
        } else {
            console.error("Stopped execution: Main wrapper not found.");
        }
    });
}
