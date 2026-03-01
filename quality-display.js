// Quality and Similarity Score Display Handler

(function() {
  'use strict';

  let currentQualityScore = null;
  let currentSimilarityMetrics = null;
  let atsHighlightEnabled = false;

  // Display quality and similarity scores
  window.displayQualityScores = function(qualityScore, similarityMetrics) {
    currentQualityScore = qualityScore;
    currentSimilarityMetrics = similarityMetrics;

    const qualityScoresContainer = document.getElementById('quality-scores');
    const similarityScoreValue = document.getElementById('similarity-score-value');
    const similarityDescription = document.getElementById('similarity-description');
    const qualityScoreValue = document.getElementById('quality-score-value');
    const qualityDescription = document.getElementById('quality-description');
    const qualityWarnings = document.getElementById('quality-warnings');
    const regenerateSection = document.getElementById('regenerate-section');

    if (!qualityScoresContainer) return;

    // Show container
    qualityScoresContainer.classList.remove('hidden');

    // Show regenerate button if match score is below 98%
    if (regenerateSection && similarityMetrics) {
      const matchScore = similarityMetrics.similarityScore || 0;
      if (matchScore < 98) {
        regenerateSection.classList.remove('hidden');
      } else {
        regenerateSection.classList.add('hidden');
      }
    }

    // Display similarity score
    if (similarityMetrics && similarityScoreValue) {
      const score = similarityMetrics.similarityScore || 0;
      similarityScoreValue.textContent = `${score}%`;
      similarityScoreValue.className = `score-value ${getScoreColorClass(score)}`;

      // Description
      if (similarityDescription) {
        const matched = similarityMetrics.matchedKeywords?.length || 0;
        const missing = similarityMetrics.missingKeywords?.length || 0;
        similarityDescription.textContent = `${matched} keywords matched, ${missing} additional available`;
      }
    }

    // Display quality score
    if (qualityScore && qualityScoreValue) {
      const score = qualityScore.overall || 0;
      qualityScoreValue.textContent = `${score}%`;
      qualityScoreValue.className = `score-value ${getScoreColorClass(score)}`;

      // Description
      if (qualityDescription) {
        const parts = [];
        if (qualityScore.truthfulness) parts.push(`Truthfulness: ${qualityScore.truthfulness}%`);
        if (qualityScore.completeness) parts.push(`Completeness: ${qualityScore.completeness}%`);
        if (qualityScore.keywordMatch) parts.push(`Keywords: ${qualityScore.keywordMatch}%`);
        qualityDescription.textContent = parts.join(' • ') || 'Quality assessment complete';
      }
    }

    // Quality warnings feature removed - no longer displaying warnings
    if (qualityWarnings) {
      qualityWarnings.classList.add('hidden');
    }

    // Display ATS keywords
    displayATSKeywords(similarityMetrics);
  };

  // Display ATS keywords
  function displayATSKeywords(similarityMetrics) {
    const atsContainer = document.getElementById('ats-keywords');
    const matchedKeywordsDiv = document.getElementById('matched-keywords');
    const missingKeywordsDiv = document.getElementById('missing-keywords');
    const missingKeywordsContainer = missingKeywordsDiv ? missingKeywordsDiv.parentElement : null;

    if (!atsContainer || !similarityMetrics) return;

    atsContainer.classList.remove('hidden');

    // Display matched keywords
    if (matchedKeywordsDiv && similarityMetrics.matchedKeywords) {
      matchedKeywordsDiv.innerHTML = similarityMetrics.matchedKeywords
        .slice(0, 20) // Limit to 20 for display
        .map(keyword => `<span class="keyword-tag matched">${escapeHtml(keyword)}</span>`)
        .join('');
    }

    // Display missing keywords
    if (missingKeywordsDiv) {
      const missing = similarityMetrics.missingKeywords || [];

      if (missing.length === 0) {
        // No missing keywords: clear tags and hide the entire "Missing" row
        missingKeywordsDiv.innerHTML = '';
        if (missingKeywordsContainer) {
          missingKeywordsContainer.classList.add('hidden');
        }
      } else {
        // There are missing keywords: show row and tags
        if (missingKeywordsContainer) {
          missingKeywordsContainer.classList.remove('hidden');
        }
        missingKeywordsDiv.innerHTML = missing
          .slice(0, 20) // Limit to 20 for display
          .map(keyword => `<span class="keyword-tag missing">${escapeHtml(keyword)}</span>`)
          .join('');
      }
    }
  }

  // Toggle ATS highlighting in resume textarea
  const toggleATSHighlight = document.getElementById('toggle-ats-highlight');
  if (toggleATSHighlight) {
    toggleATSHighlight.addEventListener('click', () => {
      atsHighlightEnabled = !atsHighlightEnabled;
      toggleATSHighlight.textContent = atsHighlightEnabled ? 'Remove Highlights' : 'Highlight in Resume';
      toggleATSHighlight.classList.toggle('active', atsHighlightEnabled);
      
      if (atsHighlightEnabled) {
        highlightKeywordsInResume();
      } else {
        removeHighlights();
      }
    });
  }

  // Highlight keywords in resume textarea
  function highlightKeywordsInResume() {
    const textarea = document.getElementById('full-document-content');
    if (!textarea || !currentSimilarityMetrics) return;

    const text = textarea.value;
    const matchedKeywords = currentSimilarityMetrics.matchedKeywords || [];

    // Create a wrapper div to show highlighted text
    // Since we can't style textarea content directly, we'll create a preview overlay
    const container = textarea.parentElement;
    if (!container) return;

    // Remove existing highlight overlay
    const existingOverlay = container.querySelector('.highlight-overlay');
    if (existingOverlay) existingOverlay.remove();

    // Make container position relative if not already
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    // Make textarea have transparent text when highlighting
    textarea.style.color = 'transparent';
    textarea.style.caretColor = '#111827'; // Keep caret visible

    // Create overlay div positioned exactly over textarea
    const overlay = document.createElement('div');
    overlay.className = 'highlight-overlay';
    
    // Get textarea position and dimensions
    const textareaRect = textarea.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    overlay.style.cssText = `
      position: absolute;
      top: ${textarea.offsetTop}px;
      left: ${textarea.offsetLeft}px;
      width: ${textarea.offsetWidth}px;
      height: ${textarea.offsetHeight}px;
      pointer-events: none;
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 11px;
      line-height: 1.5;
      padding: 10px;
      color: #111827;
      z-index: 1;
      overflow: hidden;
      background: transparent;
    `;

    // Highlight matched keywords in green
    let highlightedText = escapeHtml(text);
    
    // Highlight matched keywords (green background)
    matchedKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, (match) => {
        return `<mark class="keyword-matched">${match}</mark>`;
      });
    });

    overlay.innerHTML = highlightedText;
    container.appendChild(overlay);
  }

  // Remove highlights
  function removeHighlights() {
    const textarea = document.getElementById('full-document-content');
    const container = textarea?.parentElement;
    if (container) {
      const overlay = container.querySelector('.highlight-overlay');
      if (overlay) overlay.remove();
    }
    if (textarea) {
      textarea.style.color = '';
      textarea.style.caretColor = '';
    }
  }

  // Get color class based on score
  function getScoreColorClass(score) {
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-fair';
    return 'score-poor';
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Escape regex special characters
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Handle feedback buttons
  const thumbsUpBtn = document.getElementById('feedback-thumbs-up');
  const thumbsDownBtn = document.getElementById('feedback-thumbs-down');

  if (thumbsUpBtn) {
    thumbsUpBtn.addEventListener('click', async () => {
      await submitFeedback('positive');
      thumbsUpBtn.classList.add('active');
      if (thumbsDownBtn) thumbsDownBtn.classList.remove('active');
    });
  }

  if (thumbsDownBtn) {
    thumbsDownBtn.addEventListener('click', async () => {
      await submitFeedback('negative');
      thumbsDownBtn.classList.add('active');
      if (thumbsUpBtn) thumbsUpBtn.classList.remove('active');
    });
  }

  // Submit feedback
  async function submitFeedback(feedback) {
    try {
      // Get current resume ID
      const { resumeId } = await chrome.storage.local.get(['resumeId']);
      if (!resumeId) return;

      // Send feedback to backend (you'll need to create this endpoint)
      const response = await window.apiRequest('/submit-feedback', {
        method: 'POST',
        body: JSON.stringify({
          resumeId,
          feedback,
          qualityScore: currentQualityScore,
          similarityMetrics: currentSimilarityMetrics,
        }),
      });

      if (response.success) {
        console.log('Feedback submitted successfully');
        // Show toast notification
        if (typeof showToast === 'function') {
          showToast('Thank you for your feedback!', 'success');
        }
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  }

  // Re-highlight when textarea content changes (if highlighting is enabled)
  const textarea = document.getElementById('full-document-content');
  if (textarea) {
    textarea.addEventListener('input', () => {
      if (atsHighlightEnabled) {
        // Debounce highlighting
        clearTimeout(window.atsHighlightTimeout);
        window.atsHighlightTimeout = setTimeout(() => {
          highlightKeywordsInResume();
        }, 300);
      }
    });
  }
})();
