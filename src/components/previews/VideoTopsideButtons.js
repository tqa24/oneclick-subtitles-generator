import React from "react";
import { useTranslation } from "react-i18next";
import LiquidGlass from "../common/LiquidGlass";
import LoadingIndicator from "../common/LoadingIndicator";
import { extractAndDownloadAudio } from "../../utils/fileUtils";
import { hydrateNarrationResultsForAlignment } from "../../utils/narrationAlignmentUtils";

const VideoTopsideButtons = ({
  showCustomControls,
  isFullscreen,
  controlsVisible,
  isVideoHovered,
  isRefreshingNarration,
  setIsRefreshingNarration,
  isAudioDownloading,
  setIsAudioDownloading,
  setError,
  videoRef,
  videoSource,
  fileType,
  useOptimizedPreview,
  optimizedVideoUrl,
  videoUrl,
}) => {
  const { t } = useTranslation();

  // Check if the current file is audio
  const isAudioFile = fileType && fileType.startsWith("audio/");

  return (
    <>
      {/* Top buttons container */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          right: "10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          zIndex: 10,
          pointerEvents: "none", // Allow clicks to pass through the container
        }}
      >
        {/* Left side buttons */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          {/* Refresh Narration button - only show when custom controls are available */}
          {showCustomControls && (
            <LiquidGlass
              width="auto"
              height={50}
              position="relative"
              borderRadius="25px"
              className="content-center interactive theme-primary video-control"
              cursor="pointer"
              effectIntensity={0.6}
              effectRadius={0.5}
              effectWidth={0.3}
              effectHeight={0.2}
              animateOnHover={true}
              hoverScale={1.05}
              updateOnMouseMove={false}
              style={{
                opacity: isFullscreen
                  ? controlsVisible
                    ? 1
                    : 0
                  : isVideoHovered || controlsVisible
                    ? 1
                    : 0,
                transition: "opacity 0.6s ease-in-out",
                pointerEvents: isFullscreen
                  ? controlsVisible
                    ? "auto"
                    : "none"
                  : isVideoHovered || controlsVisible
                    ? "auto"
                    : "none",
              }}
              aria-label={t("preview.refreshNarration", "Refresh Narration")}
              onClick={async () => {
                try {
                  // Pause the video if it's playing
                  const wasPlaying = !!(
                    videoRef.current && !videoRef.current.paused
                  );
                  if (wasPlaying) {
                    videoRef.current.pause();
                  }

                  // Set refreshing state
                  setIsRefreshingNarration(true);

                  // Get narration data from window objects (same as VideoRenderingSection.js)
                  const isUsingGroupedSubtitles =
                    window.useGroupedSubtitles || false;
                  const groupedNarrations = window.groupedNarrations || [];
                  const originalNarrations = window.originalNarrations || [];
                  const translatedNarrations =
                    window.translatedNarrations || [];

                  let generationResults = [];

                  // Use grouped narrations if available and enabled, otherwise use original/translated narrations
                  if (isUsingGroupedSubtitles && groupedNarrations.length > 0) {
                    generationResults = groupedNarrations;
                    console.log(
                      `Using grouped narrations for refresh. Found ${generationResults.length} grouped narrations.`,
                    );
                  } else if (translatedNarrations.length > 0) {
                    generationResults = translatedNarrations;
                    console.log(
                      `Using translated narrations for refresh. Found ${generationResults.length} narrations.`,
                    );
                  } else if (originalNarrations.length > 0) {
                    generationResults = originalNarrations;
                    console.log(
                      `Using original narrations for refresh. Found ${generationResults.length} narrations.`,
                    );
                  }

                  if (generationResults.length === 0) {
                    throw new Error(
                      t(
                        "errors.noNarrationResults",
                        "No narration results to generate aligned audio",
                      ),
                    );
                  }

                  // EXACT same subtitle timing lookup as VideoRenderingSection.js
                  // Get all subtitles from the window object, prioritizing grouped subtitles if using them
                  const allSubtitles =
                    isUsingGroupedSubtitles && window.groupedSubtitles
                      ? window.groupedSubtitles
                      : window.subtitlesData ||
                        window.originalSubtitles ||
                        window.subtitles ||
                        [];

                  // Also try translated subtitles if no other subtitles found
                  if (
                    allSubtitles.length === 0 &&
                    window.translatedSubtitles &&
                    Array.isArray(window.translatedSubtitles)
                  ) {
                    allSubtitles.push(...window.translatedSubtitles);
                  }

                  // Create a map for faster lookup
                  const subtitleMap = {};
                  allSubtitles.forEach((sub) => {
                    if (sub.id !== undefined) {
                      subtitleMap[sub.id] = sub;
                    }
                  });

                  // EXACT same data preparation as downloadAlignedAudio in useNarrationHandlers.js
                  const narrationData = hydrateNarrationResultsForAlignment(
                    generationResults,
                  )
                    .filter((result) => result.success && result.filename)
                    .map((result) => {
                      // Get the correct subtitle ID from the result
                      const subtitleId = result.subtitle_id;
                      const isGrouped =
                        result.original_ids && result.original_ids.length > 1;

                      // Find the corresponding subtitle for timing information
                      let subtitle = subtitleMap[subtitleId];

                      // If this is a grouped subtitle and we couldn't find it directly in the map,
                      // we might need to calculate its timing from the original subtitles
                      if (!subtitle && isGrouped && result.original_ids) {
                        console.log(
                          `Handling grouped subtitle ${subtitleId} with ${result.original_ids.length} original IDs`,
                        );

                        // Get all the original subtitles that are part of this group
                        const originalSubtitles = result.original_ids
                          .map((id) => subtitleMap[id])
                          .filter(Boolean);

                        if (originalSubtitles.length > 0) {
                          // Calculate start and end times from the original subtitles
                          const start = Math.min(
                            ...originalSubtitles.map((sub) => sub.start),
                          );
                          const end = Math.max(
                            ...originalSubtitles.map((sub) => sub.end),
                          );

                          // Create a synthetic subtitle with the calculated timing
                          subtitle = {
                            id: subtitleId,
                            start,
                            end,
                            text: result.text,
                          };

                          console.log(
                            `Created synthetic timing for grouped subtitle ${subtitleId}: start=${start}, end=${end}`,
                          );
                        }
                      }

                      // If we found a matching subtitle or created synthetic timing, use it
                      if (
                        subtitle &&
                        typeof subtitle.start === "number" &&
                        typeof subtitle.end === "number"
                      ) {
                        return {
                          filename: result.filename,
                          subtitle_id: result.subtitle_id,
                          start: subtitle.start,
                          end: subtitle.end,
                          text: subtitle.text || result.text || "",
                          // Preserve original_ids if they exist
                          original_ids: result.original_ids || [subtitleId],
                        };
                      }

                      // Otherwise, use existing timing or defaults
                      return {
                        filename: result.filename,
                        subtitle_id: result.subtitle_id,
                        start: result.start || 0,
                        end:
                          result.end || (result.start ? result.start + 5 : 5),
                        text: result.text || "",
                        // Preserve original_ids if they exist
                        original_ids: result.original_ids || [subtitleId],
                      };
                    });

                  // Sort by start time to ensure correct order
                  narrationData.sort((a, b) => a.start - b.start);

                  if (narrationData.length === 0) {
                    throw new Error(
                      t(
                        "errors.noNarrationResults",
                        "No narration results to generate aligned audio",
                      ),
                    );
                  }

                  const { prepareAlignedNarrationPreview } =
                    await import("../../services/alignedNarrationService.js");

                  await prepareAlignedNarrationPreview(narrationData);

                  console.log("🎵 Aligned narration preview prepared");
                  console.log(
                    "💾 Updated alignedNarrationCache:",
                    window.alignedNarrationCache,
                  );

                  window.isAlignedNarrationAvailable = true;
                  console.log("✅ Set isAlignedNarrationAvailable to true");

                  window.dispatchEvent(
                    new CustomEvent("aligned-narration-ready", {
                      detail: {
                        mode: "timeline",
                        timestamp: Date.now(),
                      },
                    }),
                  );

                  window.dispatchEvent(
                    new CustomEvent("aligned-narration-status", {
                      detail: {
                        status: "complete",
                        message: "Aligned narration generation complete",
                        isStillGenerating: false,
                        available: true,
                        mode: "timeline",
                        timestamp: Date.now(),
                      },
                    }),
                  );

                  if (wasPlaying && videoRef.current) {
                    videoRef.current.play().catch((error) => {
                      console.warn(
                        "Unable to resume video playback after aligned narration refresh:",
                        error,
                      );
                    });
                  }

                  console.log("✅ Aligned narration preview ready");
                } catch (error) {
                  console.error(
                    "Error during aligned narration regeneration:",
                    error,
                  );

                  // Dispatch aligned-narration-status event for auto-dismissing toast
                  window.dispatchEvent(
                    new CustomEvent("aligned-narration-status", {
                      detail: {
                        status: "error",
                        message: error.message || "Failed to refresh narration",
                        isStillGenerating: false,
                      },
                    }),
                  );
                } finally {
                  // Clear refreshing state
                  setIsRefreshingNarration(false);
                }
              }}
              disabled={isRefreshingNarration}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  width: "100%",
                  height: "100%",
                  padding: "0 16px",
                  opacity: isRefreshingNarration ? 0.7 : 1,
                  cursor: isRefreshingNarration ? "not-allowed" : "pointer",
                }}
              >
                {isRefreshingNarration ? (
                  // Show loading spinner when refreshing
                  <>
                    <LoadingIndicator
                      theme="light"
                      showContainer={false}
                      size={22}
                      className="narration-refresh-loading"
                      style={{
                        filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))",
                      }}
                    />
                    <span
                      style={{
                        color: "white",
                        fontSize: "13px",
                        fontWeight: "600",
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                      }}
                    >
                      {t("preview.refreshingNarration", "Refreshing...")}
                    </span>
                  </>
                ) : (
                  // Show refresh icon when not refreshing
                  <>
                    <span
                      className="material-symbols-rounded"
                      style={{
                        color: "white",
                        fontSize: 22,
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                        display: "inline-block",
                      }}
                    >
                      refresh
                    </span>
                    <span
                      style={{
                        color: "white",
                        fontSize: "13px",
                        fontWeight: "600",
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                      }}
                    >
                      {t("preview.refreshNarration", "Refresh Narration")}
                    </span>
                  </>
                )}
              </div>
            </LiquidGlass>
          )}

          {/* Gemini FPS Info button - only show when custom controls are available and optimization is enabled */}
          {showCustomControls &&
            localStorage.getItem("optimize_videos") === "true" && (
              <LiquidGlass
                width="auto"
                height={50}
                position="relative"
                borderRadius="25px"
                className="content-center interactive theme-warning shape-circle video-control"
                cursor="pointer"
                effectIntensity={0.7}
                effectRadius={0.6}
                effectWidth={0.4}
                effectHeight={0.4}
                animateOnHover={true}
                hoverScale={1.1}
                updateOnMouseMove={true}
                aria-label="Gemini FPS Info"
                style={{
                  opacity: isFullscreen
                    ? controlsVisible
                      ? 1
                      : 0
                    : isVideoHovered || controlsVisible
                      ? 1
                      : 0,
                  transition: "opacity 0.6s ease-in-out",
                  pointerEvents: isFullscreen
                    ? controlsVisible
                      ? "auto"
                      : "none"
                    : isVideoHovered || controlsVisible
                      ? "auto"
                      : "none",
                }}
                onClick={() => {
                  window.open(
                    "https://ai.google.dev/gemini-api/docs/video-understanding",
                    "_blank",
                  );
                }}
              >
                <div
                  title="Gemini chỉ xử lý 1FPS dù gửi video có FPS cao, bấm nút để xem thêm, vui lòng chọn Render Video để có chất lượng + FPS tốt nhất"
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: "0 12px",
                    minWidth: "fit-content",
                  }}
                >
                  <span
                    className="material-symbols-rounded"
                    style={{
                      color: "white",
                      fontSize: 24,
                      textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                      display: "inline-block",
                    }}
                  >
                    info
                  </span>
                </div>
              </LiquidGlass>
            )}
        </div>

        {/* Right side buttons */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          {/* Extract frame button - only show when custom controls are available and not audio file */}
          {showCustomControls && !isAudioFile && (
            <LiquidGlass
              width="auto"
              height={50}
              position="relative"
              borderRadius="25px"
              className="content-center interactive theme-info video-control"
              cursor="pointer"
              effectIntensity={0.6}
              effectRadius={0.5}
              effectWidth={0.3}
              effectHeight={0.2}
              animateOnHover={true}
              hoverScale={1.05}
              updateOnMouseMove={false}
              style={{
                opacity: isFullscreen
                  ? controlsVisible
                    ? 1
                    : 0
                  : isVideoHovered || controlsVisible
                    ? 1
                    : 0,
                transition: "opacity 0.6s ease-in-out",
                pointerEvents: isFullscreen
                  ? controlsVisible
                    ? "auto"
                    : "none"
                  : isVideoHovered || controlsVisible
                    ? "auto"
                    : "none",
              }}
              aria-label={t("preview.extractFrame", "Extract Frame")}
              onClick={async () => {
                try {
                  const videoElement = document.querySelector(
                    ".native-video-container video",
                  );
                  if (!videoElement) {
                    console.error("Video element not found");
                    return;
                  }

                  // Create canvas to capture current frame
                  const canvas = document.createElement("canvas");
                  const ctx = canvas.getContext("2d");

                  // Set canvas dimensions to match video
                  canvas.width = videoElement.videoWidth;
                  canvas.height = videoElement.videoHeight;

                  // Draw current video frame to canvas
                  ctx.drawImage(
                    videoElement,
                    0,
                    0,
                    canvas.width,
                    canvas.height,
                  );

                  // Convert canvas to blob
                  canvas.toBlob((blob) => {
                    if (blob) {
                      // Create download link
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;

                      // Generate filename with timestamp
                      const currentTime = Math.floor(videoElement.currentTime);
                      const minutes = Math.floor(currentTime / 60);
                      const seconds = currentTime % 60;
                      const timestamp = `${minutes}m${seconds}s`;

                      link.download = `frame_${timestamp}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);

                      console.log("Frame extracted successfully");
                    } else {
                      console.error("Failed to create blob from canvas");
                    }
                  }, "image/png");
                } catch (error) {
                  console.error("Error extracting frame:", error);
                }
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "0 16px",
                  minWidth: "fit-content",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  className="material-symbols-rounded"
                  style={{
                    color: "white",
                    fontSize: 20,
                    textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                    display: "inline-block",
                  }}
                >
                  image
                </span>
                <span
                  style={{
                    color: "white",
                    fontSize: "13px",
                    fontWeight: "600",
                    textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                  }}
                >
                  {t("preview.extractFrame", "Extract Frame")}
                </span>
              </div>
            </LiquidGlass>
          )}

          {/* Download audio button - only show when custom controls are available and not audio file */}
          {showCustomControls && !isAudioFile && (
            <LiquidGlass
              width="auto"
              height={50}
              position="relative"
              borderRadius="25px"
              className={`content-center interactive ${isAudioDownloading ? "theme-secondary" : "theme-success"} video-control`}
              cursor={isAudioDownloading ? "not-allowed" : "pointer"}
              effectIntensity={isAudioDownloading ? 0.3 : 0.6}
              effectRadius={0.5}
              effectWidth={0.3}
              effectHeight={0.2}
              animateOnHover={!isAudioDownloading}
              hoverScale={1.05}
              updateOnMouseMove={false}
              aria-label={t("preview.downloadAudio", "Download Audio")}
              style={{
                opacity: isFullscreen
                  ? controlsVisible
                    ? 1
                    : 0
                  : isVideoHovered || controlsVisible
                    ? 1
                    : 0,
                transition: "opacity 0.6s ease-in-out",
                pointerEvents: isFullscreen
                  ? controlsVisible
                    ? "auto"
                    : "none"
                  : isVideoHovered || controlsVisible
                    ? "auto"
                    : "none",
              }}
              onClick={async () => {
                if (isAudioDownloading) return; // Prevent multiple clicks

                // Get video title or use default
                const videoTitle = videoSource?.title || "audio";
                // Use the current video URL (optimized or original)
                const currentVideoUrl =
                  useOptimizedPreview && optimizedVideoUrl
                    ? optimizedVideoUrl
                    : videoUrl;

                // Show loading state
                setIsAudioDownloading(true);

                // Extract and download audio - our utility function now handles blob URLs properly
                const success = await extractAndDownloadAudio(
                  currentVideoUrl,
                  videoTitle,
                );

                // Reset loading state
                setIsAudioDownloading(false);

                // Show error if failed
                if (!success) {
                  // Dispatch aligned-narration-status event for auto-dismissing toast
                  window.dispatchEvent(
                    new CustomEvent("aligned-narration-status", {
                      detail: {
                        status: "error",
                        message: t(
                          "preview.audioExtractionError",
                          "Failed to extract audio from video. Please try again.",
                        ),
                        isStillGenerating: false,
                      },
                    }),
                  );
                }
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  width: "100%",
                  height: "100%",
                  opacity: isAudioDownloading ? 0.7 : 1,
                  cursor: isAudioDownloading ? "not-allowed" : "pointer",
                  padding: "0 16px",
                  minWidth: "fit-content",
                  whiteSpace: "nowrap",
                }}
              >
                {isAudioDownloading ? (
                  // Material Design loading spinner
                  <>
                    <LoadingIndicator
                      theme="light"
                      showContainer={false}
                      size={20}
                      className="audio-download-loading"
                      style={{
                        filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))",
                      }}
                    />
                    <span
                      style={{
                        color: "white",
                        fontSize: "13px",
                        fontWeight: "600",
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                      }}
                    >
                      {t("preview.downloadingAudio", "Downloading...")}
                    </span>
                  </>
                ) : (
                  // Material Design download icon
                  <>
                    <span
                      className="material-symbols-rounded"
                      style={{
                        color: "white",
                        fontSize: 20,
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                        display: "inline-block",
                      }}
                    >
                      download
                    </span>
                    <span
                      style={{
                        color: "white",
                        fontSize: "13px",
                        fontWeight: "600",
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                      }}
                    >
                      {t("preview.downloadAudio", "Download Audio")}
                    </span>
                  </>
                )}
              </div>
            </LiquidGlass>
          )}
        </div>
      </div>
    </>
  );
};

export default VideoTopsideButtons;
