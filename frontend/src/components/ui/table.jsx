import React from 'react';
export const Table = ({ children }) => <table className="w-full border-collapse">{children}</table>;
export const TableHeader = ({ children }) => <thead className="bg-gray-50">{children}</thead>;
export const TableBody = ({ children }) => <tbody>{children}</tbody>;
export const TableRow = ({ children }) => <tr className="border-b">{children}</tr>;
export const TableHead = ({ children }) => <th className="p-3 text-left font-semibold">{children}</th>;
export const TableCell = ({ children }) => <td className="p-3">{children}</td>;
