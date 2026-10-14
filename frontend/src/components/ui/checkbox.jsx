import React from 'react';

const Checkbox = React.forwardRef(function Checkbox(
  {
    className = '',
    checked,
    defaultChecked,
    onCheckedChange,
    onChange,
    disabled = false,
    ...props
  },
  ref
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked === undefined ? undefined : Boolean(checked)}
      defaultChecked={defaultChecked}
      disabled={disabled}
      className={`h-4 w-4 shrink-0 cursor-pointer rounded border border-gray-300 accent-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      onChange={(event) => {
        onChange?.(event);
        onCheckedChange?.(event.target.checked);
      }}
      {...props}
    />
  );
});

Checkbox.displayName = 'Checkbox';

export { Checkbox };
export default Checkbox;
