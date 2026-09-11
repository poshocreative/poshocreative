import { useMemo, useState } from 'react';

import { EmptyState } from '../ui/StateBlocks';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-NG', {
    month: 'long',
    year: 'numeric',
  });
}

export default function WorkCalendar({ tasks = [], onOpen }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const byDate = useMemo(() => {
    const map = new Map();

    for (const task of tasks) {
      if (!task.due_at) continue;

      const key = String(task.due_at).slice(0, 10);

      if (!map.has(key)) map.set(key, []);
      map.get(key).push(task);
    }

    return map;
  }, [tasks]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = [];

    for (let i = 0; i < startOffset; i += 1) {
      list.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      list.push(new Date(year, month, day));
    }

    return list;
  }, [year, month]);

  const move = (delta) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const dated = tasks.filter((task) => task.due_at);

  return (
    <section className="admin-control-card" aria-label="Task calendar">
      <div className="finance-request-heading">
        <div>
          <span>CALENDAR</span>
          <h3>{monthLabel(year, month)}</h3>
          <p className="admin-card-description">
            Tasks land on their due dates. Undated work stays in the other views.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="button button-secondary" onClick={() => move(-1)} aria-label="Previous month">
            ←
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              const now = new Date();
              setYear(now.getFullYear());
              setMonth(now.getMonth());
            }}
          >
            Today
          </button>
          <button type="button" className="button button-secondary" onClick={() => move(1)} aria-label="Next month">
            →
          </button>
        </div>
      </div>

      {dated.length === 0 ? (
        <EmptyState title="Nothing dated" body="Add due dates to tasks to see them on the calendar." />
      ) : (
        <div className="posho-calendar" role="grid" aria-label={`${monthLabel(year, month)} tasks`}>
          <div className="posho-calendar-weekdays" role="row">
            {WEEKDAYS.map((day) => (
              <span key={day} role="columnheader">{day}</span>
            ))}
          </div>
          <div className="posho-calendar-grid">
            {cells.map((date, index) => {
              if (!date) {
                return <span key={`blank-${index}`} className="posho-calendar-day posho-calendar-blank" />;
              }

              const key = toISODate(date);
              const dayTasks = byDate.get(key) || [];
              const isToday = key === toISODate(new Date());

              return (
                <div
                  key={key}
                  role="gridcell"
                  aria-label={`${key}, ${dayTasks.length} tasks`}
                  className={`posho-calendar-day${isToday ? ' posho-calendar-today' : ''}`}
                >
                  <strong>{date.getDate()}</strong>
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="posho-calendar-chip"
                      title={`${task.title} (${task.order?.reference || ''})`}
                      onClick={() => onOpen?.(task)}
                    >
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <small>+{dayTasks.length - 3} more</small>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
