/**
 * Add floating buttons to standalone album art previews
 */
document.addEventListener('DOMContentLoaded', () => {
  // Find all standalone album-art-preview elements
  const albumArtPreviews = document.querySelectorAll('div.album-art-preview');

  albumArtPreviews.forEach(preview => {
    // Skip if it's already inside the BackgroundImageGenerator component
    if (preview.closest('.album-art-container')) {
      return;
    }

    // Get the image inside the preview
    const img = preview.querySelector('img');
    if (!img) return;

    // Create download button
    const downloadButton = document.createElement('button');
    downloadButton.className = 'floating-download-button';
    downloadButton.title = 'Download';

    // Special case for image-preview
    if (preview.closest('.image-preview')) {
      downloadButton.style.top = '12px';
      downloadButton.style.right = '12px';
      downloadButton.style.bottom = 'auto';
      downloadButton.style.left = 'auto';
    }
    downloadButton.innerHTML = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';

    // Add click event to download the image
    downloadButton.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = img.src;
      link.download = img.src.split('/').pop() || 'album-art.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    // Add the button to the preview
    preview.appendChild(downloadButton);
  });
});
