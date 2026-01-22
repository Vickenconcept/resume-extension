// State management for popup - handles persistence and restoration

window.StateManager = {
  // Save generation state
  async saveGenerationState(resumeId, jobDescription, generateFreely) {
    await chrome.storage.local.set({
      operationState: 'tailoring',
      pendingJobDescription: jobDescription,
      pendingResumeId: resumeId,
      pendingGenerateFreely: generateFreely,
      generationStartTime: Date.now(),
    });
  },

  // Clear generation state
  async clearGenerationState() {
    await chrome.storage.local.set({
      operationState: null,
      pendingJobDescription: null,
      pendingResumeId: null,
      pendingGenerateFreely: null,
      generationStartTime: null,
    });
  },

  // Check if generation is in progress
  async isGenerationInProgress() {
    const { operationState, generationStartTime } = await chrome.storage.local.get([
      'operationState',
      'generationStartTime',
    ]);

    if (operationState === 'tailoring' && generationStartTime) {
      // Check if it's been more than 5 minutes (likely failed or user closed)
      const elapsed = Date.now() - generationStartTime;
      if (elapsed > 5 * 60 * 1000) {
        // Clear stale state
        await this.clearGenerationState();
        return false;
      }
      return true;
    }
    return false;
  },

  // Restore generation state
  async restoreGenerationState() {
    const {
      operationState,
      pendingJobDescription,
      pendingResumeId,
      generationStartTime,
    } = await chrome.storage.local.get([
      'operationState',
      'pendingJobDescription',
      'pendingResumeId',
      'generationStartTime',
    ]);

    if (operationState === 'tailoring' && pendingJobDescription && pendingResumeId) {
      const elapsed = Date.now() - (generationStartTime || Date.now());
      
      // If less than 5 minutes, show that generation is in progress
      if (elapsed < 5 * 60 * 1000) {
        return {
          inProgress: true,
          jobDescription: pendingJobDescription,
          resumeId: pendingResumeId,
          elapsed,
        };
      } else {
        // Clear stale state
        await this.clearGenerationState();
      }
    }

    return { inProgress: false };
  },
};
