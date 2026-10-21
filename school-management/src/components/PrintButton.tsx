"use client";

import Icon from "@/components/Icon";

export default function PrintButton() {
  return (
    <button className="btn small" onClick={() => window.print()}>
      <Icon name="print" />
      Print
    </button>
  );
}
