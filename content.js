// Content script for Resume Tailor extension

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSelectedText") {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({ text: selectedText });
  }
  return true;
});

// Helper to get page context
function getPageContext() {
  return {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname
  };
}

// Export for popup use
if (typeof window !== 'undefined') {
  window.getPageContext = getPageContext;
}
