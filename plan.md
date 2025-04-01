do not use python, implement this app called "Subtitles Generator", super simple app but powerful, input could be any kind of videos/audios, output is SRT/JSON file, and the special thing about this is no need for providing subtitles, gemini can still return timings + subtitles. to submit the video/audio, user must use one of the 3 ways: 1. youtube url 2. youtube video title 3. self upload. first method (YouTube URL) will get us an URL, second method (YouTube Search) also get us the URL, third method (Upload File) get us the audio or video files, those are the input we need to send to Gemini (depend on which method user used). (also the button must be "Generate timed subtitles"):

** surprise!! Gemini can also understand video (in the form of video or yotuube url), only when user chose to upload and provide an audio then only send audio to gemini, here is how to prompt: 

first case: if we have youtube url (using the first 2 methods surely have url) 
second case: if using the upload method and is video: 
third case: if using the upload method and is audio
(all these 3 cases, please refer to geminiaudioandvideoprompting.md)

so what i mean is the it will only one thing sent to gemni either url or the audio or the video, 
in the prompt, just simply say "Transcribe this video" or "Transcribe this audio" and remember to save gemini response to file, we will investigate the format from teh debug file gemini gave and adapt to gemini later (this means that we do not force a returning format on Gemini, so that it can focus on getting the accurate result rather than minding our expected format)

the model we must use is "gemini-2.5-pro-exp-03-25"

must let the user enter api key on frontend