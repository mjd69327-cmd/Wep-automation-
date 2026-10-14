import React from 'react';
export const Dialog = ({ open, onOpenChange, children }) => open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">{children}</div> : null;
export const DialogTrigger = ({ children }) => children;
export const DialogContent = ({ children, className = "" }) => <div className={`bg-white rounded-lg p-6 max-w-lg w-full ${className}`}>{children}</div>;
export const DialogHeader = ({ children }) => <div className="mb-4">{children}</div>;
export const DialogTitle = ({ children }) => <h2 className="text-lg font-bold">{children}</h2>;
export const DialogDescription = ({ children, className = "" }) => <p className={`text-sm text-gray-500 ${className}`}>{children}</p>;
export const DialogFooter = ({ children }) => <div className="mt-4 flex justify-end space-x-2">{children}</div>;
