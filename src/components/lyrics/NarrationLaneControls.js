import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SERVER_URL } from '../../config';
import LiquidGlass from '../common/LiquidGlass';
import StandardSlider from '../common/StandardSlider';
import { arrangePlacement, placementToLyrics } from './narrationLaneActions';

const SPEED_MIN = 0.5;
const SPEED_MAX = 2;
const SPEED_STEP = 0.05;
const formatSpeed = (v) => `${Number(v).toFixed(2)}×`;

/**
 * Narration-lane controls overlaid on the timeline, in the SGT-style staging workflow:
 *   [ ✨ Smart arrange ]  [ speedometer + slider ]  [ ⤓ Pull subtitles ]  [ ↻ Reset ]
 *
 * Built from the shared design-system primitives: a LiquidGlass pill (like the zoom control),
 * Material Symbols icons, and the StandardSlider (like the volume pill).
 *
 * The lane is a staging track: Smart arrange + the speed slider + dragging edit the staged
 * placement (and globalSpeed) WITHOUT moving subtitles. "Pull subtitles to narration" commits the
 * staged layout to the subtitle timings (undoable via onApplyTimings) and fires the real
 * "Làm mới thuyết minh" narration refresh. The speed slider also atempo's the audio on release.
 *
 * globalSpeed + placementStarts are owned by the timeline (so the lane draw shares them).
 */
const NarrationLaneControls = ({
  narrationSegments,
  lyrics,
  onApplyTimings,
  globalSpeed = 1,
  setGlobalSpeed = () => {},
  placementStarts = null,
  setPlacementStarts = () => {},
}) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [isSpeedDragging, setIsSpeedDragging] = useState(false);
  // The slider's onDragEnd fires after the final onChange, when `globalSpeed` is still the stale
  // closure value — so commit the atempo from the latest value the slider reported, not the prop.
  const latestSpeedRef = useRef(globalSpeed);
  // Last "is anything staged?" value seen while NOT dragging — frozen during a drag (see render).
  const stagedRef = useRef(false);

  // Atempo every clip to the absolute factor (sourced from the immutable backup), then refresh.
  const applySpeedToAudio = useCallback(async (factor) => {
    const items = narrationSegments
      .filter((s) => s.filename)
      .map((s) => ({ filename: s.filename, normalizedStart: 0, normalizedEnd: 1, speedFactor: factor }));
    if (items.length === 0) return;
    setBusy(true);
    try {
      const resp = await fetch(`${SERVER_URL}/api/narration/batch-modify-audio-trim-speed-combined`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        while (true) { const { done } = await reader.read(); if (done) break; }
      }
      if (typeof window.resetAlignedNarration === 'function') window.resetAlignedNarration();
      window.dispatchEvent(new CustomEvent('narration-speed-modified', { detail: { source: 'timeline-speed', timestamp: Date.now() } }));
      // Regenerate the aligned narration so playback uses the new speed (same as the refresh button).
      window.dispatchEvent(new CustomEvent('request-narration-refresh', { detail: { source: 'timeline-speed', timestamp: Date.now() } }));
    } catch (e) {
      // non-fatal — leave the lane as-is on failure
    } finally {
      setBusy(false);
    }
  }, [narrationSegments]);

  // Live (per-tick) speed update while dragging — restages the lane length without touching audio.
  const handleSpeedChange = useCallback((value) => {
    latestSpeedRef.current = value;
    setGlobalSpeed(value);
  }, [setGlobalSpeed]);

  // On release, atempo the audio to the final value the slider reported.
  const handleSpeedCommit = useCallback(() => {
    setIsSpeedDragging(false);
    applySpeedToAudio(latestSpeedRef.current);
  }, [applySpeedToAudio]);

  // Smart arrange: stage a sequential, no-overlap placement (subtitles unchanged).
  const handleSmartArrange = useCallback(() => {
    if (!narrationSegments.length) return;
    setPlacementStarts(arrangePlacement(narrationSegments, globalSpeed));
  }, [narrationSegments, globalSpeed, setPlacementStarts]);

  // Pull subtitles to narration: commit the staged placement to subtitle timing + refresh.
  const handlePull = useCallback(() => {
    if (!narrationSegments.length || typeof onApplyTimings !== 'function') return;
    onApplyTimings(placementToLyrics(lyrics, narrationSegments, placementStarts, globalSpeed));
    setPlacementStarts(null); // subtitles now match the lane
    window.dispatchEvent(new CustomEvent('request-narration-refresh', { detail: { source: 'pull-subtitles', timestamp: Date.now() } }));
  }, [lyrics, narrationSegments, placementStarts, globalSpeed, onApplyTimings, setPlacementStarts]);

  const handleReset = useCallback(() => {
    latestSpeedRef.current = 1;
    setGlobalSpeed(1);
    setPlacementStarts(null);
    applySpeedToAudio(1);
  }, [setGlobalSpeed, setPlacementStarts, applySpeedToAudio]);

  if (!narrationSegments.length) return null;

  // Reset is shown only when there's something to undo (a staged placement or a non-natural speed).
  // But while the slider is being dragged, freeze its visibility at the pre-drag value so the
  // button doesn't pop in/out mid-drag (and reflow the toolbar) — it settles on release.
  const liveStaged = (placementStarts && Object.keys(placementStarts).length > 0) || Math.abs(globalSpeed - 1) > 0.01;
  if (!isSpeedDragging) stagedRef.current = liveStaged;
  const showReset = stagedRef.current;

  return (
    <LiquidGlass
      width="auto"
      height={30}
      position="absolute"
      bottom="6px"
      left="8px"
      borderRadius="15px"
      className="narration-lane-controls theme-primary content-center"
      zIndex={6}
      effectIntensity={0.8}
      effectRadius={0.4}
      effectWidth={0.25}
      effectHeight={0.15}
      animateOnHover={true}
      hoverScale={1.03}
      aria-label={t('timeline.narrationLane', 'Narration lane controls')}
      style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
    >
      <div className="narration-lane-controls-row">
        <button
          type="button"
          className="narration-lane-btn"
          onClick={handleSmartArrange}
          title={t('timeline.smartArrangeTip', 'Arrange the narration clips on the lane sequentially with no overlap (subtitles unchanged until you pull)')}
        >
          <span className="material-symbols-rounded" aria-hidden="true">auto_awesome</span>
          {t('timeline.smartArrange', 'Smart arrange')}
        </button>

        <span className="narration-lane-divider" aria-hidden="true" />

        <div className="narration-lane-speed" title={t('timeline.narrationSpeedTip', 'Globally speed the narration audio (applies on release; 1.00× = natural)')}>
          <span className="material-symbols-rounded" aria-hidden="true">speed</span>
          <StandardSlider
            className="narration-lane-speed-slider"
            value={globalSpeed}
            onChange={handleSpeedChange}
            onDragStart={() => setIsSpeedDragging(true)}
            onDragEnd={handleSpeedCommit}
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={SPEED_STEP}
            size="XSmall"
            width="compact"
            state={busy ? 'Disabled' : 'Enabled'}
            showValueIndicator={false}
            showValueBadge
            valueBadgeFormatter={formatSpeed}
            ariaLabel={t('timeline.narrationSpeed', 'Narration speed')}
          />
          <span className="narration-lane-speed__value">{busy ? '…' : formatSpeed(globalSpeed)}</span>
        </div>

        <span className="narration-lane-divider" aria-hidden="true" />

        <button
          type="button"
          className="narration-lane-btn"
          onClick={handlePull}
          disabled={busy}
          title={t('timeline.pullSubtitlesTip', 'Move the subtitle timings to match the narration lane, then refresh the narration')}
        >
          <span className="material-symbols-rounded" aria-hidden="true">download</span>
          {t('timeline.pullSubtitles', 'Pull subtitles')}
        </button>

        {showReset && (
          <button
            type="button"
            className="narration-lane-btn"
            onClick={handleReset}
            disabled={busy}
            title={t('timeline.resetLaneTip', 'Restore natural speed and clear the staged arrangement')}
          >
            <span className="material-symbols-rounded" aria-hidden="true">restart_alt</span>
            {t('timeline.resetLane', 'Reset')}
          </button>
        )}
      </div>
    </LiquidGlass>
  );
};

export default NarrationLaneControls;
