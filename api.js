// API request handler for Resume Tailor extension
(function() {
  'use strict';

  // Get API URL from config, storage, or use default
  window.API_BASE_URL = (typeof EXTENSION_CONFIG !== 'undefined' && EXTENSION_CONFIG.API_BASE_URL) 
    ? EXTENSION_CONFIG.API_BASE_URL 
    : 'http://localhost:8000';

  // Helper to get API base URL (always adds /api if not present)
  window.getApiBaseUrl = function() {
    const base = window.API_BASE_URL.endsWith('/api') ? window.API_BASE_URL : window.API_BASE_URL + '/api';
    return base;
  };

  // Standard API response handler
  window.apiRequest = async function(endpoint, options = {}) {
    const requestStartTime = Date.now();
    const url = window.getApiBaseUrl() + endpoint;
    
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
  };
})();
