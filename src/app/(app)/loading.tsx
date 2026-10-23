/** Shown inside the layout while a page is loading, so the app reacts straight away instead of showing a blank screen. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="sk sk-title" />
      <div className="sk sk-sub" />
      <div className="grid stats" style={{ marginTop: 24 }}>
        <div className="card"><div className="sk sk-line short" /><div className="sk sk-big" /></div>
        <div className="card"><div className="sk sk-line short" /><div className="sk sk-big" /></div>
        <div className="card"><div className="sk sk-line short" /><div className="sk sk-big" /></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="sk sk-row" />)}
      </div>
    </div>
  );
}
