"use client";

/** A submit button that asks "are you sure?" first. Cancelling the prompt stops the form from being sent. */
export default function ConfirmButton({
  message, className, children, disabled,
}: { message: string; className?: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      className={className}
      disabled={disabled}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
