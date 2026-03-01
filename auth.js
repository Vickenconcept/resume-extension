// Authentication handlers for Resume Tailor extension
(function() {
  'use strict';

  // Setup authentication handlers
  window.setupAuthHandlers = function() {
  const loginBtn = document.getElementById('login-btn');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const authError = document.getElementById('auth-error');
  const forgotPasswordLink = document.getElementById('forgot-password-link');
  const resetPasswordSection = document.getElementById('reset-password-section');
  const resetEmailInput = document.getElementById('reset-email');
  const resetSubmitBtn = document.getElementById('reset-submit-btn');
  const resetBackBtn = document.getElementById('reset-back-btn');
  const resetStatus = document.getElementById('reset-status');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const authHeading = document.getElementById('auth-heading');
  const authSubheading = document.getElementById('auth-subheading');

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email = loginEmail.value.trim();
      const password = loginPassword.value;
      authError.style.display = 'none';
      
      if (!email || !password) {
        authError.textContent = 'Please enter email and password';
        authError.style.display = 'block';
        return;
      }
      
      loginBtn.disabled = true;
      loginBtn.textContent = 'Signing in...';
      
      try {
        const response = await window.apiRequest('/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        
        if (response.success && response.data.token) {
          await chrome.storage.local.set({
            authToken: response.data.token,
            user: response.data.user,
          });
          window.updateUserInfo(response.data.user);
          // Clear ALL old state including resume data - init() will determine if we show home or upload
          await chrome.storage.local.remove([
            'currentSection', 
            'operationState', 
            'pendingJobDescription',
            'lastResults',           // Clear old tailored results
            'resumeId',              // Clear old resume ID (will be fetched fresh)
            'resumeFilename',         // Clear old resume filename
            'resumeCloudinaryUrl',   // Clear old resume URL
            'resumeUploadedAt',      // Clear old upload date
            'savedJobDescription',   // Clear old job description
            'lastViewedAt',          // Clear last viewed timestamp
            'generationStartTime'    // Clear generation start time
          ]);
          // Reload - init() will show home page if resume exists, upload if new account
          location.reload();
        }
      } catch (error) {
        authError.textContent = error.message || 'Login failed';
        authError.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
      }
    });
  }

  if (forgotPasswordLink && resetPasswordSection && loginForm && authHeading && authSubheading) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'none';
      registerForm.style.display = 'none';
      resetPasswordSection.style.display = 'block';
      authError.style.display = 'none';
      resetStatus.textContent = '';
      resetStatus.style.display = 'none';
      if (authHeading) authHeading.textContent = 'Forgot password';
      if (authSubheading) authSubheading.textContent = 'We will email you a reset link';
    });
  }

  if (resetBackBtn && resetPasswordSection && loginForm && authHeading && authSubheading) {
    resetBackBtn.addEventListener('click', (e) => {
      e.preventDefault();
      resetPasswordSection.style.display = 'none';
      loginForm.style.display = 'block';
      authError.style.display = 'none';
      resetStatus.textContent = '';
      resetStatus.style.display = 'none';
      if (authHeading) authHeading.textContent = 'Sign in';
      if (authSubheading) authSubheading.textContent = 'Continue to your account';
    });
  }

  if (resetSubmitBtn && resetPasswordSection && resetEmailInput) {
    resetSubmitBtn.addEventListener('click', async () => {
      const email = resetEmailInput.value.trim();
      authError.style.display = 'none';
      resetStatus.style.display = 'none';

      if (!email) {
        authError.textContent = 'Please enter your email';
        authError.style.display = 'block';
        return;
      }

      resetSubmitBtn.disabled = true;
      resetSubmitBtn.textContent = 'Sending...';

      try {
        const response = await window.apiRequest('/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });

        if (response.success) {
          resetStatus.textContent = 'If that email is registered, a reset link has been sent.';
          resetStatus.style.display = 'block';
          resetStatus.style.color = '#10b981';
        } else {
          authError.textContent = response.error || 'Unable to process request';
          authError.style.display = 'block';
        }
      } catch (error) {
        authError.textContent = error.message || 'Unable to process request';
        authError.style.display = 'block';
      } finally {
        resetSubmitBtn.disabled = false;
        resetSubmitBtn.textContent = 'Send reset link';
      }
    });
  }

  // Register handler
  const registerBtn = document.getElementById('register-btn');
  const registerName = document.getElementById('register-name');
  const registerEmail = document.getElementById('register-email');
  const registerPassword = document.getElementById('register-password');
  const registerPasswordConfirm = document.getElementById('register-password-confirm');

  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const name = registerName.value.trim();
      const email = registerEmail.value.trim();
      const password = registerPassword.value;
      const passwordConfirm = registerPasswordConfirm.value;
      authError.style.display = 'none';
      
      if (!name || !email || !password || !passwordConfirm) {
        authError.textContent = 'Please fill in all fields';
        authError.style.display = 'block';
        return;
      }
      
      if (password !== passwordConfirm) {
        authError.textContent = 'Passwords do not match';
        authError.style.display = 'block';
        return;
      }
      
      if (password.length < 8) {
        authError.textContent = 'Password must be at least 8 characters';
        authError.style.display = 'block';
        return;
      }
      
      registerBtn.disabled = true;
      registerBtn.textContent = 'Creating account...';
      
      try {
        const response = await window.apiRequest('/register', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            password,
            password_confirmation: passwordConfirm,
          }),
        });
        
        if (response.success && response.data.token) {
          await chrome.storage.local.set({
            authToken: response.data.token,
            user: response.data.user,
          });
          window.updateUserInfo(response.data.user);
          // Clear ALL old state including resume data - init() will determine if we show home or upload
          await chrome.storage.local.remove([
            'currentSection', 
            'operationState', 
            'pendingJobDescription',
            'lastResults',           // Clear old tailored results
            'resumeId',              // Clear old resume ID (will be fetched fresh)
            'resumeFilename',         // Clear old resume filename
            'resumeCloudinaryUrl',   // Clear old resume URL
            'resumeUploadedAt',      // Clear old upload date
            'savedJobDescription',   // Clear old job description
            'lastViewedAt',          // Clear last viewed timestamp
            'generationStartTime'    // Clear generation start time
          ]);
          // Reload - init() will show home page if resume exists, upload if new account
          location.reload();
        }
      } catch (error) {
        authError.textContent = error.message || 'Registration failed';
        authError.style.display = 'block';
        registerBtn.disabled = false;
        registerBtn.textContent = 'Create Account';
      }
    });
  }

  // Toggle between login and register forms
  const showRegister = document.getElementById('show-register');
  const showLogin = document.getElementById('show-login');

  if (showRegister) {
    showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      authError.style.display = 'none';
      if (authHeading) authHeading.textContent = 'Create account';
      if (authSubheading) authSubheading.textContent = 'Start tailoring resumes in minutes';
    });
  }

  if (showLogin) {
    showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.style.display = 'none';
      loginForm.style.display = 'block';
      authError.style.display = 'none';
      if (authHeading) authHeading.textContent = 'Sign in';
      if (authSubheading) authSubheading.textContent = 'Continue to your account';
    });
  }

  // Logout handler
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await window.apiRequest('/logout', { method: 'POST' });
      } catch (error) {
        // Silently handle logout error
      }
      await chrome.storage.local.remove(['authToken', 'user', 'resumeId']);
      const userInfo = document.getElementById('user-info');
      const headerMenu = document.getElementById('header-menu');
      if (userInfo) {
        userInfo.style.display = 'none';
      }
      if (headerMenu) {
        headerMenu.style.display = 'none';
      }
      window.showAuthSection();
    });
  }

  // Password visibility toggle
  const passwordToggles = document.querySelectorAll('.password-toggle');
  passwordToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = toggle.getAttribute('data-target');
      const passwordInput = document.getElementById(targetId);
      const eyeOpen = toggle.querySelector('.eye-open');
      const eyeClosed = toggle.querySelector('.eye-closed');
      
      if (passwordInput) {
        if (passwordInput.type === 'password') {
          passwordInput.type = 'text';
          if (eyeOpen) eyeOpen.style.display = 'none';
          if (eyeClosed) eyeClosed.style.display = 'block';
        } else {
          passwordInput.type = 'password';
          if (eyeOpen) eyeOpen.style.display = 'block';
          if (eyeClosed) eyeClosed.style.display = 'none';
        }
      }
    });
  });

  const authInputs = document.querySelectorAll(
    '#login-form input, #register-form input'
  );
  authInputs.forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const loginFormVisible = loginForm && loginForm.style.display !== 'none';
      const registerFormVisible = registerForm && registerForm.style.display !== 'none';
      if (loginFormVisible && loginBtn) {
        loginBtn.click();
      } else if (registerFormVisible && registerBtn) {
        registerBtn.click();
      }
    });
  });
  };
})();
