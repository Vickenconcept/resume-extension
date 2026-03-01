// Download handler for tailored resumes

window.DownloadHandler = {
  async downloadTailoredResume(format) {
    const { lastResults } = await chrome.storage.local.get(['lastResults']);
    const { resumeId } = await chrome.storage.local.get(['resumeId']);

    if (!lastResults || !resumeId) {
      window.showError('No results to download');
      return;
    }

    const fullDocumentContent = document.getElementById('full-document-content');
    const coverLetterContent = document.getElementById('cover-letter-content');
    // Note: Download button loading state is handled in popup.js

    try {
      // Get HTML content from expanded editor (this is the source of truth)
      // The textarea is now read-only and just displays a plain text version
      const resumeHtml = fullDocumentContent?.dataset.htmlContent || '';
      const coverLetterHtml = coverLetterContent?.dataset.htmlContent || '';
      
      // Get plain text from textarea (read-only view)
      const resumeText = fullDocumentContent?.value || '';
      const coverLetterText = coverLetterContent?.value || '';

      // Get original content for fallback
      const originalResume = lastResults.fullResume || lastResults.fullDocument || '';
      const originalCoverLetter = lastResults.coverLetter || '';

      // Priority: HTML from editor > textarea text > original content
      // Always prefer HTML if it exists (it contains formatting from the editor)
      const finalResume = resumeHtml || resumeText || originalResume;
      const finalCoverLetter = coverLetterHtml || coverLetterText || originalCoverLetter;
      
      // Determine if content is HTML (if HTML exists, it's HTML)
      const isHtml = !!(resumeHtml || coverLetterHtml);

      console.log('Download content:', {
        hasResumeHtml: !!resumeHtml,
        hasCoverLetterHtml: !!coverLetterHtml,
        hasResumeText: !!resumeText,
        hasCoverLetterText: !!coverLetterText,
        isHtml,
        resumeLength: finalResume.length,
        coverLetterLength: finalCoverLetter.length,
      });

      // Always use API endpoint to support edited content and create version records
      // Send HTML content if available (from expanded editor), otherwise send plain text
      const contentToDownload = {
        fullResume: finalResume,
        fullDocument: finalResume,
        coverLetter: finalCoverLetter,
        isHTML: isHtml, // Flag to indicate HTML content
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
