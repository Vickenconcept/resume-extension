// Popup script for Resume Tailor extension

// Get API URL from config, storage, or use default
let API_BASE_URL = (typeof EXTENSION_CONFIG !== 'undefined' && EXTENSION_CONFIG.API_BASE_URL) 
  ? EXTENSION_CONFIG.API_BASE_URL 
  : 'http://localhost:8000';

// Helper to get API base URL (always adds /api if not present)
function getApiBaseUrl() {
  const base = API_BASE_URL.endsWith('/api') ? API_BASE_URL : API_BASE_URL + '/api';
  return base;
}

// DOM Elements
const authSection = document.getElementById('auth-section');
const uploadSection = document.getElementById('upload-section');
const readySection = document.getElementById('ready-section');
const tailorSection = document.getElementById('tailor-section');
const resultsSection = document.getElementById('results-section');
const errorSection = document.getElementById('error-section');

const uploadBox = document.getElementById('upload-box');
const resumeFileInput = document.getElementById('resume-file');
const uploadBtn = document.getElementById('upload-btn');
const uploadStatus = document.getElementById('upload-status');

const jobText = document.getElementById('job-text');
// Wrap in try-catch to catch any errors during element selection
let tailorBtn, loading;
try {
  tailorBtn = document.getElementById('tailor-btn');
  loading = document.getElementById('loading');
  console.log('Elements selected:', { 
    tailorBtn: !!tailorBtn, 
    loading: !!loading,
    documentReady: document.readyState 
  });
  
  // IMMEDIATELY hide loading element - never show it automatically
  if (loading) {
    loading.classList.add('hidden');
    console.log('Loading element hidden immediately after selection');
  }
} catch (error) {
  console.error('Error selecting elements:', error);
}

const summaryContent = document.getElementById('summary-content');
const bulletsContent = document.getElementById('bullets-content');
const keywordsContent = document.getElementById('keywords-content');

const downloadBtn = document.getElementById('download-btn');
const newTailorBtn = document.getElementById('new-tailor-btn');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');

// Standard API response handler
async function apiRequest(endpoint, options = {}) {
  const requestStartTime = Date.now();
  const url = getApiBaseUrl() + endpoint;
  
  console.log('API Request:', {
    endpoint,
    url,
    method: options.method || 'GET',
    timestamp: new Date().toISOString()
  });
  
  try {
    // Get auth token from storage
    const { authToken } = await chrome.storage.local.get(['authToken']);
    
    // Add ngrok-skip-browser-warning header for ngrok free tier
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };
    
    // Add Authorization header if token exists
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Check if URL is ngrok and add skip warning header
    if (url.includes('ngrok-free.app') || url.includes('ngrok-free.dev') || url.includes('ngrok.io')) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    
    console.log('Making fetch request...', { url, headers });
    
    const fetchStartTime = Date.now();
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('Fetch request timeout after 60 seconds');
      controller.abort();
    }, 60000); // 60 second timeout
    
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: The server took too long to respond. Check if your backend is running.');
      }
      throw error;
    }
    
    const fetchDuration = Date.now() - fetchStartTime;
    
    // Check if response is JSON or HTML (error page)
    const contentType = response.headers.get('content-type');
    
    console.log('Fetch response received', {
      status: response.status,
      statusText: response.statusText,
      contentType: contentType,
      fetch_duration_ms: fetchDuration
    });
    
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      const parseStartTime = Date.now();
      data = await response.json();
      const parseDuration = Date.now() - parseStartTime;
      console.log('JSON parsed successfully', {
        hasSuccess: !!data.success,
        hasData: !!data.data,
        parse_duration_ms: parseDuration
      });
    } else {
      // Got HTML instead of JSON (likely an error page)
      const text = await response.text();
      console.error('API returned HTML instead of JSON:', text.substring(0, 500));
      
      // Check if it's ngrok warning page
      let errorMsg = `API endpoint returned HTML instead of JSON.\n\n`;
      errorMsg += `URL: ${url}\n\n`;
      
      if (text.includes('ngrok') || text.includes('You have been denied access')) {
        errorMsg += `⚠️ This appears to be the ngrok warning page.\n\n`;
        errorMsg += `Solutions:\n`;
        errorMsg += `1. Make sure your backend is running: php artisan serve\n`;
        errorMsg += `2. Verify ngrok is pointing to localhost:8000\n`;
        errorMsg += `3. Try accessing ${url} directly in your browser\n`;
        errorMsg += `4. Check browser console (F12) for CORS errors\n`;
      } else if (text.includes('404') || text.includes('Not Found')) {
        errorMsg += `⚠️ 404 Not Found - The endpoint doesn't exist.\n\n`;
        errorMsg += `Check:\n1. Backend routes are correct\n2. Laravel is running\n3. API prefix is /api\n`;
      } else if (text.includes('500') || text.includes('Internal Server Error')) {
        errorMsg += `⚠️ 500 Server Error - Backend has an error.\n\n`;
        errorMsg += `Check:\n1. Laravel logs: backend/storage/logs/laravel.log\n`;
        errorMsg += `2. PHP errors in console\n`;
        errorMsg += `3. All dependencies installed: composer install\n`;
      } else {
        errorMsg += `This might be:\n`;
        errorMsg += `- ngrok warning/interstitial page\n`;
        errorMsg += `- Laravel error page\n`;
        errorMsg += `- Backend not accessible\n\n`;
        errorMsg += `Try:\n1. Test API directly: ${url}\n`;
        errorMsg += `2. Check backend is running: php artisan serve\n`;
        errorMsg += `3. Verify ngrok tunnel is active\n`;
      }
      
      throw new Error(errorMsg);
    }

    // Standard response format: { success: bool, data: any, message: string, error: string }
    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error.message.includes('API endpoint returned HTML')) {
      throw error; // Re-throw our custom error
    }
    throw new Error(error.message || 'Network error occurred. Check your API URL and ensure backend is running.');
  }
}

// Initialize popup
async function init() {
  console.log('Initializing popup...');
  
  // IMPORTANT: Hide loading immediately on init - never show it automatically
  if (loading) {
    loading.classList.add('hidden');
    console.log('Loading hidden on init');
  }
  
  // Load API URL from config.js (no storage needed - set by developer)
  // API_BASE_URL is already set from config.js at the top of the file
  console.log('API Base URL:', getApiBaseUrl());
  
  // Check authentication first
  const { authToken, user } = await chrome.storage.local.get(['authToken', 'user']);
  
  if (!authToken) {
    console.log('No auth token found, showing auth section');
    window.showAuthSection();
    return;
  }
  
  // Verify token is still valid
  try {
    const response = await window.apiRequest('/me');
    if (response.success) {
      // Token is valid, update user info
      await chrome.storage.local.set({ user: response.data.user });
      window.updateUserInfo(response.data.user);
      console.log('User authenticated:', response.data.user);
    } else {
      // Token invalid, show auth
      await chrome.storage.local.remove(['authToken', 'user']);
      window.showAuthSection();
      return;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    // Token invalid or expired, show auth
    await chrome.storage.local.remove(['authToken', 'user']);
    window.showAuthSection();
    return;
  }
  
  // Check if there's an operation in progress
  const { operationState, resumeId, pendingJobDescription } = await chrome.storage.local.get([
    'operationState', 
    'resumeId',
    'pendingJobDescription'
  ]);
  
  console.log('Popup initialization state:', {
    operationState,
    hasResumeId: !!resumeId,
    hasPendingJobDescription: !!pendingJobDescription,
    pendingJobDescriptionLength: pendingJobDescription?.length
  });
  
  if (operationState === 'tailoring') {
    // User closed popup during tailoring - restore job description but don't show loading
    // They need to click the button again to resume
    console.log('Previous tailoring operation found, restoring job description only...');
    if (pendingJobDescription) {
      jobText.textContent = pendingJobDescription;
      window.showTailorSection();
      
      // Clear the operation state - user must click button to continue
      await chrome.storage.local.set({ 
        operationState: null 
      });
      
      // Ensure loading is hidden and button is enabled
      if (loading) {
        loading.classList.add('hidden');
      }
      if (tailorBtn) {
        tailorBtn.disabled = false;
      }
      
      console.log('Job description restored. User must click button to generate.');
    } else {
      console.log('Operation state is tailoring but no pending job description found');
      // Clear invalid state
      await chrome.storage.local.set({ operationState: null });
      if (resumeId) {
        window.showReadySection();
        checkForSelectedText();
      } else {
        window.showUploadSection();
      }
    }
  } else if (operationState === 'uploading') {
    // Restore uploading state
    console.log('Restoring uploading state...');
    window.showUploadSection();
    uploadBtn.disabled = true;
    showUploadStatus('Upload in progress...', 'success');
  } else if (resumeId) {
    // Normal state - resume uploaded, ready for tailoring
    console.log('Resume already uploaded, showing ready section');
    window.showReadySection();
    checkForSelectedText();
  } else {
    // No resume uploaded
    console.log('No resume uploaded, showing upload section');
    window.showUploadSection();
  }
  
  console.log('Popup initialization complete');
}

// Show sections
function showUploadSection() {
  uploadSection.classList.remove('hidden');
  readySection.classList.add('hidden');
  tailorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  errorSection.classList.add('hidden');
}

function showReadySection() {
  authSection.classList.add('hidden');
  uploadSection.classList.add('hidden');
  readySection.classList.remove('hidden');
  tailorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  errorSection.classList.add('hidden');
}

function showTailorSection() {
  console.log('Showing tailor section...');
  authSection.classList.add('hidden');
  uploadSection.classList.add('hidden');
  readySection.classList.add('hidden');
  tailorSection.classList.remove('hidden');
  resultsSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  
  // Ensure button is enabled and loading is hidden when section is shown
  if (tailorBtn) {
    tailorBtn.disabled = false;
    console.log('Tailor button enabled, visible:', tailorBtn.offsetParent !== null);
  }
  if (loading) {
    loading.classList.add('hidden'); // Always hide loading when section is shown - only show after button click
  }
}

function showResultsSection() {
  authSection.classList.add('hidden');
  uploadSection.classList.add('hidden');
  readySection.classList.add('hidden');
  tailorSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');
  errorSection.classList.add('hidden');
}

function showError(message) {
  errorMessage.textContent = message;
  authSection.classList.add('hidden');
  uploadSection.classList.add('hidden');
  readySection.classList.add('hidden');
  tailorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  errorSection.classList.remove('hidden');
}

// Upload handlers
uploadBox.addEventListener('click', () => {
  resumeFileInput.click();
});

uploadBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadBox.style.borderColor = '#f97316';
});

uploadBox.addEventListener('dragleave', () => {
  uploadBox.style.borderColor = '#d1d5db';
});

uploadBox.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadBox.style.borderColor = '#d1d5db';
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileSelect(files[0]);
  }
});

resumeFileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

function handleFileSelect(file) {
  if (!file.type.includes('pdf') && !file.type.includes('wordprocessingml')) {
    showUploadStatus('Please select a PDF or DOCX file', 'error');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showUploadStatus('File size must be less than 5MB', 'error');
    return;
  }

  uploadBtn.disabled = false;
  showUploadStatus(`Selected: ${file.name}`, 'success');
}

async function uploadResume() {
  const file = resumeFileInput.files[0];
  if (!file) {
    showUploadStatus('Please select a file first', 'error');
    return;
  }

  // Set operation state
  await chrome.storage.local.set({ operationState: 'uploading' });
  
  uploadBtn.disabled = true;
  showUploadStatus('Uploading...', 'success');

  try {
    const formData = new FormData();
    formData.append('resume', file);

    const uploadUrl = `${window.getApiBaseUrl()}/upload-resume`;
    
    // Get auth token from storage
    const { authToken } = await chrome.storage.local.get(['authToken']);
    
    // Add ngrok-skip-browser-warning header for ngrok free tier
    const headers = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (uploadUrl.includes('ngrok-free.app') || uploadUrl.includes('ngrok-free.dev') || uploadUrl.includes('ngrok.io')) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: headers,
      body: formData,
    });

    // Check content type before parsing JSON
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('Upload API returned HTML:', text.substring(0, 200));
      throw new Error(`API returned HTML instead of JSON. URL: ${uploadUrl}\n\nCheck:\n1. Backend server is running\n2. API URL is correct (click gear icon in popup)\n3. Endpoint exists: /api/upload-resume`);
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Upload failed');
    }

    // Standard response format
    if (data.success && data.data.resumeId) {
      // Clear operation state
      await chrome.storage.local.set({ 
        resumeId: data.data.resumeId,
        operationState: null 
      });
      
      showUploadStatus('Resume uploaded successfully!', 'success');
      setTimeout(() => {
        window.showReadySection();
        checkForSelectedText();
      }, 1000);
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    // Clear operation state on error
    await chrome.storage.local.set({ operationState: null });
    showUploadStatus(error.message, 'error');
    uploadBtn.disabled = false;
  }
}

function showUploadStatus(message, type) {
  uploadStatus.textContent = message;
  uploadStatus.className = `upload-status ${type}`;
  uploadStatus.classList.remove('hidden');
}

uploadBtn.addEventListener('click', uploadResume);

// Check for selected text from context menu
async function checkForSelectedText() {
  const { selectedJobDescription } = await chrome.storage.local.get(['selectedJobDescription']);
  
  if (selectedJobDescription) {
    jobText.textContent = selectedJobDescription;
    showTailorSection();
    // Clear stored text
    chrome.storage.local.remove(['selectedJobDescription']);
    
    // Ensure loading is hidden - never show automatically
    if (loading) {
      loading.classList.add('hidden');
    }
    if (tailorBtn) {
      tailorBtn.disabled = false;
    }
  }
}

// Tailor resume - attach listener immediately
if (tailorBtn) {
  console.log('Attaching click listener to tailor button...');
  tailorBtn.addEventListener('click', async (e) => {
    console.log('🔥 CLICK EVENT FIRED! 🔥');
    e.preventDefault();
    e.stopPropagation();
    
    try {
      console.log('=== TAILOR BUTTON CLICKED ===');
      console.log('Button element exists:', !!tailorBtn);
      console.log('Button disabled:', tailorBtn.disabled);
      console.log('Current time:', new Date().toISOString());
      
      const jobDescription = jobText.textContent;
      const { resumeId } = await chrome.storage.local.get(['resumeId']);

      console.log('Tailor button clicked', { 
        jobDescriptionLength: jobDescription?.length,
        resumeId,
        hasJobDescription: !!jobDescription,
        hasResumeId: !!resumeId,
        jobDescriptionPreview: jobDescription?.substring(0, 50)
      });

      if (!jobDescription || !resumeId) {
        console.error('Missing required data:', { 
          jobDescription: jobDescription || 'EMPTY', 
          resumeId: resumeId || 'EMPTY' 
        });
        window.showError('Please select a job description and ensure your resume is uploaded');
        return;
      }

      // Set operation state for persistence
      await chrome.storage.local.set({ 
        operationState: 'tailoring',
        pendingJobDescription: jobDescription 
      });
      
      console.log('Operation state saved:', { 
        operationState: 'tailoring', 
        pendingJobDescriptionLength: jobDescription.length 
      });

      loading.classList.remove('hidden');
      tailorBtn.disabled = true;
      
      const startTime = Date.now();
      const apiUrl = getApiBaseUrl() + '/tailor-resume';
      
      console.log('=== STARTING API REQUEST ===');
      console.log('Starting API request to tailor resume...', {
        url: apiUrl,
        resumeId,
        jobDescriptionLength: jobDescription.length,
        startTime: new Date(startTime).toISOString()
      });

      // Create a timeout to detect hanging requests
      const timeoutId = setTimeout(() => {
        console.error('API request is taking longer than 10 seconds...');
        console.error('This might indicate the request is hanging or the backend is slow');
      }, 10000);

      try {
        const response = await window.apiRequest(`/tailor-resume`, {
          method: 'POST',
          body: JSON.stringify({
            resumeId,
            jobDescription,
          }),
        });

        clearTimeout(timeoutId);
        
        const duration = Date.now() - startTime;
        console.log('=== API RESPONSE RECEIVED ===');
        console.log('API response received', {
          success: response.success,
          hasData: !!response.data,
          duration_ms: duration,
          duration_seconds: (duration / 1000).toFixed(2),
          responseData: response.data
        });

        // Standard response format
        if (response.success && response.data) {
          // Clear operation state and pending job description
          await chrome.storage.local.set({ 
            operationState: null,
            pendingJobDescription: null 
          });
          
          console.log('Displaying results...');
          displayResults(response.data);
          window.showResultsSection();
          console.log('Results displayed successfully');
        } else {
          throw new Error(response.error || 'Failed to generate tailored content');
        }
      } catch (error) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        console.error('=== TAILOR ERROR ===');
        console.error('Tailor error:', {
          message: error.message,
          stack: error.stack,
          duration_ms: duration,
          duration_seconds: (duration / 1000).toFixed(2),
          error: error
        });
        
        // Clear operation state on error
        await chrome.storage.local.set({ 
          operationState: null,
          pendingJobDescription: null 
        });
        window.showError(error.message);
      } finally {
        loading.classList.add('hidden');
        tailorBtn.disabled = false;
        console.log('=== TAILOR OPERATION FINISHED ===');
      }
    } catch (error) {
      console.error('=== FATAL ERROR IN TAILOR HANDLER ===');
      console.error('Fatal error:', error);
      window.showError('An unexpected error occurred: ' + error.message);
    }
  });
} else {
  console.error('❌ Tailor button element not found! Button ID: tailor-btn');
  console.error('Document ready state:', document.readyState);
  console.error('Available buttons:', {
    tailorBtn: document.getElementById('tailor-btn'),
    uploadBtn: document.getElementById('upload-btn'),
    allButtons: Array.from(document.querySelectorAll('button')).map(btn => ({ 
      id: btn.id, 
      text: btn.textContent?.substring(0, 20),
      visible: btn.offsetParent !== null
    }))
  });
  
  // Try to find it again after a delay
  setTimeout(() => {
    const retryBtn = document.getElementById('tailor-btn');
    if (retryBtn) {
      console.log('✅ Found tailor button on retry, attaching listener now...');
      tailorBtn = retryBtn;
      // Re-attach listener
      tailorBtn.addEventListener('click', async (e) => {
        console.log('🔥 CLICK EVENT FIRED (retry)! 🔥');
        // ... (same handler code)
      });
    } else {
      console.error('❌ Still not found after retry');
    }
  }, 100);
}

// Display results
function displayResults(data) {
  // Professional Summary
  summaryContent.textContent = data.summary || 'No summary generated';

  // Bullet Points
  if (Array.isArray(data.bulletPoints)) {
    const ul = document.createElement('ul');
    data.bulletPoints.forEach(bullet => {
      const li = document.createElement('li');
      li.textContent = bullet;
      ul.appendChild(li);
    });
    bulletsContent.innerHTML = '';
    bulletsContent.appendChild(ul);
  } else {
    bulletsContent.textContent = data.bulletPoints || 'No bullets generated';
  }

  // Keywords
  if (Array.isArray(data.keywords)) {
    keywordsContent.textContent = data.keywords.join(', ');
  } else {
    keywordsContent.textContent = data.keywords || 'No keywords generated';
  }

  // Store results for download
  chrome.storage.local.set({ lastResults: data });
}

// Copy buttons
document.querySelectorAll('.btn-copy').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.target.getAttribute('data-target');
    let text = '';

    switch (target) {
      case 'summary':
        text = summaryContent.textContent;
        break;
      case 'bullets':
        text = bulletsContent.textContent;
        break;
      case 'keywords':
        text = keywordsContent.textContent;
        break;
    }

    navigator.clipboard.writeText(text).then(() => {
      const originalText = e.target.textContent;
      e.target.textContent = 'Copied!';
      setTimeout(() => {
        e.target.textContent = originalText;
      }, 2000);
    });
  });
});

// Download button
downloadBtn.addEventListener('click', async () => {
  const { lastResults } = await chrome.storage.local.get(['lastResults']);
  const { resumeId } = await chrome.storage.local.get(['resumeId']);

  if (!lastResults || !resumeId) {
    window.showError('No results to download');
    return;
  }

  try {
    const downloadUrl = `${getApiBaseUrl()}/download-tailored-resume`;
    
    // Add ngrok-skip-browser-warning header for ngrok free tier
    const headers = {
      'Content-Type': 'application/json',
    };
    if (downloadUrl.includes('ngrok-free.app') || downloadUrl.includes('ngrok-free.dev') || downloadUrl.includes('ngrok.io')) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    
    const response = await fetch(downloadUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        resumeId,
        content: lastResults,
      }),
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tailored-resume.docx';
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    window.showError(error.message);
  }
});

// New tailor button
newTailorBtn.addEventListener('click', () => {
  window.showReadySection();
  checkForSelectedText();
});

// Retry button
retryBtn.addEventListener('click', () => {
  init();
});

// Verify button exists and event listeners are attached
console.log('=== POPUP SCRIPT LOADED ===');
console.log('Initialization check:', {
  tailorBtnExists: !!tailorBtn,
  uploadBtnExists: !!uploadBtn,
  loadingExists: !!loading,
  apiBaseUrl: getApiBaseUrl(),
  timestamp: new Date().toISOString()
});

// Test button click programmatically (for debugging)
if (tailorBtn) {
  console.log('✅ Tailor button found');
  console.log('Tailor button details:', {
    id: tailorBtn.id,
    text: tailorBtn.textContent,
    classes: tailorBtn.className,
    disabled: tailorBtn.disabled,
    hidden: tailorBtn.offsetParent === null,
    parentHidden: tailorSection.classList.contains('hidden')
  });
  
  // Test if we can manually trigger click
  console.log('Testing manual click...');
  setTimeout(() => {
    if (tailorBtn) {
      console.log('Manual click test - you can try: tailorBtn.click() in console');
      // Store in window for debugging
      window.debugTailorBtn = tailorBtn;
      console.log('Button stored in window.debugTailorBtn for manual testing');
    }
  }, 1000);
} else {
  console.error('❌ Tailor button NOT found when script loaded!');
  console.error('Available elements:', {
    allButtons: Array.from(document.querySelectorAll('button')).map(btn => btn.id),
    tailorSection: !!document.getElementById('tailor-section'),
    allSections: Array.from(document.querySelectorAll('.section')).map(s => s.id)
  });
}

// Settings button handler (opens upload section)
const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    window.showUploadSection();
  });
}

// Initialize on load
init();

// Listen for storage changes (when context menu is used)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.selectedJobDescription && changes.selectedJobDescription.newValue) {
    jobText.textContent = changes.selectedJobDescription.newValue;
    showTailorSection();
    
    // Ensure loading is hidden - never show automatically
    if (loading) {
      loading.classList.add('hidden');
    }
    if (tailorBtn) {
      tailorBtn.disabled = false;
    }
  }
});
