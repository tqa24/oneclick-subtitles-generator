import { useState, useEffect } from 'react';
import '../styles/OnboardingBanner.css';
// Import the animation component from src/assets
import OnboardingAnimation from '../assets/onboarding-banner';

/**
 * Onboarding Banner component that shows for first-time visitors
 * Displays the onboarding banner immediately and allows dismissal after 4 seconds
 */
const OnboardingBanner = () => {
  // State for tracking if user can dismiss the banner
  const [canDismiss, setCanDismiss] = useState(false);

  // State for tracking if user has visited before
  const [hasVisited, setHasVisited] = useState(true);

  // State for countdown timer
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    // Check if user has visited before
    const hasVisitedBefore = localStorage.getItem('has_visited_site') === 'true';
    setHasVisited(hasVisitedBefore);

    // If this is the first visit, start the countdown
    if (!hasVisitedBefore) {
      // Set up countdown timer that updates every second
      const countdownInterval = setInterval(() => {
        setCountdown(prevCount => {
          // When countdown reaches 1, clear the interval and allow dismissal
          if (prevCount <= 1) {
            clearInterval(countdownInterval);
            setCanDismiss(true);
            return 0;
          }
          return prevCount - 1;
        });
      }, 1000);

      // Clean up interval on component unmount
      return () => clearInterval(countdownInterval);
    }
  }, []);

  const handleDismiss = () => {
    // Only allow dismissal if the timer has elapsed
    if (canDismiss) {
      // Mark that the user has visited the site
      localStorage.setItem('has_visited_site', 'true');
      // Update state to hide the banner
      setHasVisited(true);
    }
  };

  // Don't render anything if user has visited before
  if (hasVisited) {
    return null;
  }

  // Render the banner for first-time visitors
  return (
    <div
      className={`onboarding-overlay ${canDismiss ? 'can-dismiss' : 'wait-to-dismiss'}`}
      onClick={handleDismiss}
    >
      <div className="onboarding-banner-container">
        {/* Animation component */}
        <div className="svg-container">
          <OnboardingAnimation
            width="800px"
            height="800px"
            className="onboarding-banner"
          />
        </div>

        {/* Message that changes based on countdown state */}
        <div className="onboarding-message">
          {canDismiss ? (
            "Click anywhere to continue"
          ) : (
            <span>
              Please wait <span className="countdown">{countdown}</span>
              second{countdown !== 1 ? 's' : ''}...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingBanner;
