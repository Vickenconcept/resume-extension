// Feedback handler for thumbs up/down functionality

let currentFeedbackType = null;
let currentFeedbackRating = null;
let currentResumeId = null;
let currentVersionId = null;

// Initialize feedback buttons
function initFeedbackButtons() {
  const feedbackButtons = document.querySelectorAll('.feedback-btn');
  
  feedbackButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      const type = button.getAttribute('data-type');
      const rating = button.getAttribute('data-rating');
      
      // Get current resume/version info from storage
      const { resumeId, currentVersionId: versionId } = await chrome.storage.local.get(['resumeId', 'currentVersionId']);
      currentResumeId = resumeId;
      currentVersionId = versionId;
      
      if (rating === 'positive') {
        // Submit positive feedback immediately
        await submitFeedback(type, rating, null, resumeId, versionId);
      } else {
        // Show modal for negative feedback
        currentFeedbackType = type;
        currentFeedbackRating = rating;
        openFeedbackModal();
      }
    });
  });
}

// Open feedback modal
function openFeedbackModal() {
  const modal = document.getElementById('feedback-modal');
  if (modal) {
    document.getElementById('feedback-type').value = currentFeedbackType;
    document.getElementById('feedback-rating').value = currentFeedbackRating;
    document.getElementById('feedback-message').value = '';
    modal.classList.remove('hidden');
  }
}

// Close feedback modal
function closeFeedbackModal() {
  const modal = document.getElementById('feedback-modal');
  if (modal) {
    modal.classList.add('hidden');
    currentFeedbackType = null;
    currentFeedbackRating = null;
  }
}

// Submit feedback
async function submitFeedback(type, rating, message, resumeId, versionId) {
  try {
    const response = await window.apiRequest('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        type,
        rating,
        message: message || null,
        resumeId: resumeId || null,
        versionId: versionId || null,
      }),
    });

    if (response.success) {
      if (window.showToast) {
        window.showToast(
          rating === 'positive' 
            ? 'Thank you for your positive feedback!' 
            : 'Thank you for your feedback! We appreciate your input.',
          'success'
        );
      }
      
      // Disable the clicked button to prevent duplicate submissions
      const buttons = document.querySelectorAll(`.feedback-btn[data-type="${type}"]`);
      buttons.forEach(btn => {
        if (btn.getAttribute('data-rating') === rating) {
          btn.disabled = true;
          btn.style.opacity = '0.6';
          btn.style.cursor = 'not-allowed';
        }
      });
      
      return true;
    } else {
      throw new Error(response.error || 'Failed to submit feedback');
    }
  } catch (error) {
    console.error('Submit feedback error:', error);
    if (window.showToast) {
      window.showToast('Failed to submit feedback. Please try again.', 'error');
    }
    return false;
  }
}

// Handle feedback form submission
function initFeedbackForm() {
  const form = document.getElementById('feedback-form');
  const cancelBtn = document.getElementById('feedback-cancel-btn');
  const closeBtn = document.getElementById('feedback-modal-close');
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const message = document.getElementById('feedback-message').value.trim();
      
      if (!message) {
        if (window.showToast) {
          window.showToast('Please provide feedback message', 'error');
        }
        return;
      }
      
      const success = await submitFeedback(
        currentFeedbackType,
        currentFeedbackRating,
        message,
        currentResumeId,
        currentVersionId
      );
      
      if (success) {
        closeFeedbackModal();
      }
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      closeFeedbackModal();
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeFeedbackModal();
    });
  }
  
  // Close modal on background click
  const modal = document.getElementById('feedback-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeFeedbackModal();
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initFeedbackButtons();
    initFeedbackForm();
  });
} else {
  initFeedbackButtons();
  initFeedbackForm();
}

// Re-initialize when results are displayed (in case buttons are dynamically added)
window.initFeedbackButtons = initFeedbackButtons;
