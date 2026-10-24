"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

/** A password box with a Show / Hide button. Behaves like a normal input inside a form. */
export default function PasswordInput({
  id, name, required, minLength, autoComplete, placeholder,
}: {
  id: string; name: string; required?: boolean; minLength?: number; autoComplete?: string; placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="pw-field">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
      >
        <Icon name={visible ? "eye-off" : "eye"} />
      </button>
    </div>
  );
}
