# Manual Coursera Tool
Manual Coursera Tool to complete quizzes when your other automation tools not working :))))).

## ~~Setup (deprecated)~~
1. ~~Clone or download this repo as zip then extract~~
2. ~~Open browser, go to Extension page, enable `Developer mode` option~~
3. ~~Click `Load unpacked`, open the cloned repo or extracted folder (now a new icon will be added to extension bar, pin it as you like)~~
4. ~~Click extension icon to open popup (fast or slow depends on the device you are using)~~
5. ~~Read instructions, set your Gemini API Key (must have), model name and request interval (if you like default, skip them)~~
6. ~~Click `Save configurations` to save configs and run the model test (if error check your inputs then try again)~~

## Setup
1. Create and get Gemini API key from [Google AI Studio](https://aistudio.google.com/api-keys).
2. Get unlocked version of `coursera_locking_browser` from [Pear104/coursera-tool](https://github.com/Pear104/coursera-tool), extract and put inner folder to `AppData/Local`
3. Open `coursera_locking_browser.exe` first time to initialize.

## ~~Usage (deprecated)~~
1. ~~Open quiz page, start quiz~~
2. ~~When the quiz UI appear, click `Solve quizzes` on the page header to start solve quizzes (or inside extension popup, work the same)~~
3. ~~A frame container will be injected into each quiz, use `Re-solve this question` if the response is unreasonable, or use `Copy question & answers` if the previous option doesn't help~~

## Usage
1. Open quiz page, start, open `coursera_locking_browser` from prompt, or launch manually (Do not download and run from Coursera, it will overwrite the unlocked version and make you locked).
2. First time, unlocked version will ask for Gemini API key to automatically solve the quiz, enter your API key and click OK.
3. Second time and afterwards, unlocked version will automatically solve all the quizzes.
4. If quizzes not automatically solved: Press F12, copy script from [csr_manual_scripts.js](https://github.com/NekoZ410/Manual_Coursera_Tool/blob/main/csr_manual_scripts.js) in my repo, paste in `Console` tab, enter your Gemini API key, then press Enter. Use `Copy All Quizzes` button to copy all the quizzes if not believe in prompt responses, and use `Reload Page` to refresh the page. 

## Disclaimer
> I am not responsible for any incorrect answers, repeated failed attempts that lead to exhaustion of retry attempts within a period of time, cases of cheating detection that lead to account suspension and legal issues that arise.
> 
> All answers are information that Gemini can search and each model has a different knowledge cut-off, so accuracy cannot be 100% in all cases. Use with caution and always double check.

## Bugs
I made this for myself and tried to cover all the bug cases I could think of, so if there are any bugs please submit an Issue.