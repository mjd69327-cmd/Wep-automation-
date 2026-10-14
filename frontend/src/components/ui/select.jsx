import React from 'react';
export const Select = ({ children }) => <div className="relative">{children}</div>;
export const SelectTrigger = ({ children }) => <div className="border px-3 py-2 rounded-lg cursor-pointer">{children}</div>;
export const SelectValue = ({ placeholder }) => <span>{placeholder}</span>;
export const SelectContent = ({ children }) => <div className="absolute bg-white border mt-1 rounded-lg w-full shadow-lg">{children}</div>;
export const SelectItem = ({ children }) => <div className="p-2 hover:bg-gray-100 cursor-pointer">{children}</div>;
