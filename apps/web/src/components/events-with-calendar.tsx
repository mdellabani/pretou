"use client";

import { useState, useCallback } from "react";
import { EventCalendar } from "./event-calendar";

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

function eventMatchesMonth(event_date: string | null, year: number, month: number): boolean {
  if (!event_date) return false;
  const d = new Date(event_date);
  return d.getFullYear() === year && d.getMonth() === month;
}

function eventMatchesDate(event_date: string | null, dateStr: string): boolean {
  if (!event_date) return false;
  const d = new Date(event_date);
  const evtDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return evtDateStr === dateStr;
}

export function EventsWithCalendar({
  upcomingEvents,
  pastEvents,
}: EventsWithCalendarProps) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(today.getMonth());

  const allEvents = [...upcomingEvents, ...pastEvents];

  // Build calendar events for the EventCalendar component
  const calendarEvents = allEvents
    .filter((e) => e.event_date != null)
    .map((e) => ({ id: e.id, date: e.event_date!, title: e.title }));

  // Filter events: by specific date if selected, otherwise by displayed month
  function filterEvents(events: EventPost[]): EventPost[] {
    if (selectedDate) {
      return events.filter((e) => eventMatchesDate(e.event_date, selectedDate));
    }
    return events.filter((e) => eventMatchesMonth(e.event_date, displayYear, displayMonth));
  }

  const filteredUpcoming = filterEvents(upcomingEvents);
  const filteredPast = filterEvents(pastEvents);
  const totalFiltered = filteredUpcoming.length + filteredPast.length;

  const handleDateSelect = useCallback((date: string | null) => {
    setSelectedDate(date);
  }, []);

  const handleMonthChange = useCallback((year: number, month: number) => {
    setDisplayYear(year);
    setDisplayMonth(month);
  }, []);

  const monthLabel = new Date(displayYear, displayMonth, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-10">
      {/* Calendar with month navigation */}
      <EventCalendar
        events={calendarEvents}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
        onMonthChange={handleMonthChange}
      />

      {/* Filter indicator */}
      {selectedDate ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            {totalFiltered} événement{totalFiltered !== 1 ? "s" : ""} le{" "}
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
          </p>
          <button
            onClick={() => setSelectedDate(null)}
            className="rounded-lg px-3 py-1 text-xs font-medium transition-colors hover:opacity-80"
            style={{
              backgroundColor: "var(--theme-pin-bg)",
              color: "var(--theme-primary)",
            }}
          >
            Voir tout le mois
          </button>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">
          {totalFiltered} événement{totalFiltered !== 1 ? "s" : ""} en {monthLabel}
        </p>
      )}

      {/* Events for selected period */}
      {filteredUpcoming.length > 0 && (
        <section>
          <h2
            className="mb-4 border-b-2 pb-2 text-xl font-semibold"
            style={{ borderColor: "var(--theme-primary)", color: "var(--foreground)" }}
          >
            À venir
          </h2>
          <div className="space-y-4">
            {filteredUpcoming.map((event) => (
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
                      {formatEventDate(event.event_date)} à{" "}
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
        </section>
      )}

      {/* Past events for this month */}
      {filteredPast.length > 0 && (
        <section>
          <h2
            className="mb-4 border-b-2 pb-2 text-xl font-semibold"
            style={{ borderColor: "var(--theme-muted)", color: "var(--foreground)" }}
          >
            Événements passés
          </h2>
          <div className="space-y-4">
            {filteredPast.map((event) => (
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

      {/* Empty state */}
      {totalFiltered === 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Aucun événement {selectedDate ? "à cette date" : "ce mois-ci"}.
        </p>
      )}
    </div>
  );
}
