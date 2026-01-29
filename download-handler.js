// Download handler for tailored resumes

window.DownloadHandler = {
  async downloadTailoredResume(format) {
    const { downloadUrls, lastResults } = await chrome.storage.local.get(['downloadUrls', 'lastResults']);
    const { resumeId } = await chrome.storage.local.get(['resumeId']);

    if (!lastResults || !resumeId) {
      window.showError('No results to download');
      return;
    }

    const fullDocumentContent = document.getElementById('full-document-content');
    const coverLetterContent = document.getElementById('cover-letter-content');
    // Note: Download button loading state is handled in popup.js

    try {
      // Get current edited content - prefer HTML if available (from rich editor)
      let currentResume = '';
      let currentCoverLetter = '';
      
      // Check for HTML content from rich editor (stored in data attributes)
      if (fullDocumentContent?.dataset.htmlContent) {
        currentResume = fullDocumentContent.dataset.htmlContent;
        console.log('Using HTML content from rich editor for resume');
      } else {
        currentResume = fullDocumentContent?.value || '';
      }
      
      if (coverLetterContent?.dataset.htmlContent) {
        currentCoverLetter = coverLetterContent.dataset.htmlContent;
        console.log('Using HTML content from rich editor for cover letter');
      } else {
        currentCoverLetter = coverLetterContent?.value || '';
      }

      // Get original content for comparison
      const originalResume = lastResults.fullResume || lastResults.fullDocument || '';
      const originalCoverLetter = lastResults.coverLetter || '';

      // Check if content has been edited
      const hasEdits = currentResume !== originalResume || currentCoverLetter !== originalCoverLetter;

      // Always use API endpoint to support edited content and create version records
      // Send HTML content if available, otherwise send plain text
      const contentToDownload = {
        fullResume: currentResume || originalResume,
        fullDocument: currentResume || originalResume,
        coverLetter: currentCoverLetter || originalCoverLetter,
        isHTML: !!(fullDocumentContent?.dataset.htmlContent || coverLetterContent?.dataset.htmlContent), // Flag to indicate HTML content
      };

      let downloadUrl = `${window.getApiBaseUrl()}/download-tailored-resume`;

      const { authToken } = await chrome.storage.local.get(['authToken']);

      const headers = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      if (downloadUrl.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
        if (!downloadUrl.includes('ngrok-skip-browser-warning')) {
          downloadUrl += (downloadUrl.includes('?') ? '&' : '?') + 'ngrok-skip-browser-warning=true';
        }
      }

      const response = await fetch(downloadUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          resumeId,
          content: contentToDownload, // Always send current content
          format: format,
        }),
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Download failed');
      }

      if (!response.ok) {
        let errorMessage = 'Download failed';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          }
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tailored-resume.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);

      // Reload resumes list if in settings
      if (typeof window.loadSettingsResumes === 'function') {
        setTimeout(() => window.loadSettingsResumes(currentPage || 1), 1000);
      }
    } catch (error) {
      console.error('Download error:', error);
      window.showError('Failed to download resume: ' + error.message);
      throw error; // Re-throw so popup.js can handle loading state cleanup
    }
  },
};
