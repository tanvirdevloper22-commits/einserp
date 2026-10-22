import type { TemplateOption } from "@/lib/templates";

function Thumb({ kind, id }: { kind: "doc" | "id"; id: string }) {
  if (kind === "id") {
    return (
      <div className={`tp-thumb tp-id tp-id-${id}`} aria-hidden="true">
        <div className="tp-id-head"><i /><b /></div>
        <div className="tp-id-photo" />
        <div className="tp-id-name" />
        <div className="tp-id-lines"><i /><i /><i /></div>
        <div className="tp-id-foot" />
      </div>
    );
  }
  return (
    <div className={`tp-thumb tp-doc tp-doc-${id}`} aria-hidden="true">
      <div className="tp-doc-head"><i /><span><b /><b /></span></div>
      <div className="tp-doc-rows"><i /><i /><i /><i /></div>
      <div className="tp-doc-total" />
    </div>
  );
}

/** A row of selectable template cards. Plain radio inputs, so it works inside a normal server-action form. */
export default function TemplatePicker({
  name, options, value, kind,
}: { name: string; options: TemplateOption[]; value: string; kind: "doc" | "id" }) {
  return (
    <div className="tp-grid" role="radiogroup">
      {options.map((o) => (
        <label key={o.id} className="tp-card">
          <input type="radio" name={name} value={o.id} defaultChecked={o.id === value} />
          <div className="tp-body">
            <Thumb kind={kind} id={o.id} />
            <strong>{o.name}</strong>
            <span className="cell-sub">{o.description}</span>
          </div>
        </label>
      ))}
    </div>
  );
}
