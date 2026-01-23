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
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "tailor-resume") {
    const selectedText = info.selectionText;
    
    // Store selected text
    await chrome.storage.local.set({ selectedJobDescription: selectedText });
    
    // Check if we can inject into this tab
    if (!tab.id) {
      console.warn('No tab ID available for context menu');
      return;
    }

    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
      console.warn('Cannot inject into Chrome internal pages:', url);
      return;
    }

    try {
      // Inject popup into current tab
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['popup-injector.js']
      });
    } catch (error) {
      console.error('Failed to inject popup from context menu:', error);
    }
  }
});

// Handle action button clicks (extension icon)
// Note: This only fires if default_popup is NOT set in manifest
// We'll use a different approach - check URL and decide whether to inject or use popup
chrome.action.onClicked.addListener(async (tab) => {
  // Get the current tab ID
  const tabId = tab.id;
  
  if (!tabId) {
    console.warn('No tab ID available');
    return;
  }

  // Check if we can inject into this tab (not chrome:// or chrome-extension:// pages)
  const url = tab.url || '';
  const isChromeInternalPage = url.startsWith('chrome://') || 
                               url.startsWith('chrome-extension://') || 
                               url.startsWith('edge://') ||
                               url.startsWith('about:') ||
                               url.startsWith('moz-extension://');

  if (isChromeInternalPage) {
    console.log('Chrome internal page detected, opening popup in new window:', url);
    // For Chrome internal pages, open popup.html in a new window
    try {
      await chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 420,
        height: 620,
      });
    } catch (windowError) {
      console.error('Failed to open popup window:', windowError);
    }
    return;
  }

  try {
    // Inject the popup into the current tab (regular web pages)
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['popup-injector.js']
    });
    
    console.log(`Popup injected into tab ${tabId}`);
  } catch (error) {
    console.error('Failed to inject popup:', error);
    // Fallback: try to open default popup if injection fails
    try {
      await chrome.action.openPopup();
    } catch (popupError) {
      console.error('Failed to open popup:', popupError);
    }
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "openPopup") {
    // Inject popup into current tab
    if (sender.tab?.id) {
      const url = sender.tab.url || '';
      if (!url.startsWith('chrome://') && !url.startsWith('chrome-extension://') && !url.startsWith('edge://')) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            files: ['popup-injector.js']
          });
          sendResponse({ success: true });
        } catch (error) {
          console.error('Failed to inject popup:', error);
          sendResponse({ success: false, error: error.message });
        }
      } else {
        console.warn('Cannot inject into Chrome internal pages:', url);
        sendResponse({ success: false, error: 'Cannot inject into Chrome internal pages' });
      }
    } else {
      sendResponse({ success: false, error: 'No tab ID available' });
    }
  } else if (request.action === "closePopup") {
    // Send message to content script to close popup
    if (sender.tab?.id) {
      try {
        await chrome.tabs.sendMessage(sender.tab.id, { action: "closePopup" });
    sendResponse({ success: true });
      } catch (error) {
        console.error('Failed to send close message:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      sendResponse({ success: false, error: 'No tab ID available' });
    }
  }
  return true; // Keep channel open for async response
});
