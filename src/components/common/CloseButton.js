import React from 'react';
import { useTranslation } from 'react-i18next';
import './CloseButton.css';

/**
 * Reusable CloseButton component with consistent styling and behavior
 * @param {Object} props
 * @param {Function} props.onClick - Function to call when button is clicked
 * @param {string} props.className - Additional CSS classes to apply
 * @param {string} props.variant - Button variant: 'default', 'modal', 'tab', 'settings'
 * @param {string} props.size - Button size: 'small', 'medium', 'large'
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {string} props.ariaLabel - Custom aria-label (defaults to translated "Close")
 * @param {string} props.title - Custom title tooltip (defaults to translated "Close")
 * @param {Object} props.style - Inline styles to apply
 */
const CloseButton = ({
  onClick,
  className = '',
  variant = 'default',
  size = 'medium',
  disabled = false,
  ariaLabel,
  title,
  style = {},
  ...props
}) => {
  const { t } = useTranslation();

  const defaultAriaLabel = ariaLabel || t('common.close', 'Close');
  const defaultTitle = title || t('common.close', 'Close');

  const buttonClasses = [
    'close-button-component',
    `close-button-${variant}`,
    `close-button-${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={buttonClasses}
      onClick={onClick}
      disabled={disabled}
      aria-label={defaultAriaLabel}
      title={defaultTitle}
      style={style}
      {...props}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        height="24px" 
        viewBox="0 -960 960 960" 
        width="24px" 
        fill="currentColor"
      >
        <path d="M480-392 300-212q-18 18-44 18t-44-18q-18-18-18-44t18-44l180-180-180-180q-18-18-18-44t18-44q18-18 44-18t44 18l180 180 180-180q18-18 44-18t44 18q18 18 18 44t-18 44L568-480l180 180q18 18 18 44t-18 44q-18 18-44 18t-44-18L480-392Z"/>
      </svg>
    </button>
  );
};

export default CloseButton;
