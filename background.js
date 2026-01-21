// Service worker for Resume Tailor extension

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu item
  chrome.contextMenus.create({
    id: "tailor-resume",
    title: "Tailor resume to this role",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "tailor-resume") {
    const selectedText = info.selectionText;
    
    // Store selected text
    chrome.storage.local.set({ selectedJobDescription: selectedText }, () => {
      // Open popup or send message to content script
      chrome.action.openPopup();
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openPopup") {
    chrome.action.openPopup();
    sendResponse({ success: true });
  }
  return true;
});
