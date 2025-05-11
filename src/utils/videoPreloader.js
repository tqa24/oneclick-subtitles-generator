import { startYoutubeVideoDownload } from './videoDownloader';

export const preloadYouTubeVideo = (videoUrl) => {


    if (!videoUrl || (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be'))) {
        return;
    }

    // Store the URL in localStorage for the VideoPreview component
    localStorage.setItem('current_video_url', videoUrl);

    // Start the background download process
    try {
        startYoutubeVideoDownload(videoUrl);
    } catch (error) {
        console.warn('Failed to start background download:', error);
    }
};