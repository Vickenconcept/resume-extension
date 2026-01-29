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

// --- Inline "Tailor" bubble near selected text (Grammarly-style) ---

let tailorBubble = null;
let lastSelectedText = '';
let lastValidSelectionTime = 0;

function createTailorBubble() {
  if (tailorBubble) return tailorBubble;

  const bubble = document.createElement('button');
  bubble.id = 'resume-tailor-inline-button';
  bubble.textContent = 'Tailor resume';
  bubble.style.position = 'fixed';
  bubble.style.zIndex = '2147483647';
  bubble.style.padding = '6px 10px';
  bubble.style.fontSize = '12px';
  bubble.style.border = 'none';
  bubble.style.borderRadius = '999px';
  // Match primary blue button color from popup (btn-primary)
  bubble.style.background = '#3b82f6';
  bubble.style.color = '#ffffff';
  bubble.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.35)';
  bubble.style.cursor = 'pointer';
  bubble.style.display = 'none';
  bubble.style.alignItems = 'center';
  bubble.style.justifyContent = 'center';
  bubble.style.gap = '6px';

  // Simple icon
  const icon = document.createElement('span');
  icon.textContent = '✨';
  icon.style.fontSize = '12px';
  bubble.prepend(icon);

  bubble.addEventListener('mousedown', (e) => {
    // Prevent losing text selection when clicking the bubble
    e.preventDefault();
    e.stopPropagation();
  });

  bubble.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
    const selection = window.getSelection();
      const text = (selection && selection.toString().trim()) || lastSelectedText || '';
    if (!text) {
        hideTailorBubble();
      return;
    }

      // Store selected text so popup can pick it up
      await chrome.storage.local.set({ selectedJobDescription: text });

      // Ask background to inject/open the popup
      chrome.runtime.sendMessage({ action: 'openPopup' }, () => {
        // Ignore errors; background will log if needed
      });
    } catch (err) {
      // Fail silently for the user, but log for debugging
      // eslint-disable-next-line no-console
      console.error('Error triggering Resume Tailor popup from inline button:', err);
    } finally {
      hideTailorBubble();
    }
  });

  document.body.appendChild(bubble);
  tailorBubble = bubble;
  return bubble;
}

function hideTailorBubble() {
  if (tailorBubble) {
    tailorBubble.style.display = 'none';
}
  lastValidSelectionTime = 0;
}

function updateTailorBubblePosition() {
  // Do not show bubble if our popup overlay is currently visible
  const popupContainer = document.getElementById('resume-tailor-popup-container');
  if (popupContainer && popupContainer.style.display !== 'none') {
    hideTailorBubble();
    return;
  }

  const now = Date.now();
  const selection = window.getSelection && window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    // Allow a short grace period while the user is adjusting the selection
    if (now - lastValidSelectionTime > 300) {
      hideTailorBubble();
    }
    return;
  }

  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length < 10) {
    // Ignore very short selections (likely not a real job description),
    // but don't immediately hide if the user is still dragging.
    if (now - lastValidSelectionTime > 300) {
      hideTailorBubble();
    }
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    if (now - lastValidSelectionTime > 300) {
      hideTailorBubble();
    }
    return;
  }

  lastSelectedText = selectedText;
   lastValidSelectionTime = now;

  const bubble = createTailorBubble();
  const padding = 8;

  // Temporarily show the bubble off-screen to measure width correctly
  bubble.style.display = 'flex';
  bubble.style.visibility = 'hidden';
  bubble.style.top = '-9999px';
  bubble.style.left = '-9999px';

  const bubbleWidth = bubble.offsetWidth || 140;
  const bubbleHeight = bubble.offsetHeight || 32;

  const top = window.scrollY + rect.bottom + padding;
  const rawLeft = window.scrollX + rect.right - bubbleWidth / 2;
  const clampedLeft = Math.min(
    Math.max(8, rawLeft),
    window.innerWidth + window.scrollX - bubbleWidth - 8
  );

  const maxTop =
    window.scrollY + window.innerHeight - bubbleHeight - 8;
  const clampedTop = Math.min(Math.max(window.scrollY + 8, top), maxTop);

  bubble.style.top = `${clampedTop}px`;
  bubble.style.left = `${clampedLeft}px`;
  bubble.style.visibility = 'visible';
}

function handleSelectionChange() {
  // Debounce slightly to avoid flicker on fast selection changes
  window.clearTimeout(handleSelectionChange._t);
  handleSelectionChange._t = window.setTimeout(() => {
    try {
      updateTailorBubblePosition();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error updating Resume Tailor inline button position:', e);
    }
  }, 80);
}

// Attach listeners once the DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  document.addEventListener('mouseup', handleSelectionChange);
  document.addEventListener('keyup', handleSelectionChange);
  document.addEventListener('scroll', handleSelectionChange, true);
  document.addEventListener('selectionchange', handleSelectionChange);
} else {
  window.addEventListener('DOMContentLoaded', () => {
document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);
    document.addEventListener('scroll', handleSelectionChange, true);
    document.addEventListener('selectionchange', handleSelectionChange);
  });
}
