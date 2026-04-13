"use client";

import { useCallback } from "react";

interface EventPost {
  id: string;
  title: string;
  body: string | null;
  event_date: string | null;
  event_location: string | null;
  created_at: string;
}

interface EventsWithCalendarProps {
  upcomingEvents: EventPost[];
  pastEvents: EventPost[];
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function formatEventDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatEventTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InteractiveCalendar({
  events,
  onDayClick,
}: {
  events: EventPost[];
  onDayClick: (eventId: string) => void;
}) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday-based offset: 0=Mon, 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const monthName = firstDay.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  // Map day-of-month -> first event id on that day
  const firstEventByDay = new Map<number, string>();
  const eventDays = new Set<number>();
  for (const evt of events) {
    if (!evt.event_date) continue;
    const d = new Date(evt.event_date);
    if (d.getMonth() === month && d.getFullYear() === year) {
      const day = d.getDate();
      eventDays.add(day);
      if (!firstEventByDay.has(day)) {
        firstEventByDay.set(day, evt.id);
      }
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  return (
    <div className="rounded-[14px] bg-white px-5 py-4 shadow-[0_1px_6px_rgba(160,130,90,0.06)]">
      <h3 className="mb-3 text-sm font-semibold capitalize text-[var(--foreground)]">
        {monthName}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 font-medium text-[var(--muted-foreground)]"
          >
            {label}
          </div>
        ))}
        {cells.map((day, i) => {
          const isToday =
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();
          const hasEvents = day ? eventDays.has(day) : false;
          const firstId = day ? firstEventByDay.get(day) : undefined;

          return (
            <div
              key={i}
              id={day ? `cal-day-${day}` : undefined}
              onClick={() => {
                if (firstId) onDayClick(firstId);
              }}
              className={`relative flex h-8 items-center justify-center rounded-md text-xs ${
                isToday
                  ? "font-semibold text-white"
                  : day
                    ? "text-[var(--foreground)]"
                    : ""
              } ${hasEvents ? "cursor-pointer hover:opacity-75" : ""}`}
              style={isToday ? { backgroundColor: "var(--theme-primary)" } : undefined}
            >
              {day}
              {hasEvents && (
                <span
                  className="absolute -bottom-0.5 h-1 w-1 rounded-full"
                  style={{ backgroundColor: "var(--theme-primary)" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EventsWithCalendar({
  upcomingEvents,
  pastEvents,
}: EventsWithCalendarProps) {
  const scrollToEvent = useCallback((eventId: string) => {
    const el = document.getElementById(`event-${eventId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Pass all events (upcoming + past) so the calendar shows dots for both
  const allEvents = [...upcomingEvents, ...pastEvents];

  return (
    <div className="space-y-10">
      {/* Calendar */}
      <InteractiveCalendar events={allEvents} onDayClick={scrollToEvent} />

      {/* Upcoming events */}
      <section>
        <h2
          className="mb-4 border-b-2 pb-2 text-xl font-semibold"
          style={{ borderColor: "var(--theme-primary)", color: "var(--foreground)" }}
        >
          A venir
        </h2>
        {upcomingEvents.length > 0 ? (
          <div className="space-y-4">
            {upcomingEvents.map((event) => (
              <article
                key={event.id}
                id={`event-${event.id}`}
                className="scroll-mt-4 rounded-[14px] bg-white p-5 shadow-[0_1px_6px_rgba(160,130,90,0.06)]"
              >
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  {event.title}
                </h3>
                {event.event_date && (
                  <div className="mt-2 flex flex-col gap-0.5 text-sm text-[var(--muted-foreground)]">
                    <time dateTime={event.event_date} className="font-medium">
                      {formatEventDate(event.event_date)} a{" "}
                      {formatEventTime(event.event_date)}
                    </time>
                    {event.event_location && (
                      <p>{event.event_location}</p>
                    )}
                  </div>
                )}
                {event.body && (
                  <p className="mt-3 whitespace-pre-line text-sm text-[var(--foreground)]/80">
                    {event.body}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            Aucun evenement a venir pour le moment.
          </p>
        )}
      </section>

      {/* Past events */}
      {pastEvents.length > 0 && (
        <section>
          <h2
            className="mb-4 border-b-2 pb-2 text-xl font-semibold"
            style={{ borderColor: "var(--theme-muted)", color: "var(--foreground)" }}
          >
            Evenements passes
          </h2>
          <div className="space-y-4">
            {pastEvents.map((event) => (
              <article
                key={event.id}
                id={`event-${event.id}`}
                className="scroll-mt-4 rounded-[14px] bg-white p-5 opacity-60 shadow-[0_1px_6px_rgba(160,130,90,0.06)]"
              >
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  {event.title}
                </h3>
                {event.event_date && (
                  <div className="mt-2 flex flex-col gap-0.5 text-sm text-[var(--muted-foreground)]">
                    <time dateTime={event.event_date}>
                      {formatEventDate(event.event_date)}
                    </time>
                    {event.event_location && (
                      <p>{event.event_location}</p>
                    )}
                  </div>
                )}
                {event.body && (
                  <p className="mt-3 line-clamp-2 text-sm text-[var(--muted-foreground)]">
                    {event.body}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
