// Payment handler for Paystack integration

let paymentPlans = [];
let currentPaymentReference = null;

// Load payment plans
async function loadPaymentPlans() {
  try {
    const response = await window.apiRequest('/payment/plans', {
      method: 'GET',
    });

    if (response.success && response.data && response.data.plans) {
      paymentPlans = response.data.plans;
      displayPaymentPlans();
    } else {

    }
  } catch (error) {

  }
}

// Display payment plans
function displayPaymentPlans() {
  const plansContainer = document.getElementById('payment-plans');
  if (!plansContainer) return;

  plansContainer.innerHTML = '';

  paymentPlans.forEach((plan, index) => {
    const isPopular = index === 1; // Second card: $10 / 13 Credits
    const planCard = document.createElement('div');
    planCard.className = 'payment-plan-card' + (isPopular ? ' payment-plan-card-popular' : '');
    planCard.style.cssText = isPopular
      ? 'padding: 16px; border: 2px solid #3b82f6; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: #eff6ff; position: relative;'
      : 'padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: #ffffff; position: relative;';
    
    planCard.innerHTML = `
      ${isPopular ? '<span class="payment-plan-popular-tag">Popular</span>' : ''}
      <div style="font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 4px;">$${plan.amount}</div>
      <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">${plan.credits} Credits</div>
      <div style="font-size: 12px; color: #10b981;">$${(plan.amount / plan.credits).toFixed(2)} per credit</div>
    `;

    planCard.addEventListener('mouseenter', () => {
      planCard.style.borderColor = '#3b82f6';
      planCard.style.background = '#eff6ff';
    });

    planCard.addEventListener('mouseleave', () => {
      if (isPopular) {
        planCard.style.borderColor = '#3b82f6';
        planCard.style.background = '#eff6ff';
      } else {
        planCard.style.borderColor = '#e5e7eb';
        planCard.style.background = '#ffffff';
      }
    });

    planCard.addEventListener('click', () => {
      initializePayment(plan.id);
    });

    plansContainer.appendChild(planCard);
  });
}

// Initialize payment
async function initializePayment(planId) {
  const paymentLoading = document.getElementById('payment-loading');
  const paymentError = document.getElementById('payment-error');
  const paymentPlans = document.getElementById('payment-plans');

  if (paymentLoading) paymentLoading.classList.remove('hidden');
  if (paymentError) {
    paymentError.classList.add('hidden');
    paymentError.textContent = '';
  }
  if (paymentPlans) paymentPlans.style.display = 'none';

  try {
    const response = await window.apiRequest('/payment/initialize', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });

    if (response.success && response.data) {
      currentPaymentReference = response.data.reference;
      
      // Open Paystack payment page
      window.open(response.data.authorizationUrl, '_blank');
      
      // Start polling for payment verification
      pollPaymentVerification(response.data.reference);
    } else {
      throw new Error(response.error || 'Failed to initialize payment');
    }
  } catch (error) {

    if (paymentError) {
      paymentError.textContent = error.message || 'Failed to initialize payment';
      paymentError.classList.remove('hidden');
    }
    if (paymentLoading) paymentLoading.classList.add('hidden');
    if (paymentPlans) paymentPlans.style.display = 'grid';
  }
}

// Poll for payment verification
let verificationPollInterval = null;
let verificationPollCount = 0;
const maxPollAttempts = 60; // 5 minutes (5 second intervals)

function pollPaymentVerification(reference) {
  if (verificationPollInterval) {
    clearInterval(verificationPollInterval);
  }

  verificationPollCount = 0;

  verificationPollInterval = setInterval(async () => {
    verificationPollCount++;

    if (verificationPollCount > maxPollAttempts) {
      clearInterval(verificationPollInterval);
      const paymentError = document.getElementById('payment-error');
      if (paymentError) {
        paymentError.textContent = 'Payment verification timeout. Please check your payment status.';
        paymentError.classList.remove('hidden');
      }
      const paymentLoading = document.getElementById('payment-loading');
      if (paymentLoading) paymentLoading.classList.add('hidden');
      return;
    }

    try {
      const response = await window.apiRequest('/payment/verify', {
        method: 'POST',
        body: JSON.stringify({ reference }),
      });

      if (response.success && response.data) {
        // Check if payment is completed or verified
        if (response.data.status === 'completed' || response.data.verified === true) {
          clearInterval(verificationPollInterval);
          
          // Close modal first
          closePaymentModal();
          
          // Reload credits to update display
          try {
            await loadCredits();

          } catch (error) {

          }
          
          // Redirect to success page if URL is provided
          if (response.data.successPageUrl) {
            window.open(response.data.successPageUrl, '_blank');
          } else {
            // Show success message as fallback
            if (window.showToast) {
              window.showToast(`Payment successful! ${response.data.credits || 0} credits added.`, 'success');
            }
          }
        } else if (response.data.status === 'failed') {
          // Only show failed if status is explicitly 'failed' (not pending)
          clearInterval(verificationPollInterval);
          const paymentError = document.getElementById('payment-error');
          if (paymentError) {
            paymentError.textContent = 'Payment failed. Please try again.';
            paymentError.classList.remove('hidden');
          }
          const paymentLoading = document.getElementById('payment-loading');
          if (paymentLoading) paymentLoading.classList.add('hidden');
        } else if (response.data.status === 'pending') {
          // Payment is still pending - this is normal, continue polling
          // Don't show any error, just keep polling silently

          // Hide any error messages that might have been shown
          const paymentError = document.getElementById('payment-error');
          if (paymentError) {
            paymentError.classList.add('hidden');
          }
        } else {
          // Status is undefined or other - continue polling (might be processing)

          // Hide any error messages
          const paymentError = document.getElementById('payment-error');
          if (paymentError) {
            paymentError.classList.add('hidden');
          }
        }
      } else if (response && !response.success) {
        // API returned an error response
        // Don't show error for "not found" or "pending" - these are normal during processing
        if (response.error) {
          if (response.error.includes('not found') || response.error.includes('pending')) {
            // Payment might not be in database yet or still processing - continue polling

          } else {
            // Other errors - log but don't stop polling (might be temporary)

          }
        }
        // Continue polling - don't show error yet
      }
    } catch (error) {

      // Continue polling on error (might be temporary network issue)
      // Don't show error immediately - callback might process payment
      // Only log after many attempts
      if (verificationPollCount > 12) { // After 1 minute
        
      }
    }
  }, 5000); // Poll every 5 seconds
}

// Load user credits
async function loadCredits() {
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    if (!authToken) {
      hideCreditsInfo();
      return null;
    }

    const response = await window.apiRequest('/payment/credits', {
      method: 'GET',
    });

    if (response.success && response.data) {

      updateCreditsDisplay(response.data);
      return response.data;
    } else {

    }
  } catch (error) {

    // Don't hide credits display on error - keep showing last known value
  }
  return null;
}

// Update credits display
function updateCreditsDisplay(creditsData) {
  const creditsBalance = document.getElementById('credits-balance');
  const freeTrialInfo = document.getElementById('free-trial-info');
  const creditsInfo = document.getElementById('credits-info');

  if (!creditsInfo) {

    return;
  }

  creditsInfo.style.display = 'flex';

  // Ensure credits is a number (handle undefined/null)
  const credits = typeof creditsData.credits === 'number' ? creditsData.credits : (creditsData.credits || 0);
  const freeTrialRemaining = typeof creditsData.freeTrialRemaining === 'number' 
    ? creditsData.freeTrialRemaining 
    : (creditsData.freeTrialRemaining || 0);

  if (creditsBalance) {
    creditsBalance.textContent = `${credits} Credits`;
    
    // Change color based on balance
    if (credits === 0 && freeTrialRemaining === 0) {
      creditsBalance.style.color = '#ef4444'; // Red if no credits and no free trial
    } else if (credits === 0 && freeTrialRemaining > 0) {
      creditsBalance.style.color = '#10b981'; // Green if using free trial
    } else if (credits < 5) {
      creditsBalance.style.color = '#f59e0b'; // Yellow for low credits
    } else {
      creditsBalance.style.color = '#3b82f6'; // Blue for sufficient credits
    }
  }

  if (freeTrialInfo) {
    if (freeTrialRemaining > 0) {
      freeTrialInfo.textContent = `(${freeTrialRemaining} free trial remaining)`;
      freeTrialInfo.style.display = 'inline';
      freeTrialInfo.style.color = '#10b981';
    } else {
      freeTrialInfo.style.display = 'none';
    }
  }
}

function hideCreditsInfo() {
  const creditsInfo = document.getElementById('credits-info');
  if (creditsInfo) {
    creditsInfo.style.display = 'none';
  }
}

// Open payment modal
function openPaymentModal() {
  const paymentModal = document.getElementById('payment-modal');
  if (paymentModal) {
    paymentModal.classList.remove('hidden');
    loadPaymentPlans();
  }
}

// Close payment modal
function closePaymentModal() {
  const paymentModal = document.getElementById('payment-modal');
  if (paymentModal) {
    paymentModal.classList.add('hidden');
  }
  
  // Reset state
  const paymentLoading = document.getElementById('payment-loading');
  const paymentError = document.getElementById('payment-error');
  const paymentPlans = document.getElementById('payment-plans');
  
  if (paymentLoading) paymentLoading.classList.add('hidden');
  if (paymentError) {
    paymentError.classList.add('hidden');
    paymentError.textContent = '';
  }
  if (paymentPlans) paymentPlans.style.display = 'grid';
  
  if (verificationPollInterval) {
    clearInterval(verificationPollInterval);
    verificationPollInterval = null;
  }
  
  currentPaymentReference = null;
  verificationPollCount = 0;
}

// Initialize payment modal
document.addEventListener('DOMContentLoaded', () => {
  const buyCreditsLink = document.getElementById('buy-credits-link');
  const paymentModalClose = document.getElementById('payment-modal-close');
  const paymentModal = document.getElementById('payment-modal');

  if (buyCreditsLink) {
    buyCreditsLink.addEventListener('click', (e) => {
      e.preventDefault();
      openPaymentModal();
    });
  }

  if (paymentModalClose) {
    paymentModalClose.addEventListener('click', () => {
      closePaymentModal();
    });
  }

  if (paymentModal) {
    paymentModal.addEventListener('click', (e) => {
      if (e.target === paymentModal) {
        closePaymentModal();
      }
    });
  }
});

// Export functions
window.loadCredits = loadCredits;
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
