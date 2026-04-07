import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 420 120" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="FinMin Logo"
    >
      <style>
        {`
          .logo-text { 
            font-family: 'Plus Jakarta Sans', sans-serif; 
            font-weight: 900; 
            font-size: 100px; 
            letter-spacing: -2px;
          }
        `}
      </style>
      
      {/* F - Medium Blue */}
      <text x="0" y="95" fill="#3b82f6" className="logo-text">F</text>
      
      {/* I - White */}
      <text x="65" y="95" fill="#ffffff" className="logo-text">I</text>
      
      {/* N - Deep Blue */}
      <text x="105" y="95" fill="#2563eb" className="logo-text">N</text>
      
      {/* M - Light Blue */}
      <text x="185" y="95" fill="#60a5fa" className="logo-text">M</text>
      
      {/* I - Deep Blue */}
      <text x="285" y="95" fill="#2563eb" className="logo-text">I</text>
      
      {/* N - White */}
      <text x="325" y="95" fill="#ffffff" className="logo-text">N</text>
    </svg>
  );
};

export default Logo;
