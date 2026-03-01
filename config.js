// Extension Configuration
// Edit this file to set your API base URL
// Don't include /api - it's added automatically

const EXTENSION_CONFIG = {
  // API Base URL (without /api suffix)
  // Examples:
  // - Local: 'http://localhost:3000'
  // - Production: 'https://onpagecv.on-forge.com'
  // - ngrok: 'https://your-id.ngrok.io' or 'https://your-id.ngrok-free.app'
  API_BASE_URL: 'https://onpagecv.on-forge.com',
  
  // Default timeout for API requests (milliseconds)
  API_TIMEOUT: 30000,
};

// Note: For ngrok free tier, you may need to add the ngrok-skip-browser-warning header
// to bypass the interstitial page. This is handled automatically in the extension.