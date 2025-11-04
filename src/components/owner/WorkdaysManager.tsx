import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { LockIcon, UnlockIcon, CalendarX, CalendarCheck } from "lucide-react";

interface DayOverride {
  id: string;
  day: string;
  state: "OPEN" | "CLOSED";
  reason: string | null;
}

interface SlotBlock {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  client_name: string;
  is_bonus: boolean;
}

interface Slot {
  time: string;
  status: "available" | "blocked" | "booked";
}

export const WorkdaysManager = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dayOverride, setDayOverride] = useState<DayOverride | null>(null);
  const [loading, setLoading] = useState(false);
  const timezone = "Europe/Rome";

  useEffect(() => {
    if (selectedDate) {
      loadDayData(selectedDate);
    }
  }, [selectedDate]);

  const loadDayData = async (date: Date) => {
    try {
      setLoading(true);
      const dateStr = format(date, "yyyy-MM-dd");

      // Get shop settings
      const { data: settings } = await supabase
        .from("shop_settings")
        .select("*")
        .single();

      if (!settings) {
        toast.error("Impossibile caricare le impostazioni del negozio");
        return;
      }

      // Get day override if exists
      const { data: override } = await supabase
        .from("day_overrides")
        .select("*")
        .eq("day", dateStr)
        .maybeSingle();

      setDayOverride(override as DayOverride | null);

      // If day is closed by override, don't show any slots
      if (override?.state === "CLOSED") {
        setSlots([]);
        return;
      }

      // Determine if day should have slots
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const dayName = dayNames[date.getDay()];
      const openHours = settings.open_hours[dayName] || [];

      // If day is closed normally and no override to open, no slots
      if (openHours.length === 0 && (!override || override.state !== "OPEN")) {
        setSlots([]);
        return;
      }

      // If override opens a normally closed day, use standard hours
      let hoursToUse = openHours;
      if (override?.state === "OPEN" && openHours.length === 0) {
        // Use default hours (e.g., Monday hours)
        hoursToUse = settings.open_hours["mon"] || [];
      }

      // Generate all possible slots (45 min each)
      const allSlots: string[] = [];
      const zonedDate = toZonedTime(date, timezone);

      for (const [start, end] of hoursToUse) {
        const [startHour, startMin] = start.split(":").map(Number);
        const [endHour, endMin] = end.split(":").map(Number);

        let currentHour = startHour;
        let currentMin = startMin;

        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
          allSlots.push(`${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`);
          currentMin += 45;
          if (currentMin >= 60) {
            currentMin -= 60;
            currentHour += 1;
          }
        }
      }

      // Get blocked slots for this day
      const { data: blocks } = await supabase
        .from("slot_blocks")
        .select("*")
        .eq("day", dateStr);

      const blockedTimes = new Set((blocks || []).map(b => b.start_time.substring(0, 5)));

      // Get appointments for this day
      const startOfDay = new Date(zonedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(zonedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: appointments } = await supabase
        .from("appointments")
        .select("*")
        .eq("status", "CONFIRMED")
        .eq("is_bonus", false)
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString());

      const bookedTimes = new Set(
        (appointments || []).map(apt => {
          const aptTime = toZonedTime(new Date(apt.start_time), timezone);
          return format(aptTime, "HH:mm");
        })
      );

      // Combine all data
      const combinedSlots: Slot[] = allSlots.map(time => {
        if (bookedTimes.has(time)) {
          return { time, status: "booked" };
        }
        if (blockedTimes.has(time)) {
          return { time, status: "blocked" };
        }
        return { time, status: "available" };
      });

      setSlots(combinedSlots);
    } catch (error) {
      console.error("Error loading day data:", error);
      toast.error("Errore nel caricamento dei dati");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDay = async () => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      const { error } = await supabase
        .from("day_overrides")
        .upsert({
          day: dateStr,
          state: "CLOSED",
          reason: null
        });

      if (error) throw error;

      toast.success("Giornata chiusa");
      loadDayData(selectedDate);
    } catch (error) {
      console.error("Error closing day:", error);
      toast.error("Errore nella chiusura della giornata");
    }
  };

  const handleOpenDay = async () => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      const { error } = await supabase
        .from("day_overrides")
        .upsert({
          day: dateStr,
          state: "OPEN",
          reason: null
        });

      if (error) throw error;

      toast.success("Giornata aperta");
      loadDayData(selectedDate);
    } catch (error) {
      console.error("Error opening day:", error);
      toast.error("Errore nell'apertura della giornata");
    }
  };

  const handleRemoveOverride = async () => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      const { error } = await supabase
        .from("day_overrides")
        .delete()
        .eq("day", dateStr);

      if (error) throw error;

      toast.success("Override rimosso");
      loadDayData(selectedDate);
    } catch (error) {
      console.error("Error removing override:", error);
      toast.error("Errore nella rimozione dell'override");
    }
  };

  const handleToggleSlotBlock = async (slot: Slot) => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    if (slot.status === "booked") {
      toast.error("Slot già prenotato");
      return;
    }

    try {
      if (slot.status === "blocked") {
        // Unblock
        const { error } = await supabase
          .from("slot_blocks")
          .delete()
          .eq("day", dateStr)
          .eq("start_time", `${slot.time}:00`);

        if (error) throw error;
      } else {
        // Block
        const [hour, minute] = slot.time.split(":").map(Number);
        const endMinute = (minute + 45) % 60;
        const endHour = hour + Math.floor((minute + 45) / 60);

        const { error } = await supabase
          .from("slot_blocks")
          .insert({
            day: dateStr,
            start_time: `${slot.time}:00`,
            end_time: `${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}:00`
          });

        if (error) throw error;
      }

      loadDayData(selectedDate);
    } catch (error) {
      console.error("Error toggling slot block:", error);
      toast.error("Errore nella modifica del blocco");
    }
  };

  const handleUnblockAllSlots = async () => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      const { error } = await supabase
        .from("slot_blocks")
        .delete()
        .eq("day", dateStr);

      if (error) throw error;

      toast.success("Tutti gli slot sono stati sbloccati");
      loadDayData(selectedDate);
    } catch (error) {
      console.error("Error unblocking all slots:", error);
      toast.error("Errore nello sblocco degli slot");
    }
  };

  // Determine day status
  const getDayStatus = () => {
    if (!selectedDate) return null;

    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayName = dayNames[selectedDate.getDay()];

    // Check if there are standard hours
    const hasStandardHours = slots.length > 0 || dayOverride?.state === "OPEN";

    if (dayOverride) {
      if (dayOverride.state === "CLOSED") {
        return { label: "Chiuso", type: "closed" };
      } else if (dayOverride.state === "OPEN") {
        return { label: "Aperto straordinario", type: "extraordinary" };
      }
    }

    if (slots.length > 0) {
      return { label: "Aperto (standard)", type: "standard" };
    }

    return { label: "Chiuso", type: "closed" };
  };

  const dayStatus = getDayStatus();
  const isNormallyClosed = slots.length === 0 && !dayOverride;
  const hasBlockedSlots = slots.some(s => s.status === "blocked");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle>Seleziona una data</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={it}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Day Status & Actions */}
        <Card>
          <CardHeader>
            <CardTitle>
              {format(selectedDate, "EEEE, d MMMM yyyy", { locale: it })}
            </CardTitle>
            <CardDescription>
              Stato: <span className="font-semibold">{dayStatus?.label}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dayStatus?.type === "closed" && !isNormallyClosed && dayOverride && (
              <>
                <Button
                  variant="default"
                  className="w-full"
                  onClick={handleRemoveOverride}
                >
                  <CalendarCheck className="w-4 h-4 mr-2" />
                  Ripristina orario standard
                </Button>
              </>
            )}

            {dayStatus?.type === "standard" && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleCloseDay}
              >
                <CalendarX className="w-4 h-4 mr-2" />
                Chiudi giornata
              </Button>
            )}

            {isNormallyClosed && !dayOverride && (
              <Button
                variant="default"
                className="w-full"
                onClick={handleOpenDay}
              >
                <CalendarCheck className="w-4 h-4 mr-2" />
                Apri a prenotazioni
              </Button>
            )}

            {dayStatus?.type === "extraordinary" && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleRemoveOverride}
              >
                <CalendarX className="w-4 h-4 mr-2" />
                Rimuovi apertura straordinaria
              </Button>
            )}

            {hasBlockedSlots && slots.length > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleUnblockAllSlots}
              >
                <UnlockIcon className="w-4 h-4 mr-2" />
                Sblocca tutti gli slot
              </Button>
            )}

            {dayStatus?.type === "closed" && (
              <p className="text-sm text-muted-foreground">
                Il negozio è chiuso in questa data.
              </p>
            )}

            {dayStatus?.type === "extraordinary" && (
              <p className="text-sm text-muted-foreground">
                Apertura straordinaria: prenotazioni disponibili negli orari indicati.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Slots Grid */}
      {slots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gestione slot</CardTitle>
            <CardDescription>
              Clicca su uno slot per bloccarlo/sbloccarlo. Gli slot prenotati non sono modificabili.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Caricamento...</div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {slots.map((slot) => (
                  <Button
                    key={slot.time}
                    onClick={() => handleToggleSlotBlock(slot)}
                    disabled={slot.status === "booked"}
                    variant={
                      slot.status === "booked"
                        ? "outline"
                        : slot.status === "blocked"
                        ? "destructive"
                        : "default"
                    }
                    className={
                      slot.status === "booked"
                        ? "opacity-50 cursor-not-allowed bg-muted"
                        : slot.status === "blocked"
                        ? "bg-destructive hover:bg-destructive/90"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }
                    title={
                      slot.status === "booked"
                        ? "Slot prenotato"
                        : slot.status === "blocked"
                        ? "Clicca per sbloccare"
                        : "Clicca per bloccare"
                    }
                  >
                    {slot.time}
                    {slot.status === "blocked" && (
                      <LockIcon className="w-3 h-3 ml-1" />
                    )}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
