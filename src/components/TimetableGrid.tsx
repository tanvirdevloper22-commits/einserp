import { DAYS, fmtTime } from "@/lib/timetable";

export type GridPeriod = { period_no: number; start_time: string; end_time: string; is_break: boolean; label: string | null };
export type GridCell = { subject: string; teacher?: string; className?: string };

/** Read-only weekly grid. `cells` is keyed "day|period". */
export default function TimetableGrid({ periods, cells }: { periods: GridPeriod[]; cells: Map<string, GridCell> }) {
  return (
    <div className="table-wrap tt-wrap">
      <table className="tt">
        <thead>
          <tr>
            <th>Period</th>
            {DAYS.map((d) => <th key={d.no}>{d.long}</th>)}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) =>
            p.is_break ? (
              <tr key={p.period_no} className="tt-break">
                <td className="tt-time"><span className="strong">{p.label || "Break"}</span><span className="cell-sub">{fmtTime(p.start_time)} - {fmtTime(p.end_time)}</span></td>
                <td colSpan={DAYS.length} className="tt-break-cell">{p.label || "Break"}</td>
              </tr>
            ) : (
              <tr key={p.period_no}>
                <td className="tt-time"><span className="strong">{p.label || `Period ${p.period_no}`}</span><span className="cell-sub">{fmtTime(p.start_time)} - {fmtTime(p.end_time)}</span></td>
                {DAYS.map((d) => {
                  const c = cells.get(`${d.no}|${p.period_no}`);
                  return (
                    <td key={d.no} className={c ? "tt-cell" : "tt-cell empty-cell"}>
                      {c ? (
                        <>
                          <span className="strong">{c.subject}</span>
                          {c.className && <span className="cell-sub">{c.className}</span>}
                          {c.teacher && <span className="cell-sub">{c.teacher}</span>}
                        </>
                      ) : "-"}
                    </td>
                  );
                })}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
