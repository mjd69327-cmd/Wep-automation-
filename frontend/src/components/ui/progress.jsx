import React from 'react';
export const Progress = ({ value = 0, className = "" }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2.5 overflow-hidden ${className}`}>
    <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${value}%` }}></div>
  </div>
);
