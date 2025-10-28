import React from 'react';
import '../../styles/common/PulsingEffect.css';

const PulsingElement = ({ as = 'div', children, className = '', isPulsing = true, ...props }) => {
  const Component = as;
  return (
    <Component className={`${isPulsing ? 'pulsing-effect ' : ''}${className}`.trim()} {...props}>
      {children}
    </Component>
  );
};

export default PulsingElement;
