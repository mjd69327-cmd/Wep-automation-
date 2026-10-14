import React from 'react';

const Switch = React.forwardRef(
  ({ checked, defaultChecked = false, onCheckedChange, disabled = false, className = '', ...props }, ref) => {
    const isControlled = checked !== undefined;
    const [internal, setInternal] = React.useState(Boolean(defaultChecked));
    const value = isControlled ? Boolean(checked) : internal;

    const toggle = () => {
      if (disabled) return;
      const next = !value;
      if (!isControlled) setInternal(next);
      onCheckedChange?.(next);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 ${value ? 'bg-purple-600' : 'bg-gray-300'} ${className}`}
        {...props}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    );
  },
);

Switch.displayName = 'Switch';

export { Switch };
export default Switch;
