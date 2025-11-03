import React from 'react';
import { useTranslation } from 'react-i18next';
import SliderWithValue from './common/SliderWithValue';
import CustomDropdown from './common/CustomDropdown';
import HelpIcon from './common/HelpIcon';

const ParakeetProcessingOptions = ({
    parakeetStrategy,
    setParakeetStrategy,
    maxDurationPerRequest,
    setMaxDurationPerRequest,
    parakeetMaxChars,
    setParakeetMaxChars,
    selectedSegment
}) => {
    const { t } = useTranslation();

    return (
        <>
            {/* Parakeet-only UI: dedicated layout */}
            <div className="option-group" style={{ gridColumn: '1 / -1' }}>
                <div className="combined-options-row">
                    <div className="combined-option-half">
                        <div className="label-with-help">
                            <label>{t('processing.parakeetSplittingMethod', 'Splitting method')}</label>
                            <HelpIcon title={t('processing.parakeetStrategyHelp', 'Choose how to split subtitles: by approximate character count or by full sentences.')} />
                        </div>
                        <CustomDropdown
                            value={parakeetStrategy}
                            onChange={(value) => setParakeetStrategy(value)}
                            options={[
                                { value: 'sentence', label: t('processing.parakeetStrategySentence', 'Split by sentence') },
                                { value: 'char', label: t('processing.parakeetStrategyChar', 'Split by approximate character count') }
                            ]}
                            placeholder={t('processing.selectStrategy', 'Select strategy')}
                        />
                    </div>
                    {parakeetStrategy === 'char' && (
                        <div className="combined-option-half">
                            <div className="label-with-help">
                                <label>{t('processing.parakeetMaxChars', 'Max characters per subtitle')}</label>
                                <HelpIcon title={t('processing.parakeetMaxCharsHelp', 'Only applies when splitting by approximate character count.')} />
                            </div>
                            <SliderWithValue
                                value={parakeetMaxChars}
                                onChange={(v) => setParakeetMaxChars(parseInt(v))}
                                min={5}
                                max={100}
                                step={1}
                                orientation="Horizontal"
                                size="XSmall"
                                state={'Enabled'}
                                id="parakeet-max-chars"
                                ariaLabel={t('processing.parakeetMaxChars', 'Max characters per subtitle')}
                                defaultValue={60}
                                showValueBadge={true}
                                valueBadgeFormatter={(v) => Math.round(Number(v))}
                                formatValue={(v) => `${v} ${t('processing.characters', 'characters')}`}
                            />
                        </div>
                    )}
                    {/* Parakeet: Max duration per request (sequential splitting) */}
                    <div className="combined-option-half">
                        <div className="label-with-help">
                            <label>{t('processing.maxDurationPerRequest', 'Max duration per request')}</label>
                            <HelpIcon title={t('processing.parakeetMaxDurationHelp', 'For Parakeet, long ranges are split client‑side and processed one by one (sequentially).')} />
                        </div>
                        <div>
                            <SliderWithValue
                                value={maxDurationPerRequest}
                                onChange={(v) => setMaxDurationPerRequest(parseInt(v))}
                                min={1}
                                max={10}
                                step={1}
                                orientation="Horizontal"
                                size="XSmall"
                                state={'Enabled'}
                                id="parakeet-max-duration-slider"
                                ariaLabel={t('processing.maxDurationPerRequest', 'Max duration per request')}
                                defaultValue={5}
                                formatValue={(v) => (
                                    <>
                                        {t('processing.minutesValue', '{{value}} minutes', { value: v })}
                                        {selectedSegment && (() => {
                                            const segmentDurationMin = (selectedSegment.end - selectedSegment.start) / 60;
                                            const numRequests = Math.ceil(segmentDurationMin / Number(v || 1));
                                            return numRequests > 1 ? (
                                                <span className="parallel-info">{' '}({t('processing.parallelRequestsInfo', 'Will split into {{count}} parts', { count: numRequests })})</span>
                                            ) : null;
                                        })()}
                                    </>
                                )}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ParakeetProcessingOptions;