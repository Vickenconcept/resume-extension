# Resume Tailor Chrome Extension

A browser extension that lets job seekers highlight a job description and instantly generate tailored resume bullets and role-specific summaries using their existing resume.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. The extension icon should appear in your toolbar

## Usage

1. Click the extension icon
2. Upload your resume (PDF or DOCX)
3. Browse any job posting
4. Highlight the job description text
5. Right-click → "Tailor resume to this role"
6. View your tailored content in the popup
7. Copy or download your tailored resume sections

## Development

- `manifest.json` - Extension configuration
- `background.js` - Service worker for context menu
- `content.js` - Content script for page interaction
- `popup.html/css/js` - Extension popup UI

## API Endpoints

The extension communicates with the backend API:
- `POST /api/upload-resume` - Upload resume file
- `POST /api/tailor-resume` - Generate tailored content
- `POST /api/download-tailored-resume` - Download tailored resume

## Standard Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Success message"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "message": "Error message",
  "data": null
}
```
