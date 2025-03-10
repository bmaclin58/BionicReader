// Initialize default settings when extension is installed
chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.sync.set({
        bionicEnabled: true,
        boldRatio: 50
    }, function () {
        console.log('Default settings initialized');
    });
});

// Listen for tab updates to reapply bionic reading when navigating
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        chrome.storage.sync.get(['bionicEnabled'], function (result) {
            const isEnabled = result.bionicEnabled !== undefined ? result.bionicEnabled : true;

            if (isEnabled) {
                // Wait a moment for the page to fully load before applying bionic reading
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { action: 'checkStatus' }, function (response) {
                        // If error or no response, the content script may not be injected yet
                        if (chrome.runtime.lastError || !response) {
                            console.log('Content script not loaded, injecting...');
                            try {
                                chrome.scripting.executeScript({
                                    target: { tabId: tabId },
                                    files: ['content.js']
                                }).then(() => {
                                    chrome.scripting.insertCSS({
                                        target: { tabId: tabId },
                                        files: ['bionic.css']
                                    }).then(() => {
                                        // After injection, send toggle message to apply bionic reading
                                        chrome.storage.sync.get(['boldRatio'], function (ratioResult) {
                                            const ratio = ratioResult.boldRatio || 50;

                                            chrome.tabs.sendMessage(tabId, {
                                                action: 'toggleBionic',
                                                enabled: isEnabled,
                                                boldRatio: ratio
                                            });
                                        });
                                    });
                                });
                            } catch (error) {
                                console.error("Error injecting content script:", error);
                            }
                        } else if (response && !response.bionicApplied && isEnabled) {
                            // Content script loaded but bionic not applied, apply it
                            chrome.storage.sync.get(['boldRatio'], function (ratioResult) {
                                const ratio = ratioResult.boldRatio || 50;

                                chrome.tabs.sendMessage(tabId, {
                                    action: 'toggleBionic',
                                    enabled: isEnabled,
                                    boldRatio: ratio
                                });
                            });
                        }
                    });
                }, 500);
            }
        });
    }
});