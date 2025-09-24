import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/VideoCropControls.css';

const VideoTransformControls = ({
  isEnabled = false,
  onToggle,
  transformSettings,
  onChange,
  onApply,
  onCancel,
  onClear,
  videoDimensions,
  hasAppliedTransform = false,
}) => {
  const { t } = useTranslation();
  const temp = transformSettings || { rotation: 0, flipH: false, flipV: false };

  const rotateLeft = () => onChange({ ...temp, rotation: (((temp.rotation ?? 0) - 90) % 360 + 360) % 360 });
  const rotateRight = () => onChange({ ...temp, rotation: (((temp.rotation ?? 0) + 90) % 360 + 360) % 360 });
  const toggleFlipH = () => onChange({ ...temp, flipH: !temp.flipH });
  const toggleFlipV = () => onChange({ ...temp, flipV: !temp.flipV });

  return (
    <>
      {/* Top-right toggle & clear */}
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 8, zIndex: 22 }}>
        <button
          className={`crop-toggle-btn ${isEnabled ? 'editing' : hasAppliedTransform ? 'active' : ''}`}
          onClick={onToggle}
          title={hasAppliedTransform ? t('videoRendering.editTransform', 'Edit transforms') : t('videoRendering.toggleTransform', 'Add transforms')}
        >
          <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M480-886q80 0 150 30t122 82q52 52 82 122t30 150h-92q0-117-87-204t-205-87q-117 0-204 87T189-502h116l-160 160-160-160h116q0-80 30-150t82-122q52-52 122-82t150-30Zm291 264 160 160H815q0 80-30 150t-82 122q-52 52-122 82t-150 30q-80 0-150-30t-122-82q-52-52-82-122t-30-150h92q0 117 87 204t205 87q117 0 204-87t87-204H771l160-160Z"/>
          </svg>
          {isEnabled ? t('videoRendering.editTransform', 'Edit transforms') : hasAppliedTransform ? t('videoRendering.editTransform', 'Edit transforms') : t('videoRendering.toggleTransform', 'Add transforms')}
        </button>
        {hasAppliedTransform && !isEnabled && (
          <button className="crop-clear-btn" onClick={onClear} title={t('videoRendering.clearTransform', 'Clear transforms')}>
            <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M480-390 334-244q-20 20-45 19.5T245-245q-20-20-20-45t20-45l145-145-146-147q-20-20-19.5-45t20.5-45q19-20 44.5-20t45.5 20l145 146 146-146q20-20 45.5-20t44.5 20q20 20 20 45t-20 45L570-480l146 146q20 20 20 44.5T716-245q-19 20-44.5 20T626-245L480-390Z"/></svg>
            {t('videoRendering.clearTransform', 'Clear transforms')}
          </button>
        )}
      </div>

      {/* Center-top transform controls, only when editing */}
      {isEnabled && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 22 }}>
          <button className="transform-btn" onClick={rotateLeft} title={t('videoRendering.rotateLeft', 'Rotate left 90°')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M156-465q-36 0-57-25.5T88-546q6-17 13.5-33.5T117-613q16-29 47.5-32t57.5 21q16 15 19.5 38.5T235-541q-3 6-5.5 11.5T225-517q-8 22-28 37t-41 15Zm282 361q0 35-25 56t-56 11q-18-5-35-13t-33-16q-29-15-32-47t23-57q15-16 38.5-19t45.5 7q5 4 10 6t11 3q23 9 38 28.5t15 40.5ZM221-227q-25 25-57 21.5T117-238q-8-15-15-32t-12-35q-11-31 10-55.5t56-24.5q23 0 42 15t27 37q2 6 3.5 11t4.5 9q10 22 6.5 46.5T221-227ZM599-40q-31 10-56-9.5T518-104q0-23 14.5-42t37.5-28q80-29 129-97.5T748-425q0-104-68-180.5T508-694h1q10 17 8.5 40T496-612q-19 20-47 20t-48-20L297-716q-10-10-15-22t-5-25q0-13 5-25.5t15-22.5l104-104q20-20 47.5-20t47.5 20q20 19 20.5 42.5T506-830q160 9 269 125t109 280q0 134-79 239T599-40Z" />
            </svg>
          </button>
          <button className="transform-btn" onClick={rotateRight} title={t('videoRendering.rotateRight', 'Rotate right 90°')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M804-465q-21 0-41-15t-28-37q-2-7-4.5-12.5T725-541q-10-21-6.5-44.5T738-624q26-24 57.5-21t47.5 32q8 17 15.5 33.5T872-546q10 30-11 55.5T804-465ZM522-104q0-21 15-40.5t38-28.5q6-1 11-3t10-6q22-10 45.5-7t38.5 19q26 25 23 57t-32 47q-16 8-33 16t-35 13q-31 10-56-11t-25-56Zm217-123q-15-15-18.5-39.5T727-313q3-4 4.5-9t3.5-11q8-22 27-37t42-15q35 0 56 24.5t10 55.5q-5 18-12 35t-15 32q-15 29-47 32.5T739-227ZM361-40Q234-81 155-186T76-425q0-164 109-280t269-125q-11-19-10.5-42.5T464-915q20-20 47.5-20t47.5 20l104 104q10 10 15 22.5t5 25.5q0 13-5 25t-15 22L559-612q-20 20-48 20t-47-20q-20-19-21.5-42t8.5-40h1q-104 12-172 88.5T212-425q0 85 49 153.5T390-174q23 9 37.5 28t14.5 42q0 35-25 54.5T361-40Z" />
            </svg>
          </button>
          <button className={`transform-btn ${temp.flipH ? 'active' : ''}`} onClick={toggleFlipH} title={t('videoRendering.flipHorizontal', 'Flip horizontal')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M210-114q-57.12 0-96.56-39.44Q74-192.88 74-250v-460q0-57.13 39.44-96.56Q152.88-846 210-846h54q27.6 0 47.8 19.5 20.2 19.5 20.2 48T311.8-730q-20.2 20-47.8 20h-54v460h54q27.6 0 47.8 20.2Q332-209.6 332-182q0 29-20.2 48.5T264-114h-54Zm202 12v-756q0-29 20.2-48.5T480-926q27.6 0 47.8 19.5Q548-887 548-858v12h202q57.13 0 96.56 39.44Q886-767.13 886-710v460q0 57.12-39.44 96.56Q807.13-114 750-114H548v12q0 29-20.2 48.5T480-34q-27.6 0-47.8-19.5Q412-73 412-102ZM210-250v-460 460Z" />
            </svg>
          </button>
          <button className={`transform-btn ${temp.flipV ? 'active' : ''}`} onClick={toggleFlipV} title={t('videoRendering.flipVertical', 'Flip vertical')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M182-628q-29 0-48.5-20.2T114-696v-54q0-57.13 39.44-96.56Q192.88-886 250-886h460q57.13 0 96.56 39.44Q846-807.13 846-750v54q0 27.6-19.5 47.8-19.5 20.2-48 20.2T730-648.2q-20-20.2-20-47.8v-54H250v54q0 27.6-20.2 47.8Q209.6-628 182-628Zm68 554q-57.12 0-96.56-39.44Q114-152.88 114-210v-202h-12q-29 0-48.5-20.2T34-480q0-27.6 19.5-47.8Q73-548 102-548h756q29 0 48.5 20.2T926-480q0 27.6-19.5 47.8Q887-412 858-412h-12v202q0 57.12-39.44 96.56Q767.13-74 710-74H250Zm0-676h460-460Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Bottom apply/cancel buttons when editing */}
      {isEnabled && (
        <div className="crop-action-buttons" style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12, zIndex: 22 }}>
          <button className="crop-action-btn cancel" onClick={onCancel}>
            <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M480-390 334-244q-20 20-45 19.5T245-245q-20-20-20-45t20-45l145-145-146-147q-20-20-19.5-45t20.5-45q19-20 44.5-20t45.5 20l145 146 146-146q20-20 45.5-20t44.5 20q20 20 20 45t-20 45L570-480l146 146q20 20 20 44.5T716-245q-19 20-44.5 20T626-245L480-390Z"/></svg>
            {t('videoRendering.cancel', 'Cancel')}
          </button>
          <button className="crop-action-btn apply" onClick={onApply}>
            <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="m389-408 281-281q19-19 46-19t46 18.79q19 18.79 19 45.58t-18.61 45.4L435-272q-18.73 19-45.36 19Q363-253 344-272L200-415q-19-19.73-19.5-45.87Q180-487 198.79-506q19.79-20 46.17-20 26.37 0 45.04 20l99 98Z"/></svg>
            {t('videoRendering.apply', 'Apply')}
          </button>
        </div>
      )}
    </>
  );
};

export default VideoTransformControls;

