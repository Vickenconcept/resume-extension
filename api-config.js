// Centralized API Configuration
// All API-related configuration and utilities in one place

const API_CONFIG = {
  // Base URL from config
  getBaseUrl: () => {
    return (typeof EXTENSION_CONFIG !== 'undefined' && EXTENSION_CONFIG.API_BASE_URL) 
      ? EXTENSION_CONFIG.API_BASE_URL 
      : 'http://localhost:3000';
  },

  // Get full API base URL (with /api suffix)
  getApiBaseUrl: () => {
    const base = API_CONFIG.getBaseUrl();
    return base.endsWith('/api') ? base : base + '/api';
  },

  // Check if URL is ngrok
  isNgrokUrl: (url) => {
    return url.includes('ngrok-free.app') || 
           url.includes('ngrok-free.dev') || 
           url.includes('ngrok.io') || 
           url.includes('ngrok');
  },

  // Build full URL with endpoint and ngrok skip parameter if needed
  buildUrl: (endpoint) => {
    let url = API_CONFIG.getApiBaseUrl() + endpoint;
    
    // Add ngrok skip parameter if using ngrok
    if (API_CONFIG.isNgrokUrl(url) && !url.includes('ngrok-skip-browser-warning')) {
      url += (url.includes('?') ? '&' : '?') + 'ngrok-skip-browser-warning=true';
    }
    
    return url;
  },

  // Build headers with auth token and ngrok skip header
  buildHeaders: (options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    // Add Authorization header if token exists
    if (options.authToken) {
      headers['Authorization'] = `Bearer ${options.authToken}`;
    }

    // Add ngrok skip header if using ngrok
    const url = options.url || API_CONFIG.getApiBaseUrl();
    if (API_CONFIG.isNgrokUrl(url)) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }

    return headers;
  },

  // Get auth token from storage
  getAuthToken: async () => {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    return authToken;
  },

  // Check if response is JSON or HTML (error)
  isJsonResponse: (response) => {
    const contentType = response.headers.get('content-type');
    return contentType && contentType.includes('application/json');
  },

  // Parse response (handles JSON/HTML detection)
  parseResponse: async (response) => {
    const isJson = API_CONFIG.isJsonResponse(response);
    
    if (isJson) {
      return await response.json();
    } else {
      const text = await response.text();
      // Check if it's ngrok warning page
      if (text.includes('ngrok') || text.includes('Visit Site') || text.includes('You are about to visit') || text.includes('You have been denied access')) {
        throw new Error('ngrok warning page detected. The ngrok-skip-browser-warning header may not be working.\n\nTry:\n1. Make sure backend is running: npm run dev (in backend2)\n2. Verify ngrok is pointing to port 3000: ngrok http 3000\n3. Check browser console (F12) for CORS errors');
      }
      throw new Error(`API returned HTML instead of JSON. Status: ${response.status}.\n\nCheck:\n1. Backend server is running: npm run dev (in backend2 folder)\n2. ngrok is pointing to port 3000 (not 8000)\n3. API URL is correct in config.js`);
    }
  }
};

// Make it available globally
if (typeof window !== 'undefined') {
  window.API_CONFIG = API_CONFIG;
}
