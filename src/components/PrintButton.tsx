"use client";

export default function PrintButton() {
  return (
    <button className="btn small" onClick={() => window.print()}>
      Print
    </button>
  );
}
