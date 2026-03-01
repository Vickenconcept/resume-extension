// Popup injector - Injects the popup UI into the current page

(function() {
  'use strict';

  // Check if popup is already injected
  if (document.getElementById('resume-tailor-popup-container')) {
    // Toggle visibility
    const container = document.getElementById('resume-tailor-popup-container');
    const iframe = document.getElementById('resume-tailor-popup-iframe');
    
    // Hide inline bubble when popup is shown
    const inlineBubble = document.getElementById('resume-tailor-inline-button');
    if (inlineBubble) {
      inlineBubble.style.display = 'none';
    }
    
    if (container.style.display === 'none') {
      container.style.display = 'flex';
    } else {
      // Popup is already visible - don't hide it, just ensure it's visible
      // and send message to force check
      container.style.display = 'flex';
    }
    
    // Always send message to iframe to force check for selected text
    // This ensures navigation happens even when popup is already visible
    if (iframe && iframe.contentWindow) {
      try {
        // Use setTimeout to ensure iframe is ready
        setTimeout(() => {
          try {
            iframe.contentWindow.postMessage({ 
              action: 'forceCheckSelectedText',
              timestamp: Date.now() 
            }, '*');
          } catch (e) {
            console.log('Could not send message to iframe:', e);
          }
        }, 100);
      } catch (e) {
        console.log('Error setting up message to iframe:', e);
      }
    }
    return;
  }

  // Create container for popup
  const container = document.createElement('div');
  container.id = 'resume-tailor-popup-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  `;

  // Create iframe for popup content
  const iframe = document.createElement('iframe');
  iframe.id = 'resume-tailor-popup-iframe';
  iframe.src = chrome.runtime.getURL('popup.html');
  iframe.style.cssText = `
    width: 400px;
    height: 600px;
    border: none;
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    background: #ffffff;
    overflow: hidden;
  `;
  
  // Ensure iframe has rounded corners
  iframe.setAttribute('allowtransparency', 'true');
  iframe.setAttribute('scrolling', 'no');

  // Close button overlay - positioned relative to iframe wrapper
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #e5e7eb;
    font-size: 22px;
    color: #374151;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000000;
    box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
    line-height: 1;
  `;
  closeBtn.onmouseover = () => {
    closeBtn.style.background = '#ffffff';
    closeBtn.style.transform = 'scale(1.1)';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.9)';
    closeBtn.style.transform = 'scale(1)';
  };

  // Hide inline bubble helper
  const hideInlineBubble = () => {
    const inlineBubble = document.getElementById('resume-tailor-inline-button');
    if (inlineBubble) {
      inlineBubble.style.display = 'none';
    }
  };

  // Close handler
  const closePopup = () => {
    container.style.display = 'none';
    // Bubble can show again when popup is closed (handled by content.js)
  };

  // Wrapped close handler that also cleans up event listeners
  const wrappedClosePopup = () => {
    document.removeEventListener('keydown', handleKeyDown);
    closePopup();
  };

  closeBtn.onclick = wrappedClosePopup;
  container.onclick = (e) => {
    if (e.target === container) {
      wrappedClosePopup();
    }
  };

  // Listen for close messages from iframe
  window.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'closePopup') {
      closePopup();
    }
  });

  // Prevent iframe clicks from closing
  iframe.onclick = (e) => {
    e.stopPropagation();
  };

  // Create wrapper for iframe and close button for better positioning
  const iframeWrapper = document.createElement('div');
  iframeWrapper.style.cssText = `
    position: relative;
    width: 400px;
    height: 600px;
  `;
  
  iframeWrapper.appendChild(iframe);
  iframeWrapper.appendChild(closeBtn);
  container.appendChild(iframeWrapper);
  document.body.appendChild(container);
  
  // Hide bubble immediately when popup is created
  hideInlineBubble();

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'closePopup') {
      closePopup();
      sendResponse({ success: true });
    }
    return true;
  });

  // Keyboard shortcuts - ESC to close
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && container.style.display !== 'none') {
      closePopup();
      e.preventDefault();
      e.stopPropagation();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
})();
