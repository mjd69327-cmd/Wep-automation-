import React from 'react';
export const Badge = ({ children, className = "", ...props }) => (
  <span className={`px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full ${className}`} {...props}>{children}</span>
);
