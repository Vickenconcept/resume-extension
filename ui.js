// UI manipulation functions for Resume Tailor extension
(function() {
  'use strict';

  // DOM Elements
  const authSection = document.getElementById('auth-section');
  const uploadSection = document.getElementById('upload-section');
  const readySection = document.getElementById('ready-section');
  const tailorSection = document.getElementById('tailor-section');
  const resultsSection = document.getElementById('results-section');
  const errorSection = document.getElementById('error-section');
  const errorMessage = document.getElementById('error-message');

  // Show sections
  window.showAuthSection = function() {
  authSection.classList.remove('hidden');
  uploadSection.classList.add('hidden');
  readySection.classList.add('hidden');
  tailorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  errorSection.classList.add('hidden');
}

  window.showUploadSection = function() {
    authSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    readySection.classList.add('hidden');
    tailorSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    errorSection.classList.add('hidden');
  };

  window.showReadySection = function() {
    authSection.classList.add('hidden');
    uploadSection.classList.add('hidden');
    readySection.classList.remove('hidden');
    tailorSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    errorSection.classList.add('hidden');
  };

  window.showTailorSection = function() {
    console.log('Showing tailor section...');
    authSection.classList.add('hidden');
    uploadSection.classList.add('hidden');
    readySection.classList.add('hidden');
    tailorSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    
    // Ensure button is enabled and loading is hidden when section is shown
    const tailorBtn = document.getElementById('tailor-btn');
    const loading = document.getElementById('loading');
    if (tailorBtn) {
      tailorBtn.disabled = false;
      console.log('Tailor button enabled, visible:', tailorBtn.offsetParent !== null);
    }
    if (loading) {
      loading.classList.add('hidden'); // Always hide loading when section is shown - only show after button click
    }
  };

  window.showResultsSection = function() {
    authSection.classList.add('hidden');
    uploadSection.classList.add('hidden');
    readySection.classList.add('hidden');
    tailorSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    errorSection.classList.add('hidden');
  };

  window.showError = function(message) {
    if (errorMessage) {
      errorMessage.textContent = message;
    }
    authSection.classList.add('hidden');
    uploadSection.classList.add('hidden');
    readySection.classList.add('hidden');
    tailorSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    errorSection.classList.remove('hidden');
  };

  window.updateUserInfo = function(user) {
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    if (userInfo && userName) {
      userName.textContent = user.name || user.email;
      userInfo.style.display = 'block';
    }
  };
})();
