let bionicEnabled = true;
let boldRatio = 50;
let originalTextNodes = new Map();

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'toggleBionic') {
    bionicEnabled = request.enabled;
    boldRatio = request.boldRatio;
    
    if (bionicEnabled) {
      applyBionicReading();
    } else {
      revertBionicReading();
    }
  }
});

// Load settings on page load
chrome.storage.sync.get(['bionicEnabled', 'boldRatio'], function(result) {
  bionicEnabled = result.bionicEnabled !== undefined ? result.bionicEnabled : true;
  boldRatio = result.boldRatio || 50;
  
  if (bionicEnabled) {
    // Wait for page to fully load
    window.addEventListener('load', function() {
      applyBionicReading();
    });
  }
});

function applyBionicReading() {
  // Exclude certain tags from processing
  const excludeTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'PRE', 'CODE', 'TEXTAREA', 'INPUT', 'BUTTON', 'SELECT', 'OPTION'];
  
  function processTextNode(textNode) {
    // Skip if node is empty or only whitespace
    if (!textNode.nodeValue.trim()) return;
    
    // Skip if parent is in excluded tags
    if (excludeTags.includes(textNode.parentNode.tagName)) return;
    
    // Skip if node is already processed
    if (originalTextNodes.has(textNode)) return;
    
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
    
    // Walk through child nodes
    const children = node.childNodes;
    for (let i = 0; i < children.length; i++) {
      walkDOM(children[i]);
    }
  }
  
  walkDOM(document.body);
}

function revertBionicReading() {
  const bionicElements = document.querySelectorAll('.bionic-text');
  
  bionicElements.forEach(element => {
    const parent = element.parentNode;
    
    // Get the original text node for this element if it exists
    for (const [key, value] of originalTextNodes.entries()) {
      if (key.parentNode === parent) {
        const textNode = document.createTextNode(value);
        parent.replaceChild(textNode, element);
        originalTextNodes.delete(key);
        break;
      }
    }
  });
}