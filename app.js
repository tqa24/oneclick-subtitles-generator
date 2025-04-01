// Subtitles Generator - Main Application Script

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const generateBtn = document.getElementById('generate-btn');
    const statusElement = document.getElementById('status');
    const subtitlesPreview = document.getElementById('subtitles-preview');
    const downloadSrtBtn = document.getElementById('download-srt');
    const downloadJsonBtn = document.getElementById('download-json');
    const youtubeUrlInput = document.getElementById('youtube-url-input');
    const youtubeSearchInput = document.getElementById('youtube-search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const fileUploadInput = document.getElementById('file-upload-input');
    const fileInfoElement = document.getElementById('file-info');

    // Settings modal elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeBtn = document.querySelector('.close-btn');
    const saveSettingsBtn = document.getElementById('save-settings');
    const geminiApiKeyInput = document.getElementById('gemini-api-key');
    const youtubeApiKeyInput = document.getElementById('youtube-api-key');
    const toggleVisibilityBtns = document.querySelectorAll('.toggle-visibility');

    // App state
    let activeTab = 'youtube-url';
    let selectedVideo = null;
    let uploadedFile = null;
    let subtitlesData = null;
    
    // Initialize settings
    initSettings();
    
    // Setup tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active tab
            activeTab = button.dataset.tab;
            
            // Update UI
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`${activeTab}-content`).classList.add('active');
        });
    });

    // Settings modal functionality
    settingsBtn.addEventListener('click', function() {
        settingsModal.style.display = 'block';
        updateApiKeyHelp(); // Update API key help instructions
    });
    
    closeBtn.addEventListener('click', function() {
        settingsModal.style.display = 'none';
    });
    
    window.addEventListener('click', function(event) {
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
    
    // Toggle API key visibility
    toggleVisibilityBtns.forEach(button => {
        button.addEventListener('click', function() {
            const inputId = this.getAttribute('data-for');
            const input = document.getElementById(inputId);
            
            if (input.type === 'password') {
                input.type = 'text';
                this.textContent = 'Hide';
            } else {
                input.type = 'password';
                this.textContent = 'Show';
            }
        });
    });

    saveSettingsBtn.addEventListener('click', function() {
        // Save API keys to local storage
        const geminiApiKey = geminiApiKeyInput.value.trim();
        const youtubeApiKey = youtubeApiKeyInput.value.trim();
        
        if (geminiApiKey) {
            localStorage.setItem('gemini_api_key', geminiApiKey);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
        
        if (youtubeApiKey) {
            localStorage.setItem('youtube_api_key', youtubeApiKey);
        } else {
            localStorage.removeItem('youtube_api_key');
        }
        
        // Update the global variables immediately so we don't need a page refresh
        window.API_KEY = geminiApiKey;
        window.YOUTUBE_API_KEY = youtubeApiKey;
        
        // Update API keys status
        window.API_KEYS_SET = {
            gemini: !!geminiApiKey,
            youtube: !!youtubeApiKey
        };
        
        // Check API keys status and update UI
        checkApiKeysStatus();
        showSaveNotification('Settings saved successfully!');
        
        // Close the modal
        settingsModal.style.display = 'none';
    });

    // YouTube URL validation
    youtubeUrlInput.addEventListener('input', function() {
        const url = this.value.trim();
        if (isValidYoutubeUrl(url)) {
            selectedVideo = { url: url };
        } else {
            selectedVideo = null;
        }
    });

    // YouTube search
    youtubeSearchInput.addEventListener('input', debounce(function() {
        const query = this.value.trim();
        if (query.length > 2) {
            searchYouTube(query);
        } else {
            searchResultsContainer.innerHTML = '';
        }
    }, 500));

    // File upload handling
    fileUploadInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            if (validateFile(file)) {
                uploadedFile = file;
                displayFileInfo(file);
            } else {
                uploadedFile = null;
                resetFileUpload();
                showError('Invalid file format or size. Please check the supported formats.');
            }
        }
    });

    // Generate button click
    generateBtn.addEventListener('click', async function() {
        // Check if API keys are set
        if (!API_KEYS_SET.gemini) {
            showError('Please set your Gemini API key in the settings first.');
            settingsModal.style.display = 'block';
            return;
        }
        
        if (activeTab === 'youtube-search' && !API_KEYS_SET.youtube) {
            showError('Please set your YouTube API key in the settings first.');
            settingsModal.style.display = 'block';
            return;
        }

        if (!validateInput()) {
            showError('Please provide a valid input (YouTube URL, search result, or file upload).');
            return;
        }

        // Disable button and show loading status
        generateBtn.disabled = true;
        updateStatus('Processing. This may take a few minutes...', 'loading');
        subtitlesPreview.innerHTML = '';
        downloadSrtBtn.disabled = true;
        downloadJsonBtn.disabled = true;

        try {
            // Get input based on active tab
            let input = null;
            let inputType = '';

            if (activeTab === 'youtube-url' && selectedVideo) {
                input = selectedVideo.url;
                inputType = 'youtube';
            } else if (activeTab === 'youtube-search' && selectedVideo) {
                input = selectedVideo.url;
                inputType = 'youtube';
            } else if (activeTab === 'file-upload' && uploadedFile) {
                input = uploadedFile;
                inputType = isVideoFile(uploadedFile.type) ? 'video' : 'audio';
            }

            // Generate subtitles using Gemini
            const subtitles = await generateSubtitles(input, inputType);
            subtitlesData = subtitles;

            // Display subtitles preview
            displaySubtitlesPreview(subtitles);
            updateStatus('Subtitles generated successfully!', 'success');
            
            // Enable download buttons
            downloadSrtBtn.disabled = false;
            downloadJsonBtn.disabled = false;
        } catch (error) {
            console.error('Error generating subtitles:', error);
            updateStatus(`Error: ${error.message}`, 'error');
        } finally {
            generateBtn.disabled = false;
        }
    });

    // Download buttons
    downloadSrtBtn.addEventListener('click', function() {
        if (subtitlesData) {
            downloadFile(convertToSRT(subtitlesData), 'subtitles.srt', 'text/plain');
        }
    });

    downloadJsonBtn.addEventListener('click', function() {
        if (subtitlesData) {
            downloadFile(JSON.stringify(subtitlesData, null, 2), 'subtitles.json', 'application/json');
        }
    });

    // Core functions
    async function generateSubtitles(input, inputType) {
        console.log(`Generating subtitles for ${inputType}: `, input);

        let requestData = {
            model: MODEL_CONFIG.model,
            contents: []
        };

        if (inputType === 'youtube') {
            // YouTube URL case
            requestData.contents = [
                {
                    role: "user",
                    parts: [
                        { text: "Transcribe this video" },
                        { 
                            fileData: {
                                fileUri: input
                            }
                        }
                    ]
                }
            ];
        } else if (inputType === 'video') {
            // Uploaded video file case
            const base64Data = await fileToBase64(input);
            requestData.contents = [
                {
                    role: "user",
                    parts: [
                        { text: "Transcribe this video" },
                        {
                            inlineData: {
                                mimeType: input.type,
                                data: base64Data
                            }
                        }
                    ]
                }
            ];
        } else if (inputType === 'audio') {
            // Uploaded audio file case
            const base64Data = await fileToBase64(input);
            requestData.contents = [
                {
                    role: "user",
                    parts: [
                        { text: "Transcribe this audio" },
                        {
                            inlineData: {
                                mimeType: input.type,
                                data: base64Data
                            }
                        }
                    ]
                }
            ];
        }

        try {
            // Call the Gemini API
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL_CONFIG.model + ':generateContent?key=' + window.API_KEY, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API error: ${errorData.error.message || response.statusText}`);
            }

            const data = await response.json();
            
            // Save debug response if debug mode is enabled
            if (DEBUG_MODE) {
                saveDebugResponse(data);
            }
            
            // Parse the response to extract subtitles
            return parseGeminiResponse(data);
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            throw new Error('Failed to generate subtitles. Please try again.');
        }
    }

    function parseGeminiResponse(response) {
        // Extract text from the response
        let text = '';
        
        if (response && 
            response.candidates && 
            response.candidates[0] && 
            response.candidates[0].content && 
            response.candidates[0].content.parts && 
            response.candidates[0].content.parts[0] && 
            response.candidates[0].content.parts[0].text) {
            text = response.candidates[0].content.parts[0].text;
        } else {
            console.error('Unexpected response format:', response);
            throw new Error('Invalid response format from Gemini API');
        }
        
        console.log('Raw text from Gemini:', text);
        
        // Parse the response text to extract subtitles
        const subtitles = [];
        
        // Format with milliseconds: [0m0s482ms - 0m1s542ms ]
        const regexWithMs = /\[\s*(\d+)m(\d+)s(\d+)ms\s*-\s*(\d+)m(\d+)s(\d+)ms\s*\]\s*(.*?)(?=\[\s*\d+m\d+s|\s*$)/gs;
        
        let match;
        let hasTimestamps = false;
        
        while ((match = regexWithMs.exec(text)) !== null) {
            hasTimestamps = true;
            // Extract time components with milliseconds
            const startMin = parseInt(match[1]);
            const startSec = parseInt(match[2]);
            const startMs = parseInt(match[3]);
            const endMin = parseInt(match[4]);
            const endSec = parseInt(match[5]);
            const endMs = parseInt(match[6]);
            
            // Format times as MM:SS.mmm for internal storage (will be converted to proper SRT format later)
            const startTime = `${startMin}:${startSec.toString().padStart(2, '0')}.${startMs.toString().padStart(3, '0')}`;
            const endTime = `${endMin}:${endSec.toString().padStart(2, '0')}.${endMs.toString().padStart(3, '0')}`;
            
            // Extract and clean the subtitle text
            let subtitleText = match[7].trim();
            
            subtitles.push({
                id: subtitles.length + 1,
                startTime,
                endTime,
                text: subtitleText
            });
        }
        
        // If no subtitles were found with the milliseconds pattern, try the original format
        if (subtitles.length === 0) {
            // Original format: [ 0m0s - 0m29s ]
            const regexOriginal = /\[\s*(\d+)m(\d+)s\s*-\s*(\d+)m(\d+)s\s*\](?:\n|\r\n?)+(.*?)(?=\[\s*\d+m\d+s|\s*$)/gs;
            
            while ((match = regexOriginal.exec(text)) !== null) {
                hasTimestamps = true;
                // Extract time components
                const startMin = parseInt(match[1]);
                const startSec = parseInt(match[2]);
                const endMin = parseInt(match[3]);
                const endSec = parseInt(match[4]);
                
                // Format times as MM:SS.000
                const startTime = `${startMin}:${startSec.toString().padStart(2, '0')}.000`;
                const endTime = `${endMin}:${endSec.toString().padStart(2, '0')}.000`;
                
                // Extract and clean the subtitle text
                let subtitleText = match[5].trim();
                
                subtitles.push({
                    id: subtitles.length + 1,
                    startTime,
                    endTime,
                    text: subtitleText
                });
            }
        }
        
        // If no explicit timestamps found, create approximate timestamps based on line breaks
        if (!hasTimestamps) {
            console.warn('No timestamps found in response, generating approximate timestamps');
            
            // Split the text by line breaks
            const lines = text.split(/\n+/).filter(line => line.trim() !== '');
            
            // Calculate average line duration based on typical song length (estimated 3 minutes for songs)
            // This will give each line roughly equal time distribution
            const totalLines = lines.length;
            const estimatedDurationSec = 180; // 3 minutes in seconds
            const avgLineDurationSec = Math.floor(estimatedDurationSec / totalLines);
            
            lines.forEach((line, index) => {
                const startTimeSec = index * avgLineDurationSec;
                const endTimeSec = (index + 1) * avgLineDurationSec;
                
                // Convert to MM:SS format
                const startMin = Math.floor(startTimeSec / 60);
                const startSec = startTimeSec % 60;
                const endMin = Math.floor(endTimeSec / 60);
                const endSec = endTimeSec % 60;
                
                const startTime = `${startMin}:${startSec.toString().padStart(2, '0')}.000`;
                const endTime = `${endMin}:${endSec.toString().padStart(2, '0')}.000`;
                
                subtitles.push({
                    id: index + 1,
                    startTime,
                    endTime,
                    text: line.trim()
                });
            });
        }
        
        console.log('Extracted subtitles:', subtitles);
        return subtitles;
    }

    function displaySubtitlesPreview(subtitles) {
        subtitlesPreview.innerHTML = '';
        
        if (subtitles.length === 0) {
            subtitlesPreview.innerHTML = '<p>No subtitles could be extracted. Please try a different input or format.</p>';
            return;
        }
        
        subtitles.forEach(subtitle => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'subtitle-entry';
            
            const timingDiv = document.createElement('div');
            timingDiv.className = 'subtitle-timing';
            timingDiv.textContent = `${subtitle.startTime} → ${subtitle.endTime}`;
            
            const textDiv = document.createElement('div');
            textDiv.className = 'subtitle-text';
            textDiv.textContent = subtitle.text;
            
            entryDiv.appendChild(timingDiv);
            entryDiv.appendChild(textDiv);
            subtitlesPreview.appendChild(entryDiv);
        });
    }

    function convertToSRT(subtitles) {
        return subtitles.map((subtitle, index) => {
            const id = index + 1;
            const timeFormat = time => {
                const [minutes, seconds] = time.split(':').map(Number);
                return `00:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},000`;
            };
            const startTime = timeFormat(subtitle.startTime);
            const endTime = timeFormat(subtitle.endTime);
            
            return `${id}\n${startTime} --> ${endTime}\n${subtitle.text}\n`;
        }).join('\n');
    }

    // Helper functions
    function updateStatus(message, type = '') {
        statusElement.textContent = message;
        statusElement.className = 'status';
        if (type) {
            statusElement.classList.add(type);
        }
    }

    function showError(message) {
        updateStatus(message, 'error');
    }

    function isValidYoutubeUrl(url) {
        const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})$/;
        return regex.test(url);
    }

    function validateFile(file) {
        // Check file size
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
            return false;
        }
        
        // Check file type
        return isVideoFile(file.type) || isAudioFile(file.type);
    }

    function isVideoFile(mimeType) {
        return SUPPORTED_VIDEO_FORMATS.includes(mimeType);
    }

    function isAudioFile(mimeType) {
        return SUPPORTED_AUDIO_FORMATS.includes(mimeType);
    }

    function displayFileInfo(file) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileInfoElement.innerHTML = `\
            <p><strong>File:</strong> ${file.name}</p>\
            <p><strong>Type:</strong> ${file.type}</p>\
            <p><strong>Size:</strong> ${fileSizeMB} MB</p>\
        `;
        fileInfoElement.style.display = 'block';
    }

    function resetFileUpload() {
        fileUploadInput.value = '';
        fileInfoElement.style.display = 'none';
    }

    function validateInput() {
        if (activeTab === 'youtube-url') {
            return selectedVideo !== null;
        } else if (activeTab === 'youtube-search') {
            return selectedVideo !== null;
        } else if (activeTab === 'file-upload') {
            return uploadedFile !== null;
        }
        return false;
    }

    async function searchYouTube(query) {
        // Check if YouTube API key is set
        if (!API_KEYS_SET.youtube) {
            searchResultsContainer.innerHTML = '<p>Please set your YouTube API key in the settings first.</p>';
            return;
        }

        searchResultsContainer.innerHTML = '<p>Searching...</p>';
        
        try {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`);
            
            if (!response.ok) {
                throw new Error('YouTube API request failed');
            }
            
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                displaySearchResults(data.items.map(item => ({
                    id: item.id.videoId,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.default.url,
                    channel: item.snippet.channelTitle
                })));
            } else {
                searchResultsContainer.innerHTML = '<p>No results found.</p>';
            }
        } catch (error) {
            console.error('Error searching YouTube:', error);
            searchResultsContainer.innerHTML = '<p>Error searching YouTube. Please try again or enter a URL directly.</p>';
        }
    }

    function displaySearchResults(results) {
        searchResultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<p>No results found.</p>';
            return;
        }
        
        results.forEach(video => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.dataset.videoId = video.id;
            resultItem.dataset.videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
            
            resultItem.innerHTML = `\
                <img src="${video.thumbnail}" alt="${video.title}" class="search-result-thumbnail">\
                <div class="search-result-info">\
                    <div class="search-result-title">${video.title}</div>\
                    <div class="search-result-channel">${video.channel}</div>\
                </div>\
            `;
            
            resultItem.addEventListener('click', function() {
                selectedVideo = {
                    id: video.id,
                    title: video.title,
                    url: `https://www.youtube.com/watch?v=${video.id}`
                };
                
                // Visual feedback for selection
                document.querySelectorAll('.search-result-item').forEach(item => {
                    item.style.border = '1px solid #ddd';
                });
                this.style.border = '2px solid #4285f4';
            });
            
            searchResultsContainer.appendChild(resultItem);
        });
    }

    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }

    async function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = error => reject(error);
        });
    }

    function downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }

    function saveDebugResponse(response) {
        const debugData = {
            timestamp: new Date().toISOString(),
            response: response
        };
        const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gemini-response-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }

    // Helper functions for settings
    function initSettings() {
        // Populate inputs with saved API keys if any
        if (API_KEY) {
            geminiApiKeyInput.value = API_KEY;
        }
        
        if (YOUTUBE_API_KEY) {
            youtubeApiKeyInput.value = YOUTUBE_API_KEY;
        }
        
        // Check API keys status and update UI
        checkApiKeysStatus();
    }
    
    function checkApiKeysStatus() {
        // If no API keys are set, show a message to the user
        if (!API_KEYS_SET.gemini || !API_KEYS_SET.youtube) {
            let message = 'Please set your ';
            if (!API_KEYS_SET.gemini && !API_KEYS_SET.youtube) {
                message += 'Gemini and YouTube API keys';
            } else if (!API_KEYS_SET.gemini) {
                message += 'Gemini API key';
            } else {
                message += 'YouTube API key';
            }
            message += ' in the settings to use this application.';
            
            showStatus(message, 'info');
        }
    }
    
    function showValidationError(parent, message) {
        // Remove any existing validation messages
        const existingMessage = parent.querySelector('.validation-message');
        if (existingMessage) {
            parent.removeChild(existingMessage);
        }
        
        // Add invalid class
        parent.classList.add('invalid');
        parent.classList.remove('valid');
        
        // Add error message
        const errorElement = document.createElement('div');
        errorElement.className = 'validation-message error';
        errorElement.textContent = message;
        parent.appendChild(errorElement);
    }
    
    function showSaveNotification(message) {
        // Check if notification element exists, create if not
        let notification = document.querySelector('.save-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'save-notification';
            document.body.appendChild(notification);
        }
        
        // Set message and show
        notification.textContent = message;
        notification.style.display = 'block';
        
        // Hide after animation completes
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
    
    function updateApiKeyHelp() {
        // Add help text for API keys with links
        const geminiApiKeyHelp = document.getElementById('gemini-api-key-help');
        const youtubeApiKeyHelp = document.getElementById('youtube-api-key-help');
        
        if (geminiApiKeyHelp) {
            geminiApiKeyHelp.innerHTML = `
                <h4>Get Gemini API Key</h4>
                <ol>
                    <li>Login to <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a></li>
                    <li>Click 'Get API Key'</li>
                    <li>Create a new key or select existing</li>
                    <li>Copy your API key</li>
                    <li>Paste it into the field above</li>
                </ol>
            `;
        }
        
        if (youtubeApiKeyHelp) {
            youtubeApiKeyHelp.innerHTML = `
                <h4>Get YouTube API Key</h4>
                <ol>
                    <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a></li>
                    <li>Create or select a project</li>
                    <li>Enable 'YouTube Data API v3'</li>
                    <li>Go to credentials</li>
                    <li>Generate API key</li>
                </ol>
            `;
        }
    }
    
    function showStatus(message, type = '') {
        statusElement.textContent = message;
        statusElement.className = 'status';
        if (type) {
            statusElement.classList.add(type);
        }
    }
});