import React from 'react';

export const Input = ({ className = "", ...props }) => {
  return (
    <input className={`px-3 py-2 border rounded-lg w-full ${className}`} {...props} />
  );
};
