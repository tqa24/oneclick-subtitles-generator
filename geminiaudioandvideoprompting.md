Prompting with video
In this tutorial, you will upload a video using the File API and generate content based on those images.

Technical details (video)
Gemini 1.5 Pro and Flash support up to approximately an hour of video data.

Video must be in one of the following video format MIME types:

video/mp4
video/mpeg
video/mov
video/avi
video/x-flv
video/mpg
video/webm
video/wmv
video/3gpp
The File API service extracts image frames from videos at 1 frame per second (FPS) and audio at 1Kbps, single channel, adding timestamps every second. These rates are subject to change in the future for improvements in inference.

Note: The details of fast action sequences may be lost at the 1 FPS frame sampling rate. Consider slowing down high-speed clips for improved inference quality.
Individual frames are 258 tokens, and audio is 32 tokens per second. With metadata, each second of video becomes ~300 tokens, which means a 1M context window can fit slightly less than an hour of video. As a result, Gemini Pro, which has a 2M context window, can handle a maximum video length of 2 hours, and Gemini Flash, which has a 1M context window, can handle a maximum video length of 1 hour.

To ask questions about time-stamped locations, use the format MM:SS, where the first two digits represent minutes and the last two digits represent seconds.

For best results:

Use one video per prompt.
If using a single video, place the text prompt after the video.
Upload a video file using the File API
Note: The File API lets you store up to 20 GB of files per project, with a per-file maximum size of 2 GB. Files are stored for 48 hours. They can be accessed in that period with your API key, but they cannot be downloaded using any API. It is available at no cost in all regions where the Gemini API is available.
The File API accepts video file formats directly. This example uses the short NASA film "Jupiter's Great Red Spot Shrinks and Grows". Credit: Goddard Space Flight Center (GSFC)/David Ladd (2018).

"Jupiter's Great Red Spot Shrinks and Grows" is in the public domain and does not show identifiable people. (NASA image and media usage guidelines.)

Start by retrieving the short video:


wget https://storage.googleapis.com/generativeai-downloads/images/GreatRedSpot.mp4
Upload the video using the File API and print the URI.


// To use the File API, use this import path for GoogleAIFileManager.
// Note that this is a different import path than what you use for generating content.
// For versions lower than @google/generative-ai@0.13.0
// use "@google/generative-ai/files"
import { GoogleAIFileManager } from "@google/generative-ai/server";

// Initialize GoogleAIFileManager with your GEMINI_API_KEY.
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

// Upload the file and specify a display name.
const uploadResponse = await fileManager.uploadFile("GreatRedSpot.mp4", {
  mimeType: "video/mp4",
  displayName: "Jupiter's Great Red Spot",
});

// View the response.
console.log(`Uploaded file ${uploadResponse.file.displayName} as: ${uploadResponse.file.uri}`);
Verify file upload and check state
Verify the API has successfully received the files by calling the files.get method.

Note: Video files have a State field in the File API. When a video is uploaded, it will be in the PROCESSING state until it is ready for inference. Only ACTIVE files can be used for model inference.

// To use the File API, use this import path for GoogleAIFileManager.
// Note that this is a different import path than what you use for generating content.
// For versions lower than @google/generative-ai@0.13.0
// use "@google/generative-ai/files"
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

// Initialize GoogleAIFileManager with your GEMINI_API_KEY.
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

// Upload the video file using the File API
// uploadResponse = ...
const name = uploadResponse.file.name;

// Poll getFile() on a set interval (10 seconds here) to check file state.
let file = await fileManager.getFile(name);
while (file.state === FileState.PROCESSING) {
  process.stdout.write(".")
  // Sleep for 10 seconds
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  // Fetch the file from the API again
  file = await fileManager.getFile(name)
}

if (file.state === FileState.FAILED) {
  throw new Error("Video processing failed.");
}

// When file.state is ACTIVE, the file is ready to be used for inference.
console.log(`File ${file.displayName} is ready for inference as ${file.uri}`);

Prompt with a video and text
Once the uploaded video is in the ACTIVE state, you can make GenerateContent requests that specify the File API URI for that video. Select the generative model and provide it with the uploaded video and a text prompt.


// To generate content, use this import path for GoogleGenerativeAI.
// Note that this is a different import path than what you use for the File API.
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize GoogleGenerativeAI with your GEMINI_API_KEY.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Choose a Gemini model.
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro",
});

// Upload the video file using the File API
// uploadResponse = ...

// Generate content using text and the URI reference for the uploaded file.
const result = await model.generateContent([
    {
      fileData: {
        mimeType: uploadResponse.file.mimeType,
        fileUri: uploadResponse.file.uri
      }
    },
    { text: "Summarize this video. Then create a quiz with answer key based on the information in the video." },
  ]);

// Handle the response of generated text
console.log(result.response.text())

Upload a video inline
If your video is less than 20MB, you can include it inline with your request as a data Part.

Here's an example of uploading a video inline:


import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "node:fs";

// Only for videos of size <20Mb
const videoFileName = "/path/to/your/video.mp4";
const videoBytes = fs.readFileSync(videoFileName, { encoding: "base64" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
const result = await model.generateContent([
  "Can you summarize this video?",
  {
    inlineData: {
      data: videoBytes,
      mimeType: "video/mp4",
    },
  },
]);
console.log(result.response.text());
Include a YouTube URL
Preview: The YouTube URL feature is in preview and is currently free of charge. Pricing and rate limits are likely to change.
The Gemini API and AI Studio support YouTube URLs as a file data Part. You can include a YouTube URL with a prompt asking the model to summarize, translate, or otherwise interact with the video content.

Limitations:

You can't upload more than 8 hours of YouTube video per day.
You can upload only 1 video per request.
You can only upload public videos (not private or unlisted videos).
Note: Gemini Pro, which has a 2M context window, can handle a maximum video length of 2 hours, and Gemini Flash, which has a 1M context window, can handle a maximum video length of 1 hour.
The following example shows how to include a YouTube URL with a prompt:


import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
const result = await model.generateContent([
  "Can you summarize this video?",
  {
    fileData: {
      fileUri: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
    },
  },
]);
console.log(result.response.text());
Refer to timestamps in the content
You can use timestamps of the form MM:SS to refer to specific moments in the video.


// To generate content, use this import path for GoogleGenerativeAI.
// Note that this is a different import path than what you use for the File API.
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize GoogleGenerativeAI with your GEMINI_API_KEY.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Choose a Gemini model.
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro",
});

// Upload the video file using the File API
// uploadResponse = ...

// Generate content using text and the URI reference for the uploaded file.
const result = await model.generateContent([
    {
      fileData: {
        mimeType: uploadResponse.file.mimeType,
        fileUri: uploadResponse.file.uri
      }
    },
    { text: "What are the examples given at 01:05 and 01:19 supposed to show us?" },
  ]);

// Handle the response of generated text
console.log(result.response.text())

Transcribe video and provide visual descriptions
If the video is not fast-paced (only 1 frame per second of video is sampled), it's possible to transcribe the video with visual descriptions for each shot.


// To generate content, use this import path for GoogleGenerativeAI.
// Note that this is a different import path than what you use for the File API.
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize GoogleGenerativeAI with your GEMINI_API_KEY.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Choose a Gemini model.
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro",
});

// Upload the video file using the File API
// uploadResponse = ...

// Generate content using text and the URI reference for the uploaded file.
const result = await model.generateContent([
    {
      fileData: {
        mimeType: uploadResponse.file.mimeType,
        fileUri: uploadResponse.file.uri
      }
    },
    { text: "Transcribe the audio, giving timestamps. Also provide visual descriptions." },
  ]);

// Handle the response of generated text
console.log(result.response.text())

List files
You can list all files uploaded using the File API and their URIs using files.list.


// Make sure to include these imports:
// import { GoogleAIFileManager } from "@google/generative-ai/server";
const fileManager = new GoogleAIFileManager(process.env.API_KEY);

const listFilesResponse = await fileManager.listFiles();

// View the response.
for (const file of listFilesResponse.files) {
  console.log(`name: ${file.name} | display name: ${file.displayName}`);
}

Delete files
Files uploaded using the File API are automatically deleted after 2 days. You can also manually delete them using files.delete.


// Make sure to include these imports:
// import { GoogleAIFileManager } from "@google/generative-ai/server";
const fileManager = new GoogleAIFileManager(process.env.API_KEY);

const uploadResult = await fileManager.uploadFile(
  `${mediaPath}/jetpack.jpg`,
  {
    mimeType: "image/jpeg",
    displayName: "Jetpack drawing",
  },
);

// Delete the file.
await fileManager.deleteFile(uploadResult.file.name);

console.log(`Deleted ${uploadResult.file.displayName}`);

Explore audio capabilities with the Gemini API

Python JavaScript Go REST

Gemini can respond to prompts about audio. For example, Gemini can:

Describe, summarize, or answer questions about audio content.
Provide a transcription of the audio.
Provide answers or a transcription about a specific segment of the audio.
Note: You can't generate audio output with the Gemini API.
This guide demonstrates different ways to interact with audio files and audio content using the Gemini API.

Supported audio formats
Gemini supports the following audio format MIME types:

WAV - audio/wav
MP3 - audio/mp3
AIFF - audio/aiff
AAC - audio/aac
OGG Vorbis - audio/ogg
FLAC - audio/flac
Technical details about audio
Gemini imposes the following rules on audio:

Gemini represents each second of audio as 32 tokens; for example, one minute of audio is represented as 1,920 tokens.
Gemini can only infer responses to English-language speech.
Gemini can "understand" non-speech components, such as birdsong or sirens.
The maximum supported length of audio data in a single prompt is 9.5 hours. Gemini doesn't limit the number of audio files in a single prompt; however, the total combined length of all audio files in a single prompt cannot exceed 9.5 hours.
Gemini downsamples audio files to a 16 Kbps data resolution.
If the audio source contains multiple channels, Gemini combines those channels down to a single channel.
Before you begin: Set up your project and API key
Before calling the Gemini API, you need to set up your project and configure your API key.

 Expand to view how to set up your project and API key

Make an audio file available to Gemini
You can make an audio file available to Gemini in either of the following ways:

Upload the audio file prior to making the prompt request.
Provide the audio file as inline data to the prompt request.
Upload an audio file and generate content
You can use the File API to upload an audio file of any size. Always use the File API when the total request size (including the files, text prompt, system instructions, etc.) is larger than 20 MB.

Note: The File API lets you store up to 20 GB of files per project, with a per-file maximum size of 2 GB. Files are stored for 48 hours. They can be accessed in that period with your API key, but cannot be downloaded from the API. The File API is available at no cost in all regions where the Gemini API is available.
Call media.upload to upload a file using the File API. The following code uploads an audio file and then uses the file in a call to models.generateContent.


// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const myfile = await ai.files.upload({
  file: path.join(media, "sample.mp3"),
  config: { mimeType: "audio/mpeg" },
});
console.log("Uploaded file:", myfile);

const result = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: createUserContent([
    createPartFromUri(myfile.uri, myfile.mimeType),
    "Describe this audio clip",
  ]),
});
console.log("result.text=", result.text);

Get metadata for a file
You can verify the API successfully stored the uploaded file and get its metadata by calling files.get.


// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const myfile = await ai.files.upload({
  file: path.join(media, "poem.txt"),
});
const fileName = myfile.name;
console.log(fileName);

const fetchedFile = await ai.files.get({ name: fileName });
console.log(fetchedFile);

List uploaded files
You can upload multiple audio files (and other kinds of files). The following code generates a list of all the files uploaded:


// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
console.log("My files:");
// Using the pager style to list files
const pager = await ai.files.list({ config: { pageSize: 10 } });
let page = pager.page;
const names = [];
while (true) {
  for (const f of page) {
    console.log("  ", f.name);
    names.push(f.name);
  }
  if (!pager.hasNextPage()) break;
  page = await pager.nextPage();
}

Provide the audio file as inline data in the request
Instead of uploading an audio file, you can pass audio data in the same call that contains the prompt.

Then, pass that downloaded small audio file along with the prompt to Gemini:


import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });
const base64AudioFile = fs.readFileSync("path/to/small-sample.mp3", {
  encoding: "base64",
});

const contents = [
  { text: "Please summarize the audio." },
  {
    inlineData: {
      mimeType: "audio/mpeg",
      data: base64AudioFile,
    },
  },
];

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: contents,
});
console.log(response.text);
Note the following about providing audio as inline data:

The maximum request size is 20 MB, which includes text prompts, system instructions, and files provided inline. If your file's size will make the total request size exceed 20 MB, then use the File API to upload files for use in requests.
If you're using an audio sample multiple times, it is more efficient to use the File API.
More ways to work with audio
This section provides a few additional ways to get more from audio.

Get a transcript of the audio file
To get a transcript, just ask for it in the prompt. For example:


import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });
const myfile = await ai.files.upload({
  file: "path/to/sample.mp3",
  config: { mimeType: "audio/mpeg" },
});

const result = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: createUserContent([
    createPartFromUri(myfile.uri, myfile.mimeType),
    "Generate a transcript of the speech.",
  ]),
});
console.log("result.text=", result.text);
Refer to timestamps in the audio file
A prompt can specify timestamps of the form MM:SS to refer to particular sections in an audio file. For example, the following prompt requests a transcript that:

Starts at 2 minutes 30 seconds from the beginning of the file.
Ends at 3 minutes 29 seconds from the beginning of the file.

// Create a prompt containing timestamps.
const prompt = "Provide a transcript of the speech from 02:30 to 03:29."
Count tokens
Call the countTokens method to get a count of the number of tokens in the audio file. For example:


import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });
const myfile = await ai.files.upload({
  file: "path/to/sample.mp3",
  config: { mimeType: "audio/mpeg" },
});

const countTokensResponse = await ai.models.countTokens({
  model: "gemini-2.0-flash",
  contents: createUserContent([
    createPartFromUri(myfile.uri, myfile.mimeType),
  ]),
});
console.log(countTokensResponse.totalTokens);