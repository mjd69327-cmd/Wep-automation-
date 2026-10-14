import React from 'react';
export const Avatar = ({ children }) => <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">{children}</div>;
export const AvatarImage = ({ src }) => <img src={src} className="w-full h-full object-cover" alt="Avatar" />;
export const AvatarFallback = ({ children }) => <span>{children}</span>;
