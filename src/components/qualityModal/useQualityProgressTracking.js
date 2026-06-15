// Quality re-download orchestration for the Video Quality modal.
// Encapsulates starting the download, polling for progress, and cancelling.
// Behavior is moved verbatim from VideoQualityModal.js.

const useQualityProgressTracking = ({
  progressIntervalRef,
  qualityVideoId,
  setIsRedownloading,
  setDownloadProgress,
  onConfirm,
  handleClose,
}) => {
  // Cancel an in-progress quality re-download
  const handleCancelRedownload = async () => {
    try {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (qualityVideoId) {
        await fetch(`http://localhost:3031/api/cancel-quality-download/${encodeURIComponent(qualityVideoId)}`, { method: 'POST' });
      }
    } catch (e) {
      // ignore
    } finally {
      setIsRedownloading(false);
    }
  };

  // Start quality download with pre-generated video ID
  const startQualityDownloadWithId = async (quality, url, videoId) => {
    const response = await fetch('http://localhost:3031/api/download-video-quality', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        quality: quality,
        videoId: videoId,
        useCookies: localStorage.getItem('use_cookies_for_download') === 'true'
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to start download');
    }

    return data;
  };

  // Start progress tracking using polling (WebSocket disabled to prevent duplicates)
  const startProgressTracking = (videoId, quality, url) => {
    // Clear any existing interval first
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // Use polling instead of WebSocket
    const newProgressInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3031/api/quality-download-progress/${videoId}`);
        const data = await response.json();

        if (data.success) {
          const newProgress = data.progress || 0;

          // Filter out unreasonable progress values
          if (newProgress >= 0 && newProgress <= 100) {
            setDownloadProgress(newProgress);
          }

          if (data.status === 'completed') {
            clearInterval(newProgressInterval);
            progressIntervalRef.current = null;
            setIsRedownloading(false);
            setDownloadProgress(100);

            // Call onConfirm to proceed to rendering, then close modal
            setTimeout(async () => {
              try {
                await onConfirm('redownload', {
                  quality: quality,
                  url: url,
                  videoId: videoId
                });
                handleClose();
              } catch (error) {
                console.error('[VideoQualityModal] Error confirming redownload:', error);
                handleClose();
              }
            }, 1000);
          } else if (data.status === 'cancelled') {
            clearInterval(newProgressInterval);
            progressIntervalRef.current = null;
            setIsRedownloading(false);
          } else if (data.status === 'error') {
            clearInterval(newProgressInterval);
            progressIntervalRef.current = null;
            setIsRedownloading(false);
            console.error('[VideoQualityModal] Download error:', data.error);
          }
        }
      } catch (error) {
        console.error('Error fetching download progress:', error);
      }
    }, 1000);

    // Store interval in ref for cleanup
    progressIntervalRef.current = newProgressInterval;
  };

  return {
    handleCancelRedownload,
    startQualityDownloadWithId,
    startProgressTracking,
  };
};

export default useQualityProgressTracking;
