import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const DropdownContext = createContext(null);

export function DropdownMenu({ children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const keyboard = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', keyboard);

    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', keyboard);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={rootRef} className="relative inline-block">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({ children, asChild = false, ...props }) {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenuTrigger must be inside DropdownMenu');

  const { open, setOpen } = context;

  const handleClick = (event) => {
    if (asChild && React.isValidElement(children)) {
      children.props.onClick?.(event);
    }
    props.onClick?.(event);
    if (!event.defaultPrevented) setOpen((value) => !value);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      onClick: handleClick,
    });
  }

  return (
    <button
      type="button"
      {...props}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  className = '',
  align = 'start',
  ...props
}) {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenuContent must be inside DropdownMenu');
  if (!context.open) return null;

  const alignment =
    align === 'end'
      ? 'right-0'
      : align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'left-0';

  return (
    <div
      {...props}
      role="menu"
      className={`absolute top-full ${alignment} z-50 mt-2 min-w-40 rounded-md border border-gray-200 bg-white p-1 text-gray-900 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  className = '',
  disabled = false,
  onSelect,
  onClick,
  ...props
}) {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenuItem must be inside DropdownMenu');

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      {...props}
      className={`flex w-full items-center rounded-sm px-3 py-2 text-left text-sm outline-none hover:bg-gray-100 focus:bg-gray-100 disabled:pointer-events-none disabled:opacity-50 ${className}`}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onSelect?.();
          context.setOpen(false);
        }
      }}
    >
      {children}
    </button>
  );
}

export function DropdownMenuLabel({ children, className = '', ...props }) {
  return (
    <div {...props} className={`px-3 py-2 text-sm font-semibold ${className}`}>
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className = '', ...props }) {
  return (
    <div
      {...props}
      role="separator"
      className={`-mx-1 my-1 h-px bg-gray-200 ${className}`}
    />
  );
}

export function DropdownMenuGroup({ children, ...props }) {
  return <div role="group" {...props}>{children}</div>;
}

export function DropdownMenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
  className = '',
  onClick,
  ...props
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={Boolean(checked)}
      {...props}
      className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-gray-100 ${className}`}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange?.(!checked);
      }}
    >
      <span className="w-4">{checked ? '✓' : ''}</span>
      {children}
    </button>
  );
}

export function DropdownMenuRadioGroup({ children, value, onValueChange, ...props }) {
  return (
    <div
      {...props}
      data-value={value}
      onChange={(event) => {
        props.onChange?.(event);
        onValueChange?.(event.target.value);
      }}
    >
      {children}
    </div>
  );
}

export function DropdownMenuRadioItem({
  children,
  value,
  className = '',
  onClick,
  ...props
}) {
  const context = useContext(DropdownContext);

  return (
    <button
      type="button"
      role="menuitemradio"
      data-value={value}
      {...props}
      className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-gray-100 ${className}`}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context?.setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

export function DropdownMenuShortcut({ children, className = '', ...props }) {
  return (
    <span {...props} className={`ml-auto text-xs tracking-widest text-gray-500 ${className}`}>
      {children}
    </span>
  );
}

export function DropdownMenuSub({ children, ...props }) {
  return <div {...props}>{children}</div>;
}

export function DropdownMenuSubTrigger({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`flex w-full items-center rounded-sm px-3 py-2 text-left text-sm hover:bg-gray-100 ${className}`}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSubContent({ children, className = '', ...props }) {
  return (
    <div
      {...props}
      role="menu"
      className={`absolute left-full top-0 z-50 min-w-40 rounded-md border bg-white p-1 text-gray-900 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}
