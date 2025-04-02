import { startYoutubeVideoDownload } from './videoDownloader';

export const preloadYouTubeVideo = (videoUrl) => {
    console.log('Preloading YouTube video:', videoUrl);
    
    if (!videoUrl || (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be'))) {
        return;
    }
    
    // Store the URL in localStorage for the VideoPreview component
    localStorage.setItem('current_video_url', videoUrl);
    
    // Start the background download process
    try {
        const videoId = startYoutubeVideoDownload(videoUrl);
        console.log('Started background download for YouTube video ID:', videoId);
    } catch (error) {
        console.warn('Failed to start background download:', error);
    }
};