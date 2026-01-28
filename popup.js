// Popup script for Resume Tailor extension

// Get API URL from config, storage, or use default
let API_BASE_URL = (typeof EXTENSION_CONFIG !== 'undefined' && EXTENSION_CONFIG.API_BASE_URL) 
  ? EXTENSION_CONFIG.API_BASE_URL 
  : 'http://localhost:3000';

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

const fullDocumentContent = document.getElementById('full-document-content');
const coverLetterContent = document.getElementById('cover-letter-content');

const newTailorBtn = document.getElementById('new-tailor-btn');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');

// Standard API response handler
async function apiRequest(endpoint, options = {}) {
  const requestStartTime = Date.now();
  let url = getApiBaseUrl() + endpoint;
  
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
    
    // Check if URL is ngrok and add skip warning header (always add for ngrok)
    if (url.includes('ngrok-free.app') || url.includes('ngrok-free.dev') || url.includes('ngrok.io') || url.includes('ngrok')) {
      headers['ngrok-skip-browser-warning'] = 'true';
      // Also add as query parameter AFTER the endpoint (not in base URL)
      if (!url.includes('ngrok-skip-browser-warning')) {
        url += (url.includes('?') ? '&' : '?') + 'ngrok-skip-browser-warning=true';
      }
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
    
    // Use centralized response parsing if available
    let data;
    
    if (window.API_CONFIG) {
      // Use centralized parsing
      try {
        data = await window.API_CONFIG.parseResponse(response);
      } catch (parseError) {
        // parseResponse throws error for HTML, re-throw it
        throw parseError;
      }
    } else {
      // Fallback: manual parsing
    const contentType = response.headers.get('content-type');
    
    console.log('Fetch response received', {
      status: response.status,
      statusText: response.statusText,
      contentType: contentType,
      fetch_duration_ms: fetchDuration
    });
    
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
          errorMsg += `1. Make sure your backend is running: npm run dev (Node.js) or php artisan serve (Laravel)\n`;
          errorMsg += `2. Verify ngrok is pointing to the correct port (3000 for Node.js, 8000 for Laravel)\n`;
        errorMsg += `3. Try accessing ${url} directly in your browser\n`;
        errorMsg += `4. Check browser console (F12) for CORS errors\n`;
      } else if (text.includes('404') || text.includes('Not Found')) {
        errorMsg += `⚠️ 404 Not Found - The endpoint doesn't exist.\n\n`;
          errorMsg += `Check:\n1. Backend routes are correct\n2. Backend server is running (Node.js or Laravel)\n3. API prefix is /api\n`;
      } else if (text.includes('500') || text.includes('Internal Server Error')) {
        errorMsg += `⚠️ 500 Server Error - Backend has an error.\n\n`;
          errorMsg += `Check:\n1. Backend logs (check terminal where server is running)\n`;
          errorMsg += `2. Server errors in console\n`;
          errorMsg += `3. All dependencies installed: npm install (Node.js) or composer install (Laravel)\n`;
      } else {
        errorMsg += `This might be:\n`;
        errorMsg += `- ngrok warning/interstitial page\n`;
        errorMsg += `- Laravel error page\n`;
        errorMsg += `- Backend not accessible\n\n`;
        errorMsg += `Try:\n1. Test API directly: ${url}\n`;
          errorMsg += `2. Check backend is running: npm run dev (in backend2 folder)\n`;
        errorMsg += `3. Verify ngrok tunnel is active\n`;
      }
      
      throw new Error(errorMsg);
      }
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
  
  // IMPORTANT: Hide all sections initially to prevent flash
  // Hide auth section by default (it's already hidden in HTML)
  authSection.classList.add('hidden');
  uploadSection.classList.add('hidden');
  readySection.classList.add('hidden');
  tailorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  
  // IMPORTANT: Hide loading immediately on init - never show it automatically
  if (loading) {
    loading.classList.add('hidden');
    console.log('Loading hidden on init');
  }
  
  // Load API URL from config.js (no storage needed - set by developer)
  // API_BASE_URL is already set from config.js at the top of the file
  console.log('API Base URL:', getApiBaseUrl());
  
  // PRIORITY 1: Check for selected text from context menu FIRST (before auth check)
  // This ensures new job descriptions are handled immediately without delay
  const { selectedJobDescription } = await chrome.storage.local.get(['selectedJobDescription']);
  if (selectedJobDescription) {
    console.log('New job description selected from context menu, showing tailor section immediately...');
    
    // Show tailor section immediately with job description (don't wait for auth)
    jobText.textContent = selectedJobDescription;
    window.showTailorSection();
    // Don't remove selectedJobDescription yet - keep it until generation starts
    // This ensures it's available if the user clicks generate before it's displayed
    
    // Clear old results state
    await chrome.storage.local.set({
      currentSection: 'tailor',
      operationState: null,
      pendingJobDescription: null,
    });
    
    // Show a brief loading indicator while checking auth (small, non-intrusive)
    const loadingText = document.createElement('div');
    loadingText.id = 'auth-checking';
    loadingText.style.cssText = 'text-align: center; padding: 5px; color: #9ca3af; font-size: 11px; margin-bottom: 10px;';
    loadingText.textContent = 'Verifying...';
    const tailorContent = tailorSection.querySelector('.section-content') || tailorSection;
    tailorContent.insertBefore(loadingText, tailorContent.firstChild);
    
    // Check authentication in background (non-blocking)
    const { authToken, user } = await chrome.storage.local.get(['authToken', 'user']);
    
    if (!authToken) {
      // No auth token - remove loading text and show auth
      if (loadingText.parentNode) loadingText.remove();
      window.showAuthSection();
      return;
    }
    
    // If we have a token, show user info immediately (optimistic UI)
    if (user) {
      window.updateUserInfo(user);
    }
    
    // Verify token in background (non-blocking for UI)
    window.apiRequest('/me').then(response => {
      // Remove loading text
      if (loadingText.parentNode) loadingText.remove();
      
      if (response.success) {
        chrome.storage.local.set({ user: response.data.user });
        window.updateUserInfo(response.data.user);
        console.log('User authenticated:', response.data.user);
      } else {
        // Token invalid, show auth
        chrome.storage.local.remove(['authToken', 'user']);
        window.showAuthSection();
      }
    }).catch(error => {
      console.error('Auth check failed:', error);
      // Remove loading text
      if (loadingText.parentNode) loadingText.remove();
      // Token invalid or expired, show auth
      chrome.storage.local.remove(['authToken', 'user']);
      window.showAuthSection();
    });
    
    // Enable button immediately (user can see the job description)
    if (tailorBtn) {
      tailorBtn.disabled = false;
    }
    return;
  }
  
  // PRIORITY 2: Check authentication (only if no selected job description)
  const { authToken, user } = await chrome.storage.local.get(['authToken', 'user']);
  
  if (!authToken) {
    console.log('No auth token found, showing auth section');
    window.showAuthSection();
    return;
  }
  
  // If we have a token, show user info immediately (optimistic UI)
  if (user) {
    window.updateUserInfo(user);
  }
  
  // Verify token is still valid (async check)
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
  
  // Check if there's an operation in progress or saved state
  const { 
    operationState, 
    resumeId, 
    pendingJobDescription,
    currentSection,
    lastResults,
    lastViewedAt,
    savedJobDescription
  } = await chrome.storage.local.get([
    'operationState', 
    'resumeId',
    'pendingJobDescription',
    'currentSection',
    'lastResults',
    'lastViewedAt',
    'savedJobDescription'
  ]);

  // Check if generation is in progress - check both StateManager and operationState
  let generationInProgress = false;
  let jobDescriptionToRestore = null;
  
  // First try StateManager if available
  if (window.StateManager && typeof window.StateManager.restoreGenerationState === 'function') {
    try {
      const generationState = await window.StateManager.restoreGenerationState();
      if (generationState && generationState.inProgress) {
        generationInProgress = true;
        jobDescriptionToRestore = generationState.jobDescription;
      }
    } catch (error) {
      console.warn('Error checking generation state via StateManager:', error);
    }
  }
  
  // Also check operationState directly as fallback
  if (!generationInProgress && operationState === 'tailoring') {
    const { generationStartTime, jobDescription: storedJobDescription } = await chrome.storage.local.get(['generationStartTime', 'jobDescription']);
    const elapsed = generationStartTime ? (Date.now() - generationStartTime) : 0;
    
    // If generation started less than 5 minutes ago, consider it in progress
    if (elapsed < 5 * 60 * 1000) {
      generationInProgress = true;
      jobDescriptionToRestore = pendingJobDescription || storedJobDescription;
    } else {
      // Stale state - clear it
      console.log('Stale generation state detected, clearing...');
      await chrome.storage.local.set({ operationState: null, generationStartTime: null });
    }
  }
  
  // If generation is in progress, restore the loading state
  if (generationInProgress && jobDescriptionToRestore) {
    console.log('Generation in progress, restoring loading state...');
    if (jobText) {
      jobText.textContent = jobDescriptionToRestore;
    }
    window.showTailorSection();
    
    // Show loading overlay
    if (loading) {
      loading.classList.remove('hidden');
      if (typeof window.startLoadingMessages === 'function') {
        window.startLoadingMessages();
      }
    }
    
    // Disable the generate button while in progress
    if (tailorBtn) {
      tailorBtn.disabled = true;
    }
    
    // Note: The actual API request may still be in progress on the backend
    // The user can see the loading state, and if they wait, results will appear
    // If the request already completed, they may need to refresh or check results
    return;
  }
  
  console.log('Popup initialization state:', {
    operationState,
    currentSection,
    hasResumeId: !!resumeId,
    hasPendingJobDescription: !!pendingJobDescription,
    hasLastResults: !!lastResults,
    lastViewedAt,
    hasSavedJobDescription: !!savedJobDescription
  });
  
  // Only restore results if:
  // 1. No operation is in progress
  // 2. Results section was the last viewed section
  // 3. Results exist and were viewed recently (within 24 hours)
  // 4. User is not starting a new tailoring operation (no pending job description)
  // 5. User has a resume (not a new account)
  const shouldRestoreResults = 
    !operationState && // No active operation
    currentSection === 'results' && // Was viewing results
    lastResults && // Results exist
    lastViewedAt && // Has timestamp
    (Date.now() - lastViewedAt < 86400000) && // Within 24 hours
    !pendingJobDescription && // Not starting a new tailoring
    resumeId; // User has a resume (not a new account)
  
  // After login, prioritize home page (unless there's a selected job description)
  // Only show upload if no resume exists (new account)
  
  // Check for selected job description first (highest priority)
  const { selectedJobDescription: checkSelected } = await chrome.storage.local.get(['selectedJobDescription']);
  if (checkSelected) {
    // New job description selected - show tailor section
    console.log('Job description found, showing tailor section...');
    jobText.textContent = checkSelected;
      window.showTailorSection();
    chrome.storage.local.remove(['selectedJobDescription']);
      if (loading) {
        loading.classList.add('hidden');
      }
      if (tailorBtn) {
        tailorBtn.disabled = false;
      }
    return;
  }
  
  // Only restore results if:
  // 1. Explicitly viewing results (not after login)
  // 2. User has a resume (not a new account)
  // 3. Results belong to current user's resume
  if (shouldRestoreResults && currentSection === 'results' && resumeId) {
    // Verify the resumeId matches before restoring results
    // This prevents showing old results from a different account
    const { resumeId: storedResumeId } = await chrome.storage.local.get(['resumeId']);
    if (storedResumeId === resumeId) {
      console.log('Restoring results section from saved state...');
      await displayResults(lastResults);
      window.showResultsSection();
      return;
    } else {
      // Resume ID mismatch - clear old results
      console.log('Resume ID mismatch, clearing old results');
      await chrome.storage.local.remove(['lastResults', 'downloadUrls', 'currentSection']);
    }
  }
  
  // Clear any stale operation state after login
  if (operationState === 'tailoring' || operationState === 'uploading') {
    await chrome.storage.local.set({ 
      operationState: null,
      pendingJobDescription: null
    });
  }
  
  if (resumeId) {
    // Normal state - resume uploaded, show home page
    // Only show tailor section if there's a new selected job description
    const { selectedJobDescription: checkSelected } = await chrome.storage.local.get(['selectedJobDescription']);
    if (checkSelected) {
      // New job description selected - show tailor section
      console.log('Job description found, showing tailor section...');
      await chrome.storage.local.set({
        currentSection: 'tailor',
        operationState: null,
        pendingJobDescription: null,
      });
      
      jobText.textContent = checkSelected;
      window.showTailorSection();
      chrome.storage.local.remove(['selectedJobDescription']);
      
      if (loading) {
        loading.classList.add('hidden');
      }
      if (tailorBtn) {
        tailorBtn.disabled = false;
      }
    } else {
      // No new selection - show home page (ready section)
      console.log('Resume already uploaded, showing home page');
      window.showReadySection();
      loadResumeInfo(); // Load and display stats
    }
  } else {
    // No resumeId in storage - try to fetch default resume from API
    console.log('No resumeId in storage, fetching default resume from API...');
    try {
      const { authToken } = await chrome.storage.local.get(['authToken']);
      if (!authToken) {
        console.log('No auth token, showing upload section');
        window.showUploadSection();
        return;
      }
      
      console.log('Fetching default resume from API...');
      const response = await window.apiRequest('/resume');
      console.log('Resume API response:', response);
      
      if (response.success && response.data) {
        const resumeId = response.data.resumeId;
        console.log('Resume data received:', { 
          resumeId, 
          filename: response.data.filename,
          hasResumeId: !!resumeId 
        });
        
        if (resumeId) {
          // Save resumeId to storage
          await chrome.storage.local.set({
            resumeId: resumeId,
            resumeFilename: response.data.filename,
            resumeCloudinaryUrl: response.data.cloudinaryUrl,
            resumeUploadedAt: response.data.uploadedAt,
          });
          console.log('Default resume loaded and saved:', resumeId);
          
          // Check for selected job description
          const { selectedJobDescription: checkSelected } = await chrome.storage.local.get(['selectedJobDescription']);
          if (checkSelected) {
            jobText.textContent = checkSelected;
            window.showTailorSection();
          } else {
            // Show home page after login
            window.showReadySection();
          }
          loadResumeInfo();
          return;
        } else {
          console.warn('API returned resume data but no resumeId:', response.data);
        }
      } else {
        console.warn('API response not successful or no data:', response);
      }
    } catch (error) {
      console.error('Failed to fetch default resume:', error);
      // Don't show error to user, just show upload section
    }
    
    // If we get here, no resume found - new account, show upload section
    console.log('No resume found, showing upload section (new account)');
    window.showUploadSection();
  }
  
  console.log('Popup initialization complete');
}

// Show sections - functions are defined in ui.js, but we keep state saving logic here
// The actual UI manipulation is handled by ui.js functions

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
  uploadBox.style.borderColor = '#3b82f6';
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

    // Use centralized API config
    const uploadUrl = window.API_CONFIG ? window.API_CONFIG.buildUrl('/upload-resume') : `${getApiBaseUrl()}/upload-resume`;
    const authToken = window.API_CONFIG ? await window.API_CONFIG.getAuthToken() : (await chrome.storage.local.get(['authToken'])).authToken;
    
    // Build headers - DON'T set Content-Type for FormData (browser sets it automatically with boundary)
    // But we MUST include ngrok-skip-browser-warning header
    const headers = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // CRITICAL: Add ngrok skip header - this MUST be present to bypass ngrok warning page
    if (window.API_CONFIG) {
      if (window.API_CONFIG.isNgrokUrl(uploadUrl)) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    } else {
      // Fallback: manual check
      if (uploadUrl.includes('ngrok-free.app') || uploadUrl.includes('ngrok-free.dev') || uploadUrl.includes('ngrok.io') || uploadUrl.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
      }
    }
    
    console.log('Upload request:', { 
      uploadUrl, 
      headers: Object.keys(headers),
      hasNgrokHeader: !!headers['ngrok-skip-browser-warning'],
      fileName: file.name,
      fileSize: file.size
    });
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: headers, // Don't set Content-Type - browser will set it with boundary for FormData
      body: formData,
    });

    console.log('Upload response received:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      url: uploadUrl
    });

    // Use centralized response parsing if available
    let data;
    if (window.API_CONFIG) {
      try {
        data = await window.API_CONFIG.parseResponse(response);
      } catch (parseError) {
        // parseResponse throws error for HTML, re-throw it with more context
        console.error('Upload parse error:', parseError);
        throw parseError;
      }
    } else {
      // Fallback: manual check
      const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
        console.error('Upload API returned HTML:', text.substring(0, 500));
        throw new Error(`API returned HTML instead of JSON. URL: ${uploadUrl}\n\nCheck:\n1. Backend server is running (npm run dev in backend2)\n2. API URL is correct (click gear icon in popup)\n3. Endpoint exists: /api/upload-resume\n4. ngrok is pointing to port 3000 (not 8000)\n5. ngrok-skip-browser-warning header is being sent (check Network tab in browser console)`);
      }
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Upload failed');
    }

    // Standard response format
    if (data.success && data.data.resumeId) {
      // Clear operation state and save resume info
      await chrome.storage.local.set({ 
        resumeId: data.data.resumeId,
        resumeFilename: data.data.filename || 'resume.pdf',
        resumeCloudinaryUrl: data.data.cloudinaryUrl,
        resumeUploadedAt: data.data.uploadedAt,
        operationState: null 
      });
      
      showUploadStatus('Resume uploaded successfully!', 'success');
      setTimeout(() => {
        hideUploadStatus(); // Hide status before showing ready section
        window.showReadySection();
        loadResumeInfo(); // Load and display resume info
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
  if (!uploadStatus) return;
  uploadStatus.textContent = message;
  uploadStatus.className = `upload-status ${type}`;
  uploadStatus.classList.remove('hidden');
}

function hideUploadStatus() {
  if (!uploadStatus) return;
  uploadStatus.classList.add('hidden');
}

uploadBtn.addEventListener('click', uploadResume);

// Load and display home page stats
async function loadResumeInfo() {
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    if (!authToken) {
      return; // Not authenticated
    }
    
    // Fetch all resumes to get stats
    const resumesResponse = await window.apiRequest('/resumes?page=1&limit=100');
    const { lastResults } = await chrome.storage.local.get(['lastResults']);

    let totalResumes = 0;
    let totalGenerated = 0;
    let lastGeneratedDate = null;

    if (resumesResponse.success && resumesResponse.data) {
      totalResumes = resumesResponse.data.pagination?.total || resumesResponse.data.resumes?.length || 0;
      
      // Count resumes with tailored content
      const resumes = resumesResponse.data.resumes || [];
      totalGenerated = resumes.filter(r => r.hasTailoredContent).length;

      // Find most recent generated date
      const generatedDates = resumes
        .filter(r => r.currentVersion?.updatedAt)
        .map(r => new Date(r.currentVersion.updatedAt))
        .sort((a, b) => b - a);
      
      if (generatedDates.length > 0) {
        lastGeneratedDate = generatedDates[0];
      } else if (lastResults) {
        // Fallback to lastResults if available
        const lastViewed = await chrome.storage.local.get(['lastViewedAt']);
        if (lastViewed.lastViewedAt) {
          lastGeneratedDate = new Date(lastViewed.lastViewedAt);
        }
      }
    }

    // Update stats display
    const statResumes = document.getElementById('stat-resumes');
    const statGenerated = document.getElementById('stat-generated');

    if (statResumes) {
      statResumes.textContent = totalResumes;
    }
    if (statGenerated) {
      statGenerated.textContent = totalGenerated;
    }
  } catch (error) {
    console.error('Failed to load home stats:', error);
  }
}

// Display resume information in the UI
function displayResumeInfo(filename, cloudinaryUrl, uploadedAt) {
  const resumeFilename = document.getElementById('resume-filename');
  const resumeUploadDate = document.getElementById('resume-upload-date');
  const resumeInfoCard = document.getElementById('resume-info-card');
  
  if (resumeFilename) {
    resumeFilename.textContent = filename;
  }
  
  if (resumeUploadDate && uploadedAt) {
    try {
      const date = new Date(uploadedAt);
      const formattedDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      resumeUploadDate.textContent = `Uploaded: ${formattedDate}`;
    } catch (e) {
      resumeUploadDate.textContent = '';
    }
  }
  
  if (resumeInfoCard) {
    resumeInfoCard.style.display = 'block';
  }
}

// Check for selected text from context menu
// NOTE: This is now called from init() before showing ready section
// This function is kept for backward compatibility but may not be needed
async function checkForSelectedText() {
  const { selectedJobDescription } = await chrome.storage.local.get(['selectedJobDescription']);
  
  if (selectedJobDescription) {
    // New job description selected - clear old results state
    await chrome.storage.local.set({
      currentSection: 'tailor',
      operationState: null, // Clear any pending operation
      pendingJobDescription: null, // Clear old pending description
      // Keep lastResults for reference, but don't auto-restore
    });
    
    jobText.textContent = selectedJobDescription;
    window.showTailorSection();
    // Don't remove selectedJobDescription yet - keep it until generation starts
    // This ensures it's available if the user clicks generate before it's displayed
    
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
      
      // Get job description from multiple sources
      let jobDescription = '';
      
      // 1. Try to get from the displayed text element
      if (jobText) {
        jobDescription = jobText.textContent || jobText.innerText || jobText.value || '';
      }
      
      // 2. If empty, try to get from storage (in case it was set but not displayed)
      if (!jobDescription || jobDescription.trim().length === 0) {
        const storage = await chrome.storage.local.get(['selectedJobDescription', 'savedJobDescription']);
        if (storage.selectedJobDescription) {
          jobDescription = storage.selectedJobDescription;
          if (jobText) {
            jobText.textContent = storage.selectedJobDescription;
          }
        } else if (storage.savedJobDescription) {
          jobDescription = storage.savedJobDescription;
          if (jobText) {
            jobText.textContent = storage.savedJobDescription;
          }
        }
      }
      
      // 3. Trim whitespace
      jobDescription = jobDescription.trim();
      
      let resumeId = (await chrome.storage.local.get(['resumeId'])).resumeId;

      console.log('Tailor button clicked', { 
        jobDescriptionLength: jobDescription?.length,
        resumeId,
        hasJobDescription: !!jobDescription && jobDescription.length > 0,
        hasResumeId: !!resumeId,
        jobTextExists: !!jobText,
        jobTextContent: jobText?.textContent?.substring(0, 50),
        jobDescriptionPreview: jobDescription?.substring(0, 50)
      });

      if (!jobDescription || jobDescription.length === 0) {
        console.error('Missing job description:', { 
          jobTextExists: !!jobText,
          jobTextContent: jobText?.textContent,
          jobTextInnerText: jobText?.innerText,
          storage: await chrome.storage.local.get(['selectedJobDescription', 'savedJobDescription'])
        });
        window.showError('Please select a job description by highlighting text on a webpage and right-clicking to choose "Tailor resume to this role"');
        return;
      }
      
      // If no resumeId, try to fetch from API
      if (!resumeId) {
        console.log('No resumeId in storage, fetching from API...');
        try {
          const response = await window.apiRequest('/resume');
          console.log('Resume API response:', response);
          
          if (response.success && response.data && response.data.resumeId) {
            resumeId = response.data.resumeId;
            console.log('Fetched resumeId from API:', resumeId);
            
            // Save to storage for future use
            await chrome.storage.local.set({
              resumeId: resumeId,
              resumeFilename: response.data.filename,
              resumeCloudinaryUrl: response.data.cloudinaryUrl,
              resumeUploadedAt: response.data.uploadedAt,
            });
          } else {
            console.error('No resume found in API response:', response);
            window.showError('Please upload your resume first');
            return;
          }
        } catch (error) {
          console.error('Failed to fetch resume from API:', error);
          window.showError('Please upload your resume first');
          return;
        }
      }
      
      // Final check - if still no resumeId, show error
      if (!resumeId) {
        console.error('ResumeId still missing after API fetch attempt');
        window.showError('Please upload your resume first');
        return;
      }

      // Set operation state for persistence and clear old results
      // Store jobDescription and generateFreely for potential regeneration
      const generateFreelyToggle = document.getElementById('generate-freely-toggle');
      const generateFreely = generateFreelyToggle ? generateFreelyToggle.checked : false;
      
      // Get custom mode and instructions
      const customModeToggle = document.getElementById('custom-mode-toggle');
      const customMode = customModeToggle ? customModeToggle.checked : false;
      const customInstructionsInput = document.getElementById('custom-instructions');
      const customInstructions = customMode && customInstructionsInput ? customInstructionsInput.value.trim() : '';
      
      // Store generation start time for persistence tracking
      const generationStartTime = Date.now();
      
      // Clear selectedJobDescription from storage since generation is starting
      await chrome.storage.local.remove(['selectedJobDescription']);
      
      await chrome.storage.local.set({ 
        operationState: 'tailoring',
        pendingJobDescription: jobDescription,
        jobDescription: jobDescription, // Store for regeneration
        generateFreely: generateFreely, // Store for regeneration
        customMode: customMode, // Store custom mode
        customInstructions: customInstructions, // Store custom instructions
        currentSection: 'tailor', // Update section to tailor (not results)
        generationStartTime: generationStartTime, // Track when generation started
        // Don't clear lastResults yet - we'll update it after successful generation
      });
      
      console.log('Operation state saved:', { 
        operationState: 'tailoring', 
        pendingJobDescriptionLength: jobDescription.length 
      });

      loading.classList.remove('hidden');
      tailorBtn.disabled = true;
      
      // Start rotating messages
      startLoadingMessages();
      
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
        // Get generate freely and custom instructions from storage (already stored above)
        const { generateFreely: storedGenerateFreely, customMode: storedCustomMode, customInstructions: storedCustomInstructions } = await chrome.storage.local.get(['generateFreely', 'customMode', 'customInstructions']);
        const generateFreely = storedGenerateFreely !== undefined ? storedGenerateFreely : false;
        const customMode = storedCustomMode !== undefined ? storedCustomMode : false;
        const customInstructions = storedCustomInstructions || '';
        
        const response = await window.apiRequest(`/tailor-resume`, {
          method: 'POST',
          body: JSON.stringify({
            resumeId,
            jobDescription,
            generateFreely: generateFreely, // Send toggle value
            customMode: customMode, // Send custom mode flag
            customInstructions: customInstructions, // Send custom instructions if provided
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
          console.log('=== TAILORED CONTENT RECEIVED ===');
          console.log('Download URLs:', response.data.downloadUrls);
          console.log('DOCX URL:', response.data.downloadUrls?.docx);
          console.log('PDF URL:', response.data.downloadUrls?.pdf);
          console.log('Full document length:', response.data.fullDocument?.length);
          console.log('Cover letter length:', response.data.coverLetter?.length);
          
          console.log('Displaying results...');
          await displayResults(response.data);
          
              // Clear operation state AFTER displaying results
              if (window.StateManager && typeof window.StateManager.clearGenerationState === 'function') {
                await window.StateManager.clearGenerationState();
              } else {
          await chrome.storage.local.set({ 
            operationState: null,
            pendingJobDescription: null,
            generationStartTime: null, // Clear generation start time
                });
              }
              await chrome.storage.local.set({
            savedJobDescription: jobDescription // Save the job description for this result
          });
          
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
             if (window.StateManager && typeof window.StateManager.clearGenerationState === 'function') {
               await window.StateManager.clearGenerationState();
             } else {
        await chrome.storage.local.set({ 
          operationState: null,
                 pendingJobDescription: null,
          generationStartTime: null, // Clear generation start time
        });
             }
        window.showError(error.message);
      } finally {
        stopLoadingMessages();
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
async function displayResults(data) {
  console.log('Displaying results:', {
    hasFullResume: !!data.fullResume,
    hasFullDocument: !!data.fullDocument,
    hasCoverLetter: !!data.coverLetter,
    dataKeys: Object.keys(data)
  });

  // Full Resume Preview (backend returns 'fullResume', not 'fullDocument')
  const fullResumeText = data.fullResume || data.fullDocument || '';
  if (fullResumeText && fullResumeText.trim().length > 0) {
    fullDocumentContent.value = fullResumeText;
  } else {
    console.error('No resume text found in response');
    fullDocumentContent.value = 'Resume not available';
  }

  // Cover Letter
  if (data.coverLetter && data.coverLetter.trim().length > 0) {
    coverLetterContent.value = data.coverLetter;
  } else {
    console.error('No cover letter found in response');
    coverLetterContent.value = 'Cover letter not available';
  }

  // Store results for download (including download URLs)
  // URLs are stored in TWO places for redundancy:
  // 1. Top-level downloadUrls key
  // 2. Inside lastResults.downloadUrls
  await chrome.storage.local.set({ 
    lastResults: {
      ...data,
      fullResume: fullResumeText, // Ensure fullResume is stored
      fullDocument: fullResumeText // Keep for backward compatibility
    },
    downloadUrls: data.downloadUrls || null
  });
  
  // Display quality scores and similarity metrics if available
  if (typeof window.displayQualityScores === 'function' && data.qualityScore && data.similarityMetrics) {
    window.displayQualityScores(data.qualityScore, data.similarityMetrics);
  }

  // Setup regenerate button handler
  const regenerateBtn = document.getElementById('regenerate-btn');
  if (regenerateBtn) {
    regenerateBtn.onclick = async () => {
      await handleRegenerate(data);
    };
  }
  
  console.log('=== DOWNLOAD URLS STORED ===');
  console.log('Stored in chrome.storage.local:');
  console.log('  - downloadUrls (top level):', data.downloadUrls);
  console.log('  - lastResults.downloadUrls:', data.downloadUrls);
  console.log('Cloudinary folder: tailored-resumes');
}

// Handle regenerate button click
async function handleRegenerate(currentData) {
  try {
    const regenerateBtn = document.getElementById('regenerate-btn');
    if (regenerateBtn) {
      regenerateBtn.disabled = true;
      regenerateBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        <span>Regenerating...</span>
      `;
    }

    // Show loading overlay with rotating messages
    if (loading) {
      loading.classList.remove('hidden');
      // Start regeneration-specific loading messages
      if (typeof window.startRegenerationMessages === 'function') {
        window.startRegenerationMessages();
      } else {
        // Fallback: use regular loading messages
        if (typeof window.startLoadingMessages === 'function') {
          window.startLoadingMessages();
        }
      }
    }

    // Get current data
    const { resumeId } = await chrome.storage.local.get(['resumeId']);
    const { jobDescription, generateFreely } = await chrome.storage.local.get(['jobDescription', 'generateFreely']);
    
    if (!resumeId || !jobDescription) {
      // Try to get from current results
      const storedResults = await chrome.storage.local.get(['lastResults']);
      if (storedResults.lastResults) {
        // Extract from stored results if available
        throw new Error('Please generate a resume first before regenerating');
      } else {
        throw new Error('Missing resume ID or job description');
      }
    }

    // Get missing keywords from current results - filter out noise words
    const allMissingKeywords = currentData.similarityMetrics?.missingKeywords || [];
    const matchedKeywords = currentData.similarityMetrics?.matchedKeywords || [];
    const noiseWords = ['intern', 'posted', 'save', 'share', 'apply', 'days', 'ago', 'united', 'states', 'work', 'home', 'part', 'time', 'hours', 'week', 'authorization', 'required', 'open', 'candidates', 'opt', 'cpt'];
    const missingKeywords = allMissingKeywords.filter(kw => {
      const lower = kw.toLowerCase();
      return !noiseWords.some(noise => lower.includes(noise)) && kw.length > 2;
    }).slice(0, 30); // Limit to top 30 most important
    
    const currentResumeText = fullDocumentContent?.value || '';

    console.log('Regenerating with missing keywords:', missingKeywords);
    console.log('Preserving matched keywords:', matchedKeywords);
    console.log('Total missing keywords:', allMissingKeywords.length, 'Filtered:', missingKeywords.length);

    // Call regenerate endpoint
    const response = await window.apiRequest('/regenerate-resume', {
      method: 'POST',
      body: JSON.stringify({
        resumeId,
        jobDescription,
        generateFreely: generateFreely === true || generateFreely === 'true',
        missingKeywords,
        matchedKeywords, // Pass matched keywords to preserve them
        currentResumeText,
      }),
    });

    if (response.success && response.data) {
      // Update results with regenerated content
      await displayResults(response.data);
      
      // Show success message
      if (window.showToast) {
        window.showToast('Resume regenerated successfully! Match score improved.', 'success');
      }

      // Hide loading
      if (loading) {
        loading.classList.add('hidden');
      }

      // Reset button
      if (regenerateBtn) {
        regenerateBtn.disabled = false;
        regenerateBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>Regenerate</span>
        `;
      }
    } else {
      throw new Error(response.error || 'Failed to regenerate resume');
    }
  } catch (error) {
    console.error('Regenerate error:', error);
    if (window.showToast) {
      window.showToast('Failed to regenerate resume: ' + error.message, 'error');
    }
    
    // Hide loading
    if (loading) {
      loading.classList.add('hidden');
    }

    // Reset button
    const regenerateBtn = document.getElementById('regenerate-btn');
    if (regenerateBtn) {
      regenerateBtn.disabled = false;
      regenerateBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        <span>Regenerate</span>
      `;
    }
  }
}

// Copy buttons (updated for icon buttons with clipboard fallback)
document.querySelectorAll('.btn-copy').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Get target from button, not event target (in case icon is clicked)
    const target = btn.getAttribute('data-target') || btn.closest('.btn-copy')?.getAttribute('data-target');
    let text = '';

    switch (target) {
      case 'full-document':
        text = fullDocumentContent?.value || '';
        break;
      case 'cover-letter':
        text = coverLetterContent?.value || '';
        break;
    }

    if (!text) return;

    const showCopiedFeedback = () => {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      btn.style.color = '#10b981';
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.color = '';
      }, 2000);
    };

    // Prefer modern clipboard API when available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showCopiedFeedback();
    }).catch(err => {
        console.error('navigator.clipboard.writeText failed, falling back to execCommand:', err);
        try {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (successful) {
            showCopiedFeedback();
          }
        } catch (fallbackErr) {
          console.error('Fallback copy failed:', fallbackErr);
        }
      });
    } else {
      // Fallback for environments without navigator.clipboard
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
          showCopiedFeedback();
        }
      } catch (err) {
        console.error('Copy not supported in this environment:', err);
      }
    }
  });
});

// Download dropdown functionality
const downloadBtn = document.querySelector('.btn-download');
const downloadDropdown = document.querySelector('.download-dropdown-menu');
const downloadOptions = document.querySelectorAll('.download-option');

if (downloadBtn && downloadDropdown) {
  // Toggle dropdown
  downloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadDropdown.classList.toggle('hidden');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!downloadBtn.contains(e.target) && !downloadDropdown.contains(e.target)) {
      downloadDropdown.classList.add('hidden');
  }
  });

  // Handle download option clicks
  downloadOptions.forEach(option => {
    option.addEventListener('click', async (e) => {
      e.stopPropagation();
      const format = option.getAttribute('data-format');
      downloadDropdown.classList.add('hidden');
      
      // Show loading state on download button
      if (downloadBtn) {
        downloadBtn.classList.add('loading');
        downloadBtn.disabled = true;
        const originalHTML = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
        
        try {
          await downloadTailoredResume(format);
        } finally {
          // Remove loading state
          downloadBtn.classList.remove('loading');
      downloadBtn.disabled = false;
          downloadBtn.innerHTML = originalHTML;
    }
      } else {
        await downloadTailoredResume(format);
      }
    });
  });
}

// Note: Save functionality removed - download always uses current textarea content

// Download function (shared for both formats) - now uses DownloadHandler
async function downloadTailoredResume(format) {
  await window.DownloadHandler.downloadTailoredResume(format);
}

// Download buttons are now handled by the dropdown (see above)

// New tailor button
newTailorBtn.addEventListener('click', async () => {
  // Clear saved results state and any pending operations
  await chrome.storage.local.set({ 
    currentSection: 'ready',
    lastResults: null,
    lastViewedAt: null,
    savedJobDescription: null,
    operationState: null,
    pendingJobDescription: null
  });
  window.showReadySection();
  loadResumeInfo(); // Load and display resume info
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

// Menu toggle and handlers
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const menuDropdown = document.getElementById('menu-dropdown');
const menuHome = document.getElementById('menu-home');
const menuLastGenerated = document.getElementById('menu-last-generated');
const menuSettings = document.getElementById('menu-settings');

if (menuToggleBtn && menuDropdown) {
  menuToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('hidden');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!menuToggleBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
      menuDropdown.classList.add('hidden');
    }
  });
}

// Home menu item - go to ready section (home page after login)
if (menuHome) {
  menuHome.addEventListener('click', async (e) => {
    e.preventDefault();
    menuDropdown.classList.add('hidden');
    
    // Check if user has resume, if yes show ready section, otherwise show upload
    const { resumeId } = await chrome.storage.local.get(['resumeId']);
    if (resumeId) {
      window.showReadySection();
      if (typeof loadResumeInfo === 'function') {
        loadResumeInfo();
      }
    } else {
      // Try to fetch default resume
      try {
        const response = await window.apiRequest('/resume');
        if (response.success && response.data && response.data.resumeId) {
          await chrome.storage.local.set({
            resumeId: response.data.resumeId,
            resumeFilename: response.data.filename,
            resumeCloudinaryUrl: response.data.cloudinaryUrl,
            resumeUploadedAt: response.data.uploadedAt,
          });
          window.showReadySection();
          if (typeof loadResumeInfo === 'function') {
            loadResumeInfo();
          }
        } else {
    window.showUploadSection();
        }
      } catch (error) {
        console.error('Failed to fetch resume:', error);
        window.showUploadSection();
      }
    }
  });
}

// Home page action buttons
const homeGenerateBtn = document.getElementById('home-generate-btn');
const homeSettingsBtn = document.getElementById('home-settings-btn');

if (homeGenerateBtn) {
  homeGenerateBtn.addEventListener('click', () => {
    // Check for selected text first
    if (typeof checkForSelectedText === 'function') {
      checkForSelectedText();
    }
    // If no selected text, show tailor section with instructions
    setTimeout(() => {
      const jobText = document.getElementById('job-text');
      if (!jobText || !jobText.textContent || jobText.textContent.trim().length === 0) {
        window.showTailorSection();
      }
    }, 100);
  });
}

if (homeSettingsBtn) {
  homeSettingsBtn.addEventListener('click', () => {
    window.showSettingsSection();
  });
}

// Last Generated Content menu item - go to results section
if (menuLastGenerated) {
  menuLastGenerated.addEventListener('click', async (e) => {
    e.preventDefault();
    menuDropdown.classList.add('hidden');
    
    // Check if there are saved results
    const { lastResults } = await chrome.storage.local.get(['lastResults']);
    if (lastResults) {
      // Restore and display results
      if (typeof displayResults === 'function') {
        await displayResults(lastResults);
      }
      window.showResultsSection();
    } else {
      // No results found, show message and go to home
      window.showError('No generated content found. Please generate a tailored resume first.');
      setTimeout(async () => {
        const { resumeId } = await chrome.storage.local.get(['resumeId']);
        if (resumeId) {
          window.showReadySection();
        } else {
          window.showUploadSection();
        }
      }, 2000);
    }
  });
}

// Settings menu item
if (menuSettings) {
  menuSettings.addEventListener('click', (e) => {
    e.preventDefault();
    menuDropdown.classList.add('hidden');
    window.showSettingsSection(); // Show settings section in popup
  });
}

// Settings section handlers
const settingsBackBtn = document.getElementById('settings-back-btn');
if (settingsBackBtn) {
  settingsBackBtn.addEventListener('click', async () => {
    // Go back to previous section or ready section
    const { resumeId } = await chrome.storage.local.get(['resumeId']);
    if (resumeId) {
      window.showReadySection();
      if (typeof loadResumeInfo === 'function') {
        loadResumeInfo();
      }
    } else {
    window.showUploadSection();
    }
  });
}

// Download resume button handler
const downloadResumeBtn = document.getElementById('download-resume-btn');
if (downloadResumeBtn) {
  downloadResumeBtn.addEventListener('click', async () => {
    try {
      const { resumeCloudinaryUrl, resumeFilename } = await chrome.storage.local.get([
        'resumeCloudinaryUrl', 
        'resumeFilename'
      ]);
      
      if (!resumeCloudinaryUrl) {
        // Try to fetch from API
        const response = await window.apiRequest('/resume');
        if (response.success && response.data.cloudinaryUrl) {
          const url = response.data.cloudinaryUrl;
          const filename = response.data.filename || 'resume.pdf';
          // Download from Cloudinary URL
          window.open(url, '_blank');
        } else {
          window.showError('Resume URL not found');
        }
        return;
      }
      
      // Download from Cloudinary URL
      const filename = resumeFilename || 'resume.pdf';
      window.open(resumeCloudinaryUrl, '_blank');
      
    } catch (error) {
      console.error('Download error:', error);
      window.showError('Failed to download resume: ' + error.message);
    }
  });
}

// Close success status card button handler
const closeSuccessBtn = document.getElementById('close-success-btn');
if (closeSuccessBtn) {
  closeSuccessBtn.addEventListener('click', () => {
    const successStatusCard = document.getElementById('success-status-card');
    if (successStatusCard) {
      successStatusCard.style.display = 'none';
    }
  });
}

// Setup authentication handlers
if (typeof window.setupAuthHandlers === 'function') {
  window.setupAuthHandlers();
}

// Loading messages rotation with AI-themed messages
let loadingMessageInterval = null;
const loadingMessages = [
  { main: 'Thinking...', sub: 'Analyzing your resume and job description' },
  { main: 'Scanning...', sub: 'Reading every line of the job description' },
  { main: 'Analyzing...', sub: 'Extracting keywords, skills, and requirements' },
  { main: 'Matching...', sub: 'Aligning your experience with the role' },
  { main: 'Checking ATS...', sub: 'Optimizing for applicant tracking systems' },
  { main: 'Generating...', sub: 'Drafting tailored resume content' },
  { main: 'Writing...', sub: 'Crafting your professional cover letter' },
  { main: 'Finalizing...', sub: 'Polishing and formatting documents' },
];

// Regeneration-specific messages
const regenerationMessages = [
  { main: 'Enhancing...', sub: 'Reviewing your current resume and improvements' },
  { main: 'Integrating...', sub: 'Adding missing keywords naturally' },
  { main: 'Optimizing...', sub: 'Improving keyword alignment and flow' },
  { main: 'Refining...', sub: 'Making content more targeted and relevant' },
  { main: 'Polishing...', sub: 'Ensuring natural, professional language' },
  { main: 'Finalizing...', sub: 'Preparing your enhanced resume' },
];

function startLoadingMessages() {
  const mainText = document.getElementById('loading-main-text');
  const subText = document.getElementById('loading-sub-text');
  if (!mainText || !subText) return;
  
  let messageIndex = 0;
  mainText.textContent = loadingMessages[0].main;
  subText.textContent = loadingMessages[0].sub;
  
  loadingMessageInterval = setInterval(() => {
    messageIndex = (messageIndex + 1) % loadingMessages.length;
    const message = loadingMessages[messageIndex];
    
    // Fade out
    mainText.classList.add('fade-out');
    subText.classList.add('fade-out');
    
    setTimeout(() => {
      mainText.textContent = message.main;
      subText.textContent = message.sub;
      mainText.classList.remove('fade-out');
      subText.classList.remove('fade-out');
      mainText.classList.add('fade-in');
      subText.classList.add('fade-in');
      
      setTimeout(() => {
        mainText.classList.remove('fade-in');
        subText.classList.remove('fade-in');
      }, 250);
    }, 250);
  }, 3500); // Change message every 3.5 seconds (slower, more readable)
}

function stopLoadingMessages() {
  if (loadingMessageInterval) {
    clearInterval(loadingMessageInterval);
    loadingMessageInterval = null;
  }
  
  const mainText = document.getElementById('loading-main-text');
  const subText = document.getElementById('loading-sub-text');
  if (mainText && subText) {
    mainText.textContent = 'Generating your tailored resume content...';
    subText.textContent = '';
    mainText.classList.remove('fade-out', 'fade-in');
    subText.classList.remove('fade-out', 'fade-in');
  }
}

// Start regeneration-specific loading messages
window.startRegenerationMessages = function() {
  const mainText = document.getElementById('loading-main-text');
  const subText = document.getElementById('loading-sub-text');
  if (!mainText || !subText) return;
  
  // Stop any existing messages
  stopLoadingMessages();
  
  let messageIndex = 0;
  mainText.textContent = regenerationMessages[0].main;
  subText.textContent = regenerationMessages[0].sub;
  
  loadingMessageInterval = setInterval(() => {
    messageIndex = (messageIndex + 1) % regenerationMessages.length;
    const message = regenerationMessages[messageIndex];
    
    // Fade out
    mainText.classList.add('fade-out');
    subText.classList.add('fade-out');
    
    setTimeout(() => {
      mainText.textContent = message.main;
      subText.textContent = message.sub;
      mainText.classList.remove('fade-out');
      subText.classList.remove('fade-out');
      mainText.classList.add('fade-in');
      subText.classList.add('fade-in');
      
      setTimeout(() => {
        mainText.classList.remove('fade-in');
        subText.classList.remove('fade-in');
      }, 250);
    }, 250);
  }, 3500); // Change message every 3.5 seconds
};

// Auto-save edited content (debounced)
let saveTimeout = null;
function autoSaveContent() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(async () => {
    if (!fullDocumentContent || !coverLetterContent) return;
    
    const resumeText = fullDocumentContent.value;
    const coverLetter = coverLetterContent.value;
    
    if (!resumeText && !coverLetter) return;
    
    const { resumeId, lastResults } = await chrome.storage.local.get(['resumeId', 'lastResults']);
    if (!resumeId || !lastResults) return;
    
    // Only save if content has changed
    const hasChanges = resumeText !== (lastResults.fullResume || lastResults.fullDocument || '') ||
                       coverLetter !== (lastResults.coverLetter || '');
    
    if (hasChanges) {
      try {
        // Save to localStorage first (fast)
        await chrome.storage.local.set({
          lastResults: {
            ...lastResults,
            fullResume: resumeText,
            fullDocument: resumeText,
            coverLetter: coverLetter,
          },
        });
        
        // Then save to database (async, don't wait)
        window.apiRequest('/update-tailored-content', {
          method: 'POST',
          body: JSON.stringify({
            resumeId,
            tailoredResumeText: resumeText,
            coverLetter: coverLetter,
          }),
        }).catch(err => {
          console.warn('Auto-save to database failed:', err);
          // Don't show error to user - it's background save
        });
      } catch (error) {
        console.warn('Auto-save failed:', error);
      }
    }
  }, 2000); // Save 2 seconds after user stops typing
}

// Add auto-save listeners
if (fullDocumentContent) {
  fullDocumentContent.addEventListener('input', autoSaveContent);
}
if (coverLetterContent) {
  coverLetterContent.addEventListener('input', autoSaveContent);
}

// Settings button already handled above

// Load saved content when popup opens
async function loadSavedContent() {
  try {
    const { lastResults, resumeId } = await chrome.storage.local.get(['lastResults', 'resumeId']);
    
    if (lastResults && resumeId) {
      // Load saved content into textareas
      if (fullDocumentContent && lastResults.fullResume) {
        fullDocumentContent.value = lastResults.fullResume;
      } else if (fullDocumentContent && lastResults.fullDocument) {
        fullDocumentContent.value = lastResults.fullDocument;
      }
      
      if (coverLetterContent && lastResults.coverLetter) {
        coverLetterContent.value = lastResults.coverLetter;
      }
    }
  } catch (error) {
    console.warn('Failed to load saved content:', error);
  }
}

// Template menu handler
const moreMenuBtn = document.querySelector('.btn-more');
const templateMenu = document.querySelector('.template-menu');
const templateOptions = document.querySelectorAll('.template-option-menu');
let selectedResumeTemplate = 'classic';

// Load current template preference
async function loadTemplatePreference() {
  try {
    const response = await window.apiRequest('/default-template', {
      method: 'GET',
    });
    if (response.success && response.data) {
      selectedResumeTemplate = response.data.template || 'classic';
      // Update visual state of selected template
      updateTemplateSelection(selectedResumeTemplate);
    }
  } catch (error) {
    console.warn('Failed to load template preference:', error);
  }
}

// Update template selection visual state
function updateTemplateSelection(template) {
  templateOptions.forEach(option => {
    const optionTemplate = option.getAttribute('data-template');
    const nameSpan = option.querySelector('span:first-child');
    
    if (optionTemplate === template) {
      option.style.background = '#f3f4f6';
      nameSpan.style.fontWeight = '600';
      nameSpan.style.color = '#111827';
    } else {
      option.style.background = 'none';
      nameSpan.style.fontWeight = '400';
      nameSpan.style.color = '#111827';
    }
  });
}

// Toggle template menu
if (moreMenuBtn && templateMenu) {
  moreMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    templateMenu.classList.toggle('hidden');
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!moreMenuBtn.contains(e.target) && !templateMenu.contains(e.target)) {
      templateMenu.classList.add('hidden');
    }
  });

  // Handle template option clicks
  templateOptions.forEach(option => {
    option.addEventListener('mouseenter', () => {
      if (option.getAttribute('data-template') !== selectedResumeTemplate) {
        option.style.background = '#f9fafb';
      }
    });
    
    option.addEventListener('mouseleave', () => {
      if (option.getAttribute('data-template') !== selectedResumeTemplate) {
        option.style.background = 'none';
      }
    });

    option.addEventListener('click', async (e) => {
      e.stopPropagation();
      const template = option.getAttribute('data-template');
      
      if (template === selectedResumeTemplate) {
        templateMenu.classList.add('hidden');
        return;
      }

      // Add loading state
      option.classList.add('loading');
      option.disabled = true;
      const originalText = option.querySelector('span:first-child').textContent;
      option.querySelector('span:first-child').textContent = 'Updating...';

      try {
        const response = await window.apiRequest('/default-template', {
          method: 'POST',
          body: JSON.stringify({ template }),
        });
        
        if (response.success) {
          selectedResumeTemplate = template;
          updateTemplateSelection(template);
          templateMenu.classList.add('hidden');
          
          // Show brief success feedback
          moreMenuBtn.style.color = '#10b981';
          setTimeout(() => {
            moreMenuBtn.style.color = '';
          }, 1000);
        }
      } catch (error) {
        console.error('Failed to update template:', error);
        // Show error feedback
        moreMenuBtn.style.color = '#ef4444';
        setTimeout(() => {
          moreMenuBtn.style.color = '';
        }, 1000);
      } finally {
        // Remove loading state
        option.classList.remove('loading');
        option.disabled = false;
        option.querySelector('span:first-child').textContent = originalText;
      }
    });
  });
}

// Load template when results section is shown
const originalShowResults = window.showResultsSection;
if (originalShowResults) {
  window.showResultsSection = function() {
    originalShowResults();
    loadTemplatePreference();
  };
} else {
  // Fallback: load on DOM ready
  loadTemplatePreference();
}

// Mode toggles (100% Match vs Custom) - make them behave like radio buttons
const generateFreelyToggle = document.getElementById('generate-freely-toggle');
const customModeToggle = document.getElementById('custom-mode-toggle');
const customInstructionsContainer = document.getElementById('custom-instructions-container');
const customInstructionsInput = document.getElementById('custom-instructions');

if (customModeToggle && customInstructionsContainer) {
  customModeToggle.addEventListener('change', (e) => {
    const checked = e.target.checked;

    if (checked) {
      // Turn off 100% Match when custom is on
      if (generateFreelyToggle) {
        generateFreelyToggle.checked = false;
      }

      customInstructionsContainer.classList.remove('hidden');
      if (customInstructionsInput) {
        customInstructionsInput.focus();
      }
    } else {
      customInstructionsContainer.classList.add('hidden');
      if (customInstructionsInput) {
        customInstructionsInput.value = '';
      }
    }
  });
}

if (generateFreelyToggle && customModeToggle) {
  generateFreelyToggle.addEventListener('change', (e) => {
    const checked = e.target.checked;

    if (checked) {
      // Turn off custom mode when 100% Match is on
      customModeToggle.checked = false;
      if (customInstructionsContainer) {
        customInstructionsContainer.classList.add('hidden');
      }
      if (customInstructionsInput) {
        customInstructionsInput.value = '';
      }
    }
  });
}

// Initialize on load
init();

// Load saved content after init
setTimeout(loadSavedContent, 500);

// Close functionality for iframe mode
// The close button is handled by popup-injector.js outside the iframe
// We just need to send close messages when needed
if (window.self !== window.top) {
  // We're in an iframe - expose close function for internal use if needed
  window.closePopup = () => {
    window.parent.postMessage({ action: 'closePopup' }, '*');
  };
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // ESC to close popup (only if in iframe mode)
  if (e.key === 'Escape' && window.self !== window.top) {
    window.closePopup();
    e.preventDefault();
  }
  
  // Ctrl/Cmd + Enter to submit forms (if focus is on input)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      // Find the nearest form or submit button
      const form = activeElement.closest('form');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
          e.preventDefault();
        }
      }
    }
  }
});

// Listen for storage changes (when context menu is used)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.selectedJobDescription && changes.selectedJobDescription.newValue) {
    jobText.textContent = changes.selectedJobDescription.newValue;
    window.showTailorSection();
    
    // Ensure loading is hidden - never show automatically
    if (loading) {
      loading.classList.add('hidden');
    }
    if (tailorBtn) {
      tailorBtn.disabled = false;
    }
  }
});
