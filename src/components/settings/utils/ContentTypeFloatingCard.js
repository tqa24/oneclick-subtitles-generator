import React, { useEffect } from 'react';

const ContentTypeFloatingCard = ({ textareaRef, floatingCardRef, transcriptionPrompt }) => {
  // Effect to handle the floating content type card positioning and text hiding
  useEffect(() => {
    const textarea = textareaRef.current;
    const floatingCard = floatingCardRef.current;

    if (!textarea || !floatingCard) return;

    // Create a hidden overlay to hide the {contentType} text
    const createOverlay = () => {
      // Remove any existing overlay
      const existingOverlay = document.getElementById('content-type-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // Check if transcriptionPrompt is defined
      if (!transcriptionPrompt) {
        console.warn('transcriptionPrompt is undefined in ContentTypeFloatingCard');
        return;
      }

      // Find the position of {contentType} in the text
      const contentTypePos = transcriptionPrompt.indexOf('{contentType}');

      if (contentTypePos !== -1) {
        // Calculate the position in the textarea
        const textBeforeCursor = transcriptionPrompt.substring(0, contentTypePos);

        // Create a temporary element to measure text width
        const tempSpan = document.createElement('span');
        tempSpan.style.font = window.getComputedStyle(textarea).font;
        tempSpan.style.position = 'absolute';
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.whiteSpace = 'pre-wrap';
        tempSpan.style.overflowWrap = 'break-word'; // Modern alternative to wordWrap
        tempSpan.style.width = (textarea.clientWidth - 24) + 'px'; // Account for padding
        tempSpan.textContent = textBeforeCursor;
        document.body.appendChild(tempSpan);

        // Get the line and character position
        const lines = tempSpan.textContent.split('\n');
        const lastLine = lines[lines.length - 1];

        // Calculate position
        const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight);
        const paddingLeft = parseFloat(window.getComputedStyle(textarea).paddingLeft);
        const paddingTop = parseFloat(window.getComputedStyle(textarea).paddingTop);

        // Create an overlay to hide the {contentType} text
        const overlay = document.createElement('div');
        overlay.id = 'content-type-overlay';
        overlay.style.position = 'absolute';
        overlay.style.left = (paddingLeft + lastLine.length * 8) + 'px';
        overlay.style.top = (paddingTop + (lines.length - 1) * lineHeight - textarea.scrollTop) + 'px';
        // Match the background color of the textarea
        const computedStyle = window.getComputedStyle(textarea);
        overlay.style.backgroundColor = computedStyle.backgroundColor;
        // Add a small transition to handle theme changes
        overlay.style.transition = 'background-color 0.3s ease';
        overlay.style.width = '{contentType}'.length * 8 + 'px'; // Approximate width
        overlay.style.height = lineHeight + 'px';
        overlay.style.zIndex = '5';
        overlay.style.pointerEvents = 'none';

        // Position the card
        floatingCard.style.left = (paddingLeft + lastLine.length * 8) + 'px';
        floatingCard.style.top = (paddingTop + (lines.length - 1) * lineHeight - textarea.scrollTop) + 'px';

        // Add the overlay to the container
        const container = textarea.parentElement;
        container.style.position = 'relative';
        container.appendChild(overlay);

        // Clean up
        document.body.removeChild(tempSpan);
      }
    };

    // Update position initially and on text changes
    createOverlay();

    // Add event listeners
    textarea.addEventListener('click', createOverlay);
    textarea.addEventListener('keyup', createOverlay);
    textarea.addEventListener('scroll', createOverlay);
    textarea.addEventListener('input', createOverlay);

    // Listen for theme changes
    window.addEventListener('storage', createOverlay);
    // MutationObserver to detect theme attribute changes on document element
    const observer = new MutationObserver(createOverlay);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // Clean up event listeners
    return () => {
      textarea.removeEventListener('click', createOverlay);
      textarea.removeEventListener('keyup', createOverlay);
      textarea.removeEventListener('scroll', createOverlay);
      textarea.removeEventListener('input', createOverlay);
      window.removeEventListener('storage', createOverlay);

      // Disconnect the observer
      observer.disconnect();

      // Remove overlay on unmount
      const existingOverlay = document.getElementById('content-type-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
    };
  }, [transcriptionPrompt, textareaRef, floatingCardRef]);

  return (
    <div className="content-type-floating-card" ref={floatingCardRef}>
      <span className="content-type-icon video-icon">🎬</span>
      <span className="content-type-separator">/</span>
      <span className="content-type-icon audio-icon">🎵</span>
    </div>
  );
};

export default ContentTypeFloatingCard;
