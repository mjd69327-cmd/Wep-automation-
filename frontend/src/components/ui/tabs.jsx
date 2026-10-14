import React from 'react';
export const Tabs = ({ children }) => <div>{children}</div>;
export const TabsList = ({ children }) => <div className="flex space-x-2 border-b mb-4">{children}</div>;
export const TabsTrigger = ({ children, onClick }) => <button onClick={onClick} className="px-4 py-2 font-medium">{children}</button>;
export const TabsContent = ({ children }) => <div>{children}</div>;
