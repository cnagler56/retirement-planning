'use client';

import { useState } from 'react';
import { groupNumber, parseNumberInput } from '@/src/lib/format';

/**
 * A numeric `<input>` that shows thousands separators (e.g. "1,500,000") when
 * idle, but lets you type freely — digits and a decimal point — while focused, so
 * commas never fight the cursor. Reports a plain number to the parent via onChange.
 *
 * Renders only the input element (no label/prefix wrapper), so it drops into the
 * existing field components in place of their raw `type="number"` input.
 */
export default function NumericInput({
  value, onChange, min, max, step, placeholder, className, ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');

  // Formatted with commas when idle; the raw value the user is editing when focused.
  const display = focused ? text : groupNumber(value);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      onFocus={() => {
        setText(Number.isFinite(value) && value !== 0 ? String(value) : '');
        setFocused(true);
      }}
      onChange={(e) => {
        setText(e.target.value);
        let n = parseNumberInput(e.target.value);
        if (min != null && n < min) n = min;
        if (max != null && n > max) n = max;
        onChange(n);
      }}
      onBlur={() => setFocused(false)}
      data-step={step}
    />
  );
}
