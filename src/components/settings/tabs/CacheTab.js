import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const CacheTab = () => {
  const { t } = useTranslation();
  const [clearingCache, setClearingCache] = useState(false);
  const [loadingCacheInfo, setLoadingCacheInfo] = useState(false);
  const [cacheDetails, setCacheDetails] = useState(null);
  const [cacheStatus, setCacheStatus] = useState({ message: '', type: '' });

  // Function to fetch cache information
  const fetchCacheInfo = async () => {
    setLoadingCacheInfo(true);
    setCacheStatus({ message: '', type: '' }); // Reset status message

    try {
      const response = await fetch('http://localhost:3004/api/cache-info');
      const data = await response.json();

      if (data.success) {
        setCacheDetails(data.details);

        // If cache is empty, show a message
        if (data.details.totalCount === 0) {
          setCacheStatus({
            message: t('settings.cacheEmpty', 'Cache is empty. No files to clear.'),
            type: 'info'
          });
        }
      } else {
        throw new Error(data.error || 'Failed to fetch cache information');
      }
    } catch (error) {
      console.error('Error fetching cache info:', error);
      setCacheStatus({
        message: t('settings.cacheInfoError', 'Error fetching cache information: {{errorMessage}}', { errorMessage: error.message }),
        type: 'error'
      });
    } finally {
      setLoadingCacheInfo(false);
    }
  };

  // Handle clear cache
  const handleClearCache = async () => {
    // No confirmation prompt as requested
    setClearingCache(true);
    setCacheDetails(null); // Reset previous details
    setCacheStatus({ message: '', type: '' }); // Reset status message

    try {
      const response = await fetch('http://localhost:3004/api/clear-cache', {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        // Clear localStorage video/subtitle related items
        localStorage.removeItem('current_video_url');
        localStorage.removeItem('current_file_url');
        localStorage.removeItem('current_file_cache_id');

        // Check if details exist in the response
        if (data.details) {
          // Store the cache details for display
          setCacheDetails(data.details);

          // Set success message with details
          const totalFiles = data.details.totalCount || 0;
          const totalSize = data.details.formattedTotalSize || '0 Bytes';
          setCacheStatus({
            message: t('settings.cacheClearedDetails', 'Cache cleared: {{totalFiles}} files ({{totalSize}})', { totalFiles, totalSize }),
            type: 'success'
          });
        } else {
          // Fallback for when details are missing
          setCacheStatus({
            message: t('settings.cacheClearedSuccess', 'Cache cleared successfully!'),
            type: 'success'
          });

          // Fetch updated cache info if details weren't returned
          fetchCacheInfo();
        }
      } else {
        throw new Error(data.error || 'Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      setCacheStatus({
        message: t('settings.cacheClearError', 'Error clearing cache: {{errorMessage}}', { errorMessage: error.message }),
        type: 'error'
      });

      // Fetch updated cache info even if there was an error
      fetchCacheInfo();
    } finally {
      setClearingCache(false);
    }
  };

  // Fetch cache information when component mounts
  useEffect(() => {
    fetchCacheInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="settings-section cache-section">
      <div className="cache-content">
        <div className="cache-section-header">
          <h3>{t('settings.cache', 'Cache')}</h3>
          <button
            className="refresh-cache-btn"
            onClick={fetchCacheInfo}
            disabled={loadingCacheInfo}
            title={t('settings.refreshCacheTooltip', 'Refresh cache information')}
          >
            <span className="refresh-icon">↻</span>
            {t('settings.refresh', 'Refresh')}
          </button>
        </div>
        <p className="cache-description">
          {t('settings.cacheDescription', 'Clear all cached subtitles and downloaded videos to free up space.')}
        </p>
      </div>

      {/* Left Column */}
      <div className="cache-left-column">
        {/* Cache details */}
        {cacheDetails && !loadingCacheInfo && (
          <div className="cache-details">
            <div className="cache-details-header">
              <h4>{t('settings.cacheInformation', 'Cache Information')}</h4>
            </div>

            <div className="cache-details-summary">
              <p className="cache-total">
                <strong>{t('settings.totalCache', 'Total Cache: {{count}} files ({{size}})', { count: cacheDetails.totalCount, size: cacheDetails.formattedTotalSize })}</strong>
              </p>
            </div>

            <div className="cache-details-item">
              <h4>{t('settings.videos', 'Videos')}:</h4>
              <p>
                {t('settings.videosCount', '{{count}} files ({{size}})', { count: cacheDetails.videos?.count || 0, size: cacheDetails.videos?.formattedSize || '0 Bytes' })}
              </p>
            </div>

            <div className="cache-details-item">
              <h4>{t('settings.subtitles', 'Subtitles')}:</h4>
              <p>
                {t('settings.subtitlesCount', '{{count}} files ({{size}})', { count: cacheDetails.subtitles?.count || 0, size: cacheDetails.subtitles?.formattedSize || '0 Bytes' })}
              </p>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {loadingCacheInfo && (
          <div className="cache-loading">
            <p>{t('settings.loadingCache', 'Loading cache information...')}</p>
          </div>
        )}

        {/* Empty cache info when no details are shown */}
        {!cacheDetails && !cacheStatus.message && !loadingCacheInfo && (
          <div className="empty-cache-info">
            <p>{t('settings.cacheEmpty', 'No cache information available.')}</p>
            <button
              className="refresh-cache-btn"
              onClick={fetchCacheInfo}
              disabled={loadingCacheInfo}
            >
              {t('settings.refreshCache', 'Refresh Cache Info')}
            </button>
          </div>
        )}
      </div>

      {/* Right Column */}
      <div className="cache-right-column">
        {/* Cache status message */}
        {cacheStatus.message && (
          <div className={`cache-status-message status-${cacheStatus.type}`}>
            {cacheStatus.message}
          </div>
        )}

        {/* Cache actions */}
        <div className="cache-actions">
          <button
            className="clear-cache-btn"
            onClick={handleClearCache}
            disabled={clearingCache}
          >
            {clearingCache
              ? t('settings.clearingCache', 'Clearing Cache...')
              : t('settings.clearCache', 'Clear Cache')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CacheTab;
