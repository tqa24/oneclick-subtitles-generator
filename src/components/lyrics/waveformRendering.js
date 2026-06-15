// Canvas rendering for the volume visualizer. These helpers receive everything
// they need as params instead of closing over component state, so the
// component can wrap them in useCallback with the right dependency lists.

import { setupHighDPICanvas } from './waveformLOD';

// Render the waveform onto the given canvas.
// params: { waveformLOD, visibleTimeRange, duration, height, dbgWave }
export const renderWaveform = (canvas, containerWidth, { waveformLOD, visibleTimeRange, duration, height, dbgWave }) => {
    if (!waveformLOD || !visibleTimeRange || !duration) return;

    const ctx = setupHighDPICanvas(canvas, containerWidth, height);
    const { start: visibleStart, end: visibleEnd } = visibleTimeRange;

    // Calculate rendering parameters - using the working approach
    const visibleDuration = visibleEnd - visibleStart;
    const pixelsPerSecond = containerWidth / visibleDuration;
    const samplesPerSecond = waveformLOD.levels[0].length / duration;
    const samplesPerPixel = samplesPerSecond / pixelsPerSecond;

    // Get appropriate LOD level for current zoom
    const lodData = waveformLOD.getLODLevel(samplesPerPixel);
    const lodSamplesPerSecond = lodData.length / duration;

    // Calculate visible sample range in LOD data
    const startSample = Math.floor(visibleStart * lodSamplesPerSecond);
    const endSample = Math.ceil(visibleEnd * lodSamplesPerSecond);
    const samplesToDraw = endSample - startSample;

    dbgWave('[WAVEFORM] Rendering:', {
      duration: duration,
      totalDataLength: waveformLOD.levels[0].length,
      samplesPerSecond: samplesPerSecond,
      visibleStart: visibleStart,
      visibleEnd: visibleEnd,
      startSample: startSample,
      endSample: endSample,
      samplesToDraw: samplesToDraw,
      containerWidth: containerWidth
    });

    ctx.clearRect(0, 0, containerWidth, height);

    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const primaryColor = theme === 'dark' ? 'rgb(80, 200, 255)' : 'rgb(93, 95, 239)';
    const gradientColor = theme === 'dark' ? 'rgba(80, 200, 255, 0.3)' : 'rgba(93, 95, 239, 0.3)';

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, primaryColor);
    gradient.addColorStop(0.85, gradientColor);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;

    if (samplesToDraw <= 0) return;

    const pixelsPerSample = containerWidth / samplesToDraw;

    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let i = 0; i < samplesToDraw; i++) {
        const sampleIndex = startSample + i;
        if (sampleIndex >= lodData.length) break;

        const x = i * pixelsPerSample;
        const amplitude = lodData[sampleIndex] || 0;
        const barHeight = Math.max(amplitude * height * 0.9, 0.5); // Reduced minimum height
        const y = height - barHeight;

        ctx.lineTo(x, y);
    }

    ctx.lineTo(containerWidth, height);
    ctx.closePath();
    ctx.fill();

    dbgWave('[WAVEFORM] Rendered', samplesToDraw, 'samples, amplitude range:', {
      min: Math.min(...lodData.slice(startSample, endSample)),
      max: Math.max(...lodData.slice(startSample, endSample))
    });
};

// Decide whether/what to render and dispatch to renderWaveform.
// params: { canvasRef, containerRef, waveformLOD, visibleTimeRange, height,
//           lastRenderParamsRef, renderWaveform }
export const updateVisualization = ({
    canvasRef, containerRef, waveformLOD, visibleTimeRange, height,
    lastRenderParamsRef, renderWaveform,
}) => {
    if (!canvasRef.current || !containerRef.current || !waveformLOD) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const containerWidth = container.clientWidth;

    const renderParams = {
      width: containerWidth,
      height: height,
      start: visibleTimeRange.start,
      end: visibleTimeRange.end,
      theme: document.documentElement.getAttribute('data-theme') || 'light',
      dataLength: waveformLOD.levels[0].length
    };

    if (lastRenderParamsRef.current && JSON.stringify(lastRenderParamsRef.current) === JSON.stringify(renderParams)) {
      return;
    }

    lastRenderParamsRef.current = renderParams;

    if (containerWidth > 0) {
      renderWaveform(canvas, containerWidth);
    }
};
