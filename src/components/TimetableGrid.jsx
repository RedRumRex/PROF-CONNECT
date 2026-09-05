// Shared read-only weekly-timetable grid — used by the "My Timetable" page
// (with upload controls layered around it) and by a professor's profile
// page (read-only, no upload controls at all). Kept in one place so the
// two views can never visually drift apart.
//
// College hours this grid is drawn against — kept in sync with the same
// constants enforced server-side in app/timetable_parser.py. A row outside
// this range, or inside the lunch break, is rejected at upload time, so
// the grid never needs to render past these bounds.
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DAY_LABELS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' }
const DAY_START_MIN = 8 * 60        // 08:00
const DAY_END_MIN   = 17 * 60 + 10  // 17:10
const LUNCH_START_MIN = 13 * 60      // 13:00
const LUNCH_END_MIN   = 13 * 60 + 50 // 13:50
const TOTAL_MIN = DAY_END_MIN - DAY_START_MIN

function timeToMinutes(hhmmss) {
  const [h, m] = hhmmss.split(':').map(Number)
  return h * 60 + m
}

// Label for a raw minute-of-day value (used for the time-axis marks, which
// are the *actual* start/end times of the uploaded classes, not generic
// hourly ticks — so "8:50 AM" shows up exactly where a class starting at
// 8:50 does, rather than only ever seeing round hours).
function minutesToLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function formatClock(hhmmss) {
  const [h, m] = hhmmss.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

// Color is keyed off the class *type* (lecture/tutorial/lab), not the
// subject — every lecture is the same color regardless of which subject it
// is, and likewise for tutorials and labs. Kept in sync with the types
// app/timetable_parser.py accepts. A blank/legacy "type" (timetables
// uploaded before this column existed) falls back to "lecture".
const TYPE_STYLES = {
  lecture:  { swatch: 'bg-primary',         classes: 'bg-primary/15 border-primary/40 text-on-surface',         label: 'Lecture'  },
  tutorial: { swatch: 'bg-amber-500',       classes: 'bg-amber-500/15 border-amber-500/40 text-on-surface',     label: 'Tutorial' },
  lab:      { swatch: 'bg-emerald-500',     classes: 'bg-emerald-500/15 border-emerald-500/40 text-on-surface', label: 'Lab'       },
}
function styleFor(type) {
  return TYPE_STYLES[type] || TYPE_STYLES.lecture
}

function percentFromStart(minutes) {
  return ((minutes - DAY_START_MIN) / TOTAL_MIN) * 100
}

export default function TimetableGrid({
  entries,
  loading = false,
  loadError = '',
  emptyTitle = 'No timetable uploaded yet',
  emptyBody = 'Nothing to show here yet.',
}) {
  const entriesByDay = DAYS.reduce((acc, d) => {
    acc[d] = entries.filter((e) => e.day === d)
    return acc
  }, {})

  // Time-axis marks: the day's start/end, the lunch break's edges, and every
  // actual class start/end time — so the grid always labels exactly where a
  // class begins or ends (e.g. 8:50 AM, 9:40 AM) instead of rounding to the
  // nearest hour.
  const timeMarks = Array.from(
    new Set([
      DAY_START_MIN,
      DAY_END_MIN,
      LUNCH_START_MIN,
      LUNCH_END_MIN,
      ...entries.flatMap((e) => [timeToMinutes(e.start_time), timeToMinutes(e.end_time)]),
    ]),
  ).sort((a, b) => a - b)

  return (
    <div className="glass-panel rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden">
      {loading ? (
        <p className="text-sm text-on-surface-variant opacity-60 text-center py-16">Loading timetable…</p>
      ) : loadError ? (
        <p className="text-sm text-error text-center py-16">{loadError}</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-70">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">calendar_month</span>
          <p className="font-headline font-bold text-on-surface">{emptyTitle}</p>
          <p className="text-sm text-on-surface-variant max-w-sm text-center opacity-80">{emptyBody}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-b border-white/[0.06]">
              {Object.values(TYPE_STYLES).map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${s.swatch}`} />
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant opacity-60 font-bold">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-[56px_repeat(5,1fr)] border-b border-white/[0.06]">
              <div />
              {DAYS.map((d) => (
                <div key={d} className="px-3 py-3 text-center">
                  <p className="text-sm font-headline font-bold text-on-surface">{DAY_LABELS[d]}</p>
                </div>
              ))}
            </div>

            {/* Grid body */}
            <div className="grid grid-cols-[56px_repeat(5,1fr)]" style={{ height: `${TOTAL_MIN * 1.5}px` }}>

              {/* Time axis */}
              <div className="relative border-r border-white/[0.06]">
                {timeMarks.map((min) => (
                  <div
                    key={min}
                    className="absolute -translate-y-1/2 pr-2 text-right w-full text-[10px] text-on-surface-variant opacity-50 whitespace-nowrap"
                    style={{ top: `${percentFromStart(min)}%` }}
                  >
                    {minutesToLabel(min)}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {DAYS.map((d) => (
                <div key={d} className="relative border-r border-white/[0.04] last:border-r-0">
                  {timeMarks.map((min) => (
                    <div
                      key={min}
                      className="absolute w-full border-t border-white/[0.04]"
                      style={{ top: `${percentFromStart(min)}%` }}
                    />
                  ))}

                  {/* Lunch break block */}
                  <div
                    className="absolute w-full bg-white/[0.03] border-y border-white/[0.06] flex items-center justify-center"
                    style={{
                      top: `${percentFromStart(LUNCH_START_MIN)}%`,
                      height: `${((LUNCH_END_MIN - LUNCH_START_MIN) / TOTAL_MIN) * 100}%`,
                    }}
                  >
                    <span className="text-[9px] uppercase tracking-widest text-on-surface-variant opacity-40">Lunch</span>
                  </div>

                  {/* Classes */}
                  {entriesByDay[d].map((entry) => {
                    const startMin = timeToMinutes(entry.start_time)
                    const endMin = timeToMinutes(entry.end_time)
                    const style = styleFor(entry.type)
                    return (
                      <div
                        key={entry.entry_id}
                        className={`absolute left-0.5 right-0.5 rounded-lg border px-2 py-1 overflow-hidden ${style.classes}`}
                        style={{
                          top: `${percentFromStart(startMin)}%`,
                          height: `${((endMin - startMin) / TOTAL_MIN) * 100}%`,
                        }}
                        title={[entry.subject, style.label, entry.room, entry.instructor].filter(Boolean).join(' · ')}
                      >
                        <p className="text-[11px] font-bold leading-tight truncate">{entry.subject}</p>
                        <p className="text-[9px] opacity-70 truncate">
                          {formatClock(entry.start_time)} – {formatClock(entry.end_time)}
                        </p>
                        {entry.room && <p className="text-[9px] opacity-60 truncate">{entry.room}</p>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
