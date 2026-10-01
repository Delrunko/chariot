import { useState } from "react";

export default function PasswordField({ className = "", ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`auth-password-field ${className}`.trim()}>
      <input {...inputProps} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="auth-password-toggle"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        onClick={() => setVisible((isVisible) => !isVisible)}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
            <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.4 9.5 7-.4 1-1.3 2.2-2.5 3.3M6.2 6.2C4.4 7.4 3.1 9.4 2.5 12c1 2.6 4.5 7 9.5 7 1 0 2-.2 2.9-.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
