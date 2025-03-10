document.addEventListener('DOMContentLoaded', function () {
    const bionicToggle = document.getElementById('bionicToggle');
    const boldRatio = document.getElementById('boldRatio');
    const boldRatioValue = document.getElementById('boldRatioValue');
    const applyBtn = document.getElementById('applyBtn');
    const statusElement = document.querySelector('.status');

    // Load saved settings
    chrome.storage.sync.get(['bionicEnabled', 'boldRatio'], function (result) {
        bionicToggle.checked = result.bionicEnabled !== undefined ? result.bionicEnabled : true;
        boldRatio.value = result.boldRatio || 50;
        boldRatioValue.textContent = boldRatio.value + '%';

        // Update status text based on current state
        updateStatusText(bionicToggle.checked);
    });

    // Function to update status text
    function updateStatusText(isEnabled) {
        if (statusElement) {
            statusElement.textContent = isEnabled
                ? "Bionic Reading is active on all pages"
                : "Bionic Reading is currently disabled";
        }
    }

    // Update value display when slider changes
    boldRatio.addEventListener('input', function () {
        boldRatioValue.textContent = boldRatio.value + '%';
    });

    // Save and apply settings when toggle changes
    bionicToggle.addEventListener('change', function () {
        // Update status immediately for better UI feedback
        updateStatusText(bionicToggle.checked);

        // Save settings first
        chrome.storage.sync.set({ bionicEnabled: bionicToggle.checked });

        // Apply changes to current tab
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleBionic',
                    enabled: bionicToggle.checked,
                    boldRatio: parseInt(boldRatio.value)
                }, function (response) {
                    console.log("Toggle response:", response);
                });
            }
        });
    });

    // Apply settings to current page
    applyBtn.addEventListener('click', function () {
        // Save settings
        chrome.storage.sync.set({
            bionicEnabled: bionicToggle.checked,
            boldRatio: parseInt(boldRatio.value)
        });

        // Update status based on current state
        updateStatusText(bionicToggle.checked);

        // Only apply if enabled
        if (bionicToggle.checked) {
            // Apply to current tab
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'applyBionic',
                        enabled: true,
                        boldRatio: parseInt(boldRatio.value)
                    }, function (response) {
                        console.log("Apply response:", response);
                    });
                }
            });
        } else {
            // If disabled, make sure it's off
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'toggleBionic',
                        enabled: false,
                        boldRatio: parseInt(boldRatio.value)
                    });
                }
            });
        }
    });
});