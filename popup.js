document.addEventListener('DOMContentLoaded', function () {
    const bionicToggle = document.getElementById('bionicToggle');
    const boldRatio = document.getElementById('boldRatio');
    const boldRatioValue = document.getElementById('boldRatioValue');
    const applyBtn = document.getElementById('applyBtn');

    // Load saved settings
    chrome.storage.sync.get(['bionicEnabled', 'boldRatio'], function (result) {
        bionicToggle.checked = result.bionicEnabled !== undefined ? result.bionicEnabled : true;
        boldRatio.value = result.boldRatio || 50;
        boldRatioValue.textContent = boldRatio.value + '%';
    });

    // Update value display when slider changes
    boldRatio.addEventListener('input', function () {
        boldRatioValue.textContent = boldRatio.value + '%';
    });

    // Save settings when toggle changes
    bionicToggle.addEventListener('change', function () {
        chrome.storage.sync.set({ bionicEnabled: bionicToggle.checked });
    });

    // Apply settings to current page
    applyBtn.addEventListener('click', function () {
        // Save settings
        chrome.storage.sync.set({
            bionicEnabled: bionicToggle.checked,
            boldRatio: parseInt(boldRatio.value)
        });

        // Send message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleBionic',
                enabled: bionicToggle.checked,
                boldRatio: parseInt(boldRatio.value)
            });
        });
    });
});