import { useState, useEffect } from 'react';

export default function ParamGroup({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-app-border rounded-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-app-card hover:bg-[#222] transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="section-label">{title}</span>
        <svg
          className={`w-4 h-4 text-stone transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="square" strokeLinejoin="miter" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="px-4 py-4 bg-app-panel space-y-3 border-t border-app-border">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

export function Field({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <label className="block text-[12px] font-bold text-stone uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-ash">{hint}</p>}
    </div>
  );
}

export function NumberInput({ value, onChange, min, max, step = 1 }) {
  // Local draft state allows mid-edit values (e.g., "-", "0.", "") without
  // dropping edits or snapping to old value when the field is temporarily empty.
  const [draft, setDraft] = useState(String(value));

  // Sync draft when external value changes (e.g., reset or programmatic update)
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const v = parseFloat(draft);
    if (Number.isFinite(v)) {
      onChange(v);
      setDraft(String(v));
    } else {
      // Revert to last valid value
      setDraft(String(value));
    }
  };

  return (
    <input
      type="number"
      className="form-input"
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }}
    />
  );
}

export function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      className="form-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Toggle({ value, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      {/* Hidden real checkbox — handles click, keyboard, and accessibility */}
      <input
        type="checkbox"
        className="sr-only"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {/* Visual track — no onClick needed, label drives the input */}
      <div
        className={`relative w-9 h-5 rounded-sm transition-colors duration-150 ${
          value ? 'bg-primary' : 'bg-[#2a2a2a]'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-sm shadow transition-transform duration-150 ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </div>
      <span className="text-[13px] text-on-dark-mute group-hover:text-on-dark transition-colors">
        {label}
      </span>
    </label>
  );
}

export function ColorInput({ value, onChange }) {
  // Draft state: text field allows partial edits ("#f", "#ab1")
  // without firing onChange until a complete 7-char hex is entered.
  const [draft, setDraft] = useState(value);

  // Sync draft when external value changes (e.g., reset or color picker)
  useEffect(() => { setDraft(value); }, [value]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => { onChange(e.target.value); setDraft(e.target.value); }}
        className="w-9 h-9 rounded-sm border border-app-border cursor-pointer bg-transparent p-0.5"
      />
      <input
        type="text"
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
            setDraft(v);
            // Only propagate when fully specified (#rrggbb)
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
          }
        }}
        onBlur={() => {
          // Revert partial input to last valid value on blur
          if (!/^#[0-9a-fA-F]{6}$/.test(draft)) setDraft(value);
        }}
        className="form-input flex-1 font-mono uppercase"
        maxLength={7}
      />
    </div>
  );
}

export function SelectInput({ value, onChange, options }) {
  return (
    <select
      className="form-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
