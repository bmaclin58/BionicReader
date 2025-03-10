let bionicEnabled = true;
let boldRatio = 50;
let originalTextNodes = new Map();
let observer = null;

// Track if bionic reading is currently applied
let isBionicApplied = false;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("Message received:", request);

  if (request.action === 'toggleBionic' || request.action === 'applyBionic') {
    // Update our stored values
    bionicEnabled = request.enabled;
    boldRatio = request.boldRatio;

    console.log("Toggle state:", bionicEnabled);

    // Ensure we fully remove existing formatting first in all cases
    removeAllBionicFormatting();

    // Small timeout to ensure DOM is completely updated before reapplying
    setTimeout(() => {
      if (bionicEnabled) {
        // If enabled, apply bionic reading with fresh state
        console.log("Applying bionic reading");
        applyBionicReading();
      } else {
        console.log("Bionic reading disabled");
        // Already removed all formatting above
      }

      // Store the current state in storage to ensure persistence
      chrome.storage.sync.set({
        bionicEnabled: bionicEnabled,
        boldRatio: boldRatio
      });

      // Send response to confirm processing
      isBionicApplied = bionicEnabled;
      sendResponse({ success: true, enabled: bionicEnabled });
    }, 100);

    return true; // Keep the message channel open for async response
  } else if (request.action === 'checkStatus') {
    // Respond to background.js to confirm content script is loaded
    sendResponse({ loaded: true, bionicApplied: isBionicApplied });
    return true;
  }
});

// Function to completely remove all bionic formatting
function removeAllBionicFormatting() {
  console.log("Removing all bionic formatting");

  // Stop any existing MutationObserver
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  // Remove the bionic-active class from the body
  document.body.classList.remove('bionic-active');

  // Get all elements with the bionic-text class
  const bionicElements = document.querySelectorAll('.bionic-text');
  console.log(`Found ${bionicElements.length} bionic elements to remove`);

  // Create an array from the NodeList to avoid issues with live collections
  Array.from(bionicElements).forEach(element => {
    try {
      // Find if we have the original text for this node
      let foundOriginal = false;
      for (const [key, value] of originalTextNodes.entries()) {
        if (key.parentNode === element.parentNode) {
          // Create a new text node with the original content
          const textNode = document.createTextNode(value);
          // Replace the bionic element with the original text
          element.parentNode.replaceChild(textNode, element);
          // Remove the entry from our map to prevent memory leaks
          originalTextNodes.delete(key);
          foundOriginal = true;
          break;
        }
      }

      // If we couldn't find the original text, try to extract from the HTML
      if (!foundOriginal) {
        // Extract text from the HTML (removing the <b> tags)
        const extractedText = element.textContent;
        const textNode = document.createTextNode(extractedText);
        element.parentNode.replaceChild(textNode, element);
      }
    } catch (error) {
      console.error("Error removing bionic element:", error);
    }
  });

  // Clear the map to free memory
  originalTextNodes = new Map();
  isBionicApplied = false;
}

// Function to apply bionic reading
function applyBionicReading() {
  // Ensure we have a clean slate
  if (document.querySelectorAll('.bionic-text').length > 0) {
    removeAllBionicFormatting();
  }

  // Add a class to the body to indicate bionic reading is active
  document.body.classList.add('bionic-active');

  // Exclude certain tags from processing
  const excludeTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'PRE', 'CODE', 'TEXTAREA', 'INPUT', 'BUTTON', 'SELECT', 'OPTION'];

  function processTextNode(textNode) {
    // Skip if node is empty or only whitespace
    if (!textNode.nodeValue || !textNode.nodeValue.trim()) return;

    // Skip if parent is in excluded tags
    if (textNode.parentNode && excludeTags.includes(textNode.parentNode.tagName)) return;

    // Skip if node is already processed or its parent has .bionic-text class
    if (originalTextNodes.has(textNode) ||
      (textNode.parentNode && textNode.parentNode.classList &&
        textNode.parentNode.classList.contains('bionic-text'))) {
      return;
    }

    // Skip any nodes inside existing bionic-text elements
    let parent = textNode.parentNode;
    while (parent) {
      if (parent.classList && parent.classList.contains('bionic-text')) {
        return;
      }
      parent = parent.parentNode;
    }

    // Save original text
    originalTextNodes.set(textNode, textNode.nodeValue);

    // Convert text to bionic reading format
    const bionicText = textNode.nodeValue.split(' ').map(word => {
      if (word.length === 0) return word;

      // Calculate how many characters to bold based on boldRatio
      const charsToHighlight = Math.max(1, Math.ceil(word.length * (boldRatio / 100)));

      // Handle punctuation at the beginning of words
      let punctBefore = '';
      let actualWord = word;
      const punctBeforeMatch = word.match(/^[^\w\s]+/);
      if (punctBeforeMatch) {
        punctBefore = punctBeforeMatch[0];
        actualWord = word.substring(punctBefore.length);
      }

      if (actualWord.length === 0) return word;

      const firstPart = actualWord.substring(0, charsToHighlight);
      const restPart = actualWord.substring(charsToHighlight);

      return punctBefore + '<b>' + firstPart + '</b>' + restPart;
    }).join(' ');

    try {
      // Create a new span element with the bionic text
      const span = document.createElement('span');
      span.classList.add('bionic-text');
      span.innerHTML = bionicText;

      // Replace the text node with the span
      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(span, textNode);
      }
    } catch (error) {
      console.error("Error applying bionic format:", error);
    }
  }

  function walkDOM(node) {
    if (!node) return;

    // If node is a text node, process it
    if (node.nodeType === 3) {
      processTextNode(node);
      return;
    }

    // Skip if node is in excluded tags
    if (excludeTags.includes(node.nodeName)) return;

    // Skip if node already has bionic text
    if (node.classList && node.classList.contains('bionic-text')) return;

    // Walk through child nodes
    const children = node.childNodes;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        walkDOM(children[i]);
      }
    }
  }

  try {
    walkDOM(document.body);

    // Start observing DOM changes after initial processing
    startObserver();

    isBionicApplied = true;
  } catch (error) {
    console.error("Error during walkDOM:", error);
  }
}

// Function to observe DOM changes (for dynamic content)
function startObserver() {
  // Stop any existing observer
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver(function (mutations) {
    if (bionicEnabled) {
      mutations.forEach(function (mutation) {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            // Skip processing if the node is a bionic-text or inside one
            let shouldProcess = true;
            let parent = mutation.addedNodes[i].parentNode;
            while (parent) {
              if (parent.classList && parent.classList.contains('bionic-text')) {
                shouldProcess = false;
                break;
              }
              parent = parent.parentNode;
            }

            if (shouldProcess) {
              walkDOM(mutation.addedNodes[i]);
            }
          }
        }
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Load settings on page load
chrome.storage.sync.get(['bionicEnabled', 'boldRatio'], function (result) {
  // Default to enabled if setting doesn't exist
  bionicEnabled = result.bionicEnabled !== undefined ? result.bionicEnabled : true;
  boldRatio = result.boldRatio || 50;

  console.log("Initial settings loaded:", bionicEnabled, boldRatio);

  // Apply immediately when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (bionicEnabled) {
        console.log("Applying bionic reading on DOMContentLoaded");
        applyBionicReading();
      }
    });
  } else {
    // DOM already loaded
    if (bionicEnabled) {
      console.log("Applying bionic reading immediately (DOM already loaded)");
      applyBionicReading();
    }
  }
});

function applyBionicReading() {
  // First revert any existing bionic reading to avoid stacking
  if (document.querySelectorAll('.bionic-text').length > 0) {
    revertBionicReading();
  }

  // Add a class to the body to indicate bionic reading is active
  document.body.classList.add('bionic-active');

  // Exclude certain tags from processing
  const excludeTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'PRE', 'CODE', 'TEXTAREA', 'INPUT', 'BUTTON', 'SELECT', 'OPTION'];

  function processTextNode(textNode) {
    // Skip if node is empty or only whitespace
    if (!textNode.nodeValue.trim()) return;

    // Skip if parent is in excluded tags
    if (excludeTags.includes(textNode.parentNode.tagName)) return;

    // Skip if node is already processed or its parent has .bionic-text class
    if (originalTextNodes.has(textNode) ||
      textNode.parentNode.classList &&
      textNode.parentNode.classList.contains('bionic-text')) {
      return;
    }

    // Skip any nodes inside existing bionic-text elements
    let parent = textNode.parentNode;
    while (parent) {
      if (parent.classList && parent.classList.contains('bionic-text')) {
        return;
      }
      parent = parent.parentNode;
    }

    // Save original text
    originalTextNodes.set(textNode, textNode.nodeValue);

    // Convert text to bionic reading format
    const bionicText = textNode.nodeValue.split(' ').map(word => {
      if (word.length === 0) return word;

      // Calculate how many characters to bold based on boldRatio
      const charsToHighlight = Math.max(1, Math.ceil(word.length * (boldRatio / 100)));

      // Handle punctuation at the beginning of words
      let punctBefore = '';
      let actualWord = word;
      const punctBeforeMatch = word.match(/^[^\w\s]+/);
      if (punctBeforeMatch) {
        punctBefore = punctBeforeMatch[0];
        actualWord = word.substring(punctBefore.length);
      }

      if (actualWord.length === 0) return word;

      const firstPart = actualWord.substring(0, charsToHighlight);
      const restPart = actualWord.substring(charsToHighlight);

      return punctBefore + '<b>' + firstPart + '</b>' + restPart;
    }).join(' ');

    // Create a new span element with the bionic text
    const span = document.createElement('span');
    span.classList.add('bionic-text');
    span.innerHTML = bionicText;

    // Replace the text node with the span
    textNode.parentNode.replaceChild(span, textNode);
  }

  function walkDOM(node) {
    // If node is a text node, process it
    if (node.nodeType === 3) {
      processTextNode(node);
      return;
    }

    // Skip if node is in excluded tags
    if (excludeTags.includes(node.nodeName)) return;

    // Skip if node already has bionic text
    if (node.classList && node.classList.contains('bionic-text')) return;

    // Walk through child nodes
    const children = node.childNodes;
    for (let i = 0; i < children.length; i++) {
      walkDOM(children[i]);
    }
  }

  walkDOM(document.body);
}

function revertBionicReading() {
  // Remove the bionic-active class from the body
  document.body.classList.remove('bionic-active');

  // Get all elements with the bionic-text class
  const bionicElements = document.querySelectorAll('.bionic-text');

  // Create an array from the NodeList to avoid issues with live collections
  Array.from(bionicElements).forEach(element => {
    const parent = element.parentNode;

    // Find the corresponding original text for this element
    for (const [key, value] of originalTextNodes.entries()) {
      if (key.parentNode === parent) {
        // Create a new text node with the original content
        const textNode = document.createTextNode(value);
        // Replace the bionic element with the original text
        parent.replaceChild(textNode, element);
        // Remove the entry from our map to prevent memory leaks
        originalTextNodes.delete(key);
        break;
      }
    }
  });

  // Force garbage collection of our map to free memory
  if (bionicElements.length > 0 && originalTextNodes.size === 0) {
    originalTextNodes = new Map();
  }
}