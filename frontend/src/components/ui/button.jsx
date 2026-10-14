import React from 'react';

export const Button = ({ children, onClick, className = "", ...props }) => {
  return (
    <button onClick={onClick} className={`px-4 py-2 bg-purple-600 text-white rounded-lg ${className}`} {...props}>
      {children}
    </button>
  );
};
