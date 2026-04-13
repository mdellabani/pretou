"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
}

interface EventCalendarProps {
  events: CalendarEvent[];
  onDateSelect: (date: string | null) => void;
  selectedDate: string | null;
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getMonthName(year: number, month: number): string {
  const d = new Date(year, month, 1);
  const name = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function EventCalendar({ events, onDateSelect, selectedDate }: EventCalendarProps) {
  const today = new Date();
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(today.getMonth());

  function goToPrevMonth() {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear((y) => y - 1);
    } else {
      setDisplayMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear((y) => y + 1);
    } else {
      setDisplayMonth((m) => m + 1);
    }
  }

  const firstDay = new Date(displayYear, displayMonth, 1);
  const lastDay = new Date(displayYear, displayMonth + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  // Map day-of-month -> has events
  const eventDays = new Set<number>();
  for (const evt of events) {
    const d = new Date(evt.date);
    if (d.getMonth() === displayMonth && d.getFullYear() === displayYear) {
      eventDays.add(d.getDate());
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  // Pad to complete the last row
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) cells.push(null);
  }

  function handleDayClick(day: number) {
    if (!eventDays.has(day)) return;
    const dateStr = `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (selectedDate === dateStr) {
      onDateSelect(null);
    } else {
      onDateSelect(dateStr);
    }
  }

  const isToday = (day: number) =>
    day === today.getDate() &&
    displayMonth === today.getMonth() &&
    displayYear === today.getFullYear();

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const dateStr = `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return selectedDate === dateStr;
  };

  return (
    <div className="rounded-[14px] bg-white px-5 py-4 shadow-[0_1px_6px_rgba(160,130,90,0.06)]">
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--theme-background)] hover:text-[var(--foreground)]"
          aria-label="Mois précédent"
        >
          <ChevronLeft size={18} />
        </button>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {getMonthName(displayYear, displayMonth)}
        </h3>
        <button
          onClick={goToNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--theme-background)] hover:text-[var(--foreground)]"
          aria-label="Mois suivant"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day grid */}
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
          const todayFlag = day ? isToday(day) : false;
          const selectedFlag = day ? isSelected(day) : false;
          const hasEvents = day ? eventDays.has(day) : false;

          return (
            <div
              key={i}
              onClick={() => day && handleDayClick(day)}
              className={`relative flex h-8 items-center justify-center rounded-md text-xs transition-colors ${
                selectedFlag
                  ? "font-semibold text-white"
                  : todayFlag
                    ? "font-semibold ring-2 ring-inset"
                    : day
                      ? "text-[var(--foreground)]"
                      : ""
              } ${hasEvents && !selectedFlag ? "cursor-pointer hover:opacity-75" : ""}`}
              style={{
                ...(selectedFlag
                  ? { backgroundColor: "var(--theme-primary)" }
                  : {}),
                ...(todayFlag && !selectedFlag
                  ? { ringColor: "var(--theme-primary)", color: "var(--theme-primary)" }
                  : {}),
              }}
            >
              {day}
              {hasEvents && !selectedFlag && (
                <span
                  className="absolute -bottom-0.5 h-1 w-1 rounded-full"
                  style={{ backgroundColor: "var(--theme-primary)" }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* "Voir tout" button when filtered */}
      {selectedDate && (
        <button
          onClick={() => onDateSelect(null)}
          className="mt-3 w-full rounded-lg py-1.5 text-xs font-medium transition-colors hover:opacity-80"
          style={{
            backgroundColor: "var(--theme-pin-bg)",
            color: "var(--theme-primary)",
          }}
        >
          Voir tous les événements
        </button>
      )}
    </div>
  );
}
