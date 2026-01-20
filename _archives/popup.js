// global: display info from manifest
(function () {
    const manifest = chrome.runtime.getManifest(); // get manifest object
    const versionElement = document.getElementById("ext-ver");
    if (versionElement) versionElement.textContent = manifest.version; // extension version
    const nameElement = document.getElementById("ext-name");
    if (nameElement) nameElement.textContent = manifest.name; // extension name
    document.title = manifest.name; // set popup HTML title
    const repoLink = document.getElementById("ext-repo");
    if (repoLink && manifest.homepage_url) repoLink.href = manifest.homepage_url; // extension repo URL
})();

// global: configuration saving and loading
document.addEventListener("DOMContentLoaded", () => {
    const apiKeyInput = document.getElementById("apiKeyInput");
    const modelNameInput = document.getElementById("modelNameInput");
    const intervalTimeInput = document.getElementById("intervalTimeInput");
    const saveBtn = document.getElementById("btn-save");
    const solveBtn = document.getElementById("btn-solve");
    const statusDiv = document.getElementById("status");

    const apiKeyInstructionsBtn = document.getElementById('apiKeyInstructionsBtn');
    const modelInstructionsBtn = document.getElementById('modelInstructionsBtn');

    // instruction button handlers
    if (apiKeyInstructionsBtn) {
        apiKeyInstructionsBtn.addEventListener('click', () => {
            window.open('https://aistudio.google.com/api-keys', '_blank');
        });
    }

    if (modelInstructionsBtn) {
        modelInstructionsBtn.addEventListener('click', () => {
            window.open('https://aistudio.google.com/usage?timeRange=last-28-days&tab=rate-limit', '_blank');
        });
    }

    // load saved configuration
    chrome.storage.local.get(["geminiApiKey", "geminiModel"], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            statusDiv.textContent = "Configuration loaded.";
        }

        if (result.geminiModel) {
            modelNameInput.value = result.geminiModel;
        } else {
            modelNameInput.value = "gemini-2.0-flash-lite"; // default model name
        }

        if (result.requestInterval) {
            intervalTimeInput.value = result.requestInterval;
        } else {
            intervalTimeInput.value = "2500"; // default request interval
        }
    });

    // save configuration
    saveBtn.addEventListener("click", () => {
        const key = apiKeyInput.value.trim();
        const model = modelNameInput.value.trim() || "gemini-2.0-flash-lite"; // default if empty
        const interval = parseInt(intervalTimeInput.value) || 2500; // default if invalid

        if (key) {
            // save to storage
            chrome.storage.local.set({ geminiApiKey: key, geminiModel: model, requestInterval: interval }, () => {
                statusDiv.textContent = "Saved configuration!";
                // setTimeout(() => (statusDiv.textContent = ""), 3000);
                getModelInfo(key, model);
            });
        }
    });

    // solve quizzes
    solveBtn.addEventListener("click", () => {
        statusDiv.textContent = "Sending command to page...";

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return;

            chrome.tabs.sendMessage(tabs[0].id, { action: "start_solving" }, (response) => {
                if (chrome.runtime.lastError) {
                    statusDiv.textContent = "Error: Refresh page and try again.";
                } else {
                    statusDiv.textContent = "Solving started on page!";
                }
            });
        });
    });
});

// global: fetch model info
async function getModelInfo(apiKey, modelName) {
    const display = document.getElementById("modelInfoDisplay");
    display.style.display = "block";
    display.textContent = `Fetching info for ${modelName}...`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}?key=${apiKey}`;

    try {
        const response = await fetch(endpoint);
        const data = await response.json();

        if (response.ok) {
            let infoText = `- Model name: ${data.displayName || "N/A"} (${data.name || "N/A"})\n`;
            infoText += `- Version: ${data.version || "N/A"}\n`;
            infoText += `- Description: ${data.description || "No description"}\n`;
            infoText += `- Input / Output token limit: ${data.inputTokenLimit + " | " + data.outputTokenLimit || "N/A"}\n`;
            infoText += `- Methods: ${data.supportedGenerationMethods ? data.supportedGenerationMethods.join(", ") : "N/A"}\n`;
            infoText += `- Temperature: ${data.temperature || "N/A"} (Max: ${data.maxTemperature || "N/A"})\n`;
            infoText += `- Top P / Top K: ${data.topP || "N/A"} / ${data.topK || "N/A"}\n`;
            infoText += `- Thinking: ${data.thinking || "Unknown"}`;

            display.textContent = infoText;
            display.style.color = "coral";
        } else {
            display.textContent = `API Error: (${response.status}): ${data.error?.message || "Unknown error"}`;
        }
    } catch (error) {
        display.textContent = `Error: ${error.message}`;
        display.style.color = "coral";
    }
}
