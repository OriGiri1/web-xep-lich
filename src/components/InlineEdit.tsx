import { useRef, useState } from 'react';

type Props = {
  value: string;
  onSave: (v: string) => void;
  label: string;
  className?: string;
  inputClassName?: string;
  startEditing?: boolean;
};

/** Text that turns into an input on click. Enter or blur saves, Escape cancels. */
export function InlineEdit({ value, onSave, label, className = '', inputClassName = '', startEditing = false }: Props) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);

  const commit = () => {
    const v = draft.trim();
    if (!cancelled.current && v && v !== value) onSave(v);
    cancelled.current = false;
    setEditing(false);
  };

  if (editing)
    return (
      <input
        autoFocus
        aria-label={label}
        value={draft}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        className={`min-w-0 rounded-md bg-white outline-none ring-2 ring-stone-900 ${inputClassName}`}
      />
    );

  return (
    <button
      type="button"
      title="Bấm để sửa tên"
      aria-label={`${label}: ${value}. Bấm để sửa`}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={`min-w-0 truncate rounded-md text-left transition-colors hover:bg-stone-900/5 ${className}`}
    >
      {value}
    </button>
  );
}
