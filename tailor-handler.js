// Resume tailoring handler

window.TailorHandler = {
  async startTailoring(resumeId, jobDescription, generateFreely) {
    // Save state
    await window.StateManager.saveGenerationState(resumeId, jobDescription, generateFreely);

    // Show loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    if (loadingMessage) {
      window.startLoadingMessages();
    }

    const tailorBtn = document.getElementById('tailor-btn');
    if (tailorBtn) tailorBtn.disabled = true;

    try {
      const response = await window.apiRequest('/tailor-resume', {
        method: 'POST',
        body: JSON.stringify({
          resumeId,
          jobDescription,
          generateFreely,
        }),
      });

      // Clear state on success
      await window.StateManager.clearGenerationState();

      if (response.success && response.data) {
        await window.displayResults(response.data);
        window.showResultsSection();
      } else {
        throw new Error(response.error || 'Failed to generate tailored content');
      }
    } catch (error) {
      // Clear state on error
      await window.StateManager.clearGenerationState();
      throw error;
    } finally {
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
      if (loadingMessage) {
        window.stopLoadingMessages();
      }
      if (tailorBtn) tailorBtn.disabled = false;
    }
  },
};
