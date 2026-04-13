import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTheme } from "@/lib/theme-context";

interface CalendarEvent {
  id: string;
  date: string; // ISO date string
}

interface EventCalendarProps {
  events: CalendarEvent[];
  onDayPress: (eventId: string, dateString: string) => void;
  selectedDate?: string | null;
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getMonthName(year: number, month: number): string {
  const d = new Date(year, month, 1);
  const name = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function EventCalendar({ events, onDayPress, selectedDate }: EventCalendarProps) {
  const theme = useTheme();

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

  // Monday-based offset: 0=Mon, 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  // Map day-of-month -> first event id on that day
  const firstEventByDay = new Map<number, string>();
  const eventDays = new Set<number>();
  for (const evt of events) {
    const d = new Date(evt.date);
    if (d.getMonth() === displayMonth && d.getFullYear() === displayYear) {
      const day = d.getDate();
      eventDays.add(day);
      if (!firstEventByDay.has(day)) {
        firstEventByDay.set(day, evt.id);
      }
    }
  }

  // Build grid cells: null = empty leading cell, number = day
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  // Pad to complete the last row
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) cells.push(null);
  }

  function makeDateString(day: number): string {
    return `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <View style={[styles.container, { borderColor: theme.pinBg }]}>
      {/* Month navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton} activeOpacity={0.6}>
          <ChevronLeft size={18} color={theme.muted} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: theme.primary }]}>
          {getMonthName(displayYear, displayMonth)}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton} activeOpacity={0.6}>
          <ChevronRight size={18} color={theme.muted} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week header */}
      <View style={styles.grid}>
        {DAY_LABELS.map((label) => (
          <View key={label} style={styles.cell}>
            <Text style={[styles.dayLabel, { color: theme.muted }]}>
              {label}
            </Text>
          </View>
        ))}

        {/* Day cells */}
        {cells.map((day, i) => {
          const isToday =
            day === today.getDate() &&
            displayMonth === today.getMonth() &&
            displayYear === today.getFullYear();
          const hasEvents = day != null && eventDays.has(day);
          const firstId = day != null ? firstEventByDay.get(day) : undefined;
          const dateStr = day != null ? makeDateString(day) : "";
          const isSelected = selectedDate === dateStr && day != null;

          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.cell,
                isSelected && {
                  backgroundColor: theme.primary,
                  borderRadius: 20,
                },
                isToday && !isSelected && {
                  borderWidth: 2,
                  borderColor: theme.primary,
                  borderRadius: 20,
                },
              ]}
              onPress={() => {
                if (hasEvents && firstId) {
                  onDayPress(firstId, dateStr);
                }
              }}
              disabled={!hasEvents}
              activeOpacity={hasEvents ? 0.6 : 1}
            >
              {day != null && (
                <>
                  <Text
                    style={[
                      styles.dayNumber,
                      isSelected
                        ? { color: "#FFFFFF" }
                        : isToday
                          ? { color: theme.primary, fontFamily: "DMSans_600SemiBold" }
                          : { color: hasEvents ? theme.primary : "#2E2118" },
                      hasEvents && !isToday && !isSelected && styles.dayWithEvent,
                    ]}
                  >
                    {day}
                  </Text>
                  {hasEvents && !isSelected && (
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: isToday ? theme.primary : theme.primary,
                        },
                      ]}
                    />
                  )}
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    borderWidth: 1,
    shadowColor: "#8a7850",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  monthTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%` as `${number}%`,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    minHeight: 36,
  },
  dayLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
  },
  dayNumber: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
  },
  dayWithEvent: {
    fontFamily: "DMSans_600SemiBold",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});
