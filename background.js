// Service worker for Resume Tailor extension

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu item
  chrome.contextMenus.create({
    id: "tailor-resume",
    title: "On Page CV Tailor to this role",
    contexts: ["selection"]
  });
});

// Inject content script on web pages (for inline bubble feature)
// Only injects on regular web pages, not chrome:// or extension pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only inject when page is fully loaded and it's a web page
  if (changeInfo.status !== 'complete') return;
  
  const url = tab.url || '';
  // Skip chrome://, chrome-extension://, edge://, about:, etc.
  if (url.startsWith('chrome://') || 
      url.startsWith('chrome-extension://') || 
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('moz-extension://')) {
    return;
  }
  
  // Only inject on http/https pages
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return;
  }

  try {
    // Inject content script for inline bubble feature
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
  } catch (error) {
    // Silently fail - some pages may not allow injection
    // This is expected for some restricted pages

  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "tailor-resume") {
    const selectedText = info.selectionText;
    
    // Store selected text with a timestamp to force navigation
    // This ensures the popup always navigates to tailor section, even if same text
    await chrome.storage.local.set({ 
      selectedJobDescription: selectedText,
      lastContextMenuClick: Date.now() // Timestamp to force navigation
    });
    
    // Check if we can inject into this tab
    if (!tab.id) {

      return;
    }

    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {

      return;
    }

    try {
      // Ensure content script is injected first (for bubble functionality)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      // Then inject popup
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['popup-injector.js']
      });
    } catch (error) {

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

    // For Chrome internal pages, open popup.html in a new window
    try {
      await chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 420,
        height: 620,
      });
    } catch (windowError) {

    }
    return;
  }

  try {
    // Ensure content script is injected first (for bubble functionality)
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    // Then inject the popup
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['popup-injector.js']
    });

  } catch (error) {

    // Fallback: try to open default popup if injection fails
    try {
      await chrome.action.openPopup();
    } catch (popupError) {

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
          // Ensure content script is injected first
          await chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            files: ['content.js']
          });
          // Then inject popup
          await chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            files: ['popup-injector.js']
          });
          sendResponse({ success: true });
        } catch (error) {

          sendResponse({ success: false, error: error.message });
        }
      } else {

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

        sendResponse({ success: false, error: error.message });
      }
    } else {
      sendResponse({ success: false, error: 'No tab ID available' });
    }
  }
  return true; // Keep channel open for async response
});
