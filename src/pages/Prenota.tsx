import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { Scissors, LogOut, Clock, Phone } from "lucide-react";
import BottomNav from "@/components/BottomNav";
const Prenota = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [allSlots, setAllSlots] = useState<{
    time: string;
    available: boolean;
  }[]>([]);
  const [hasBookedSlots, setHasBookedSlots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingSlot, setBookingSlot] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const timezone = "Europe/Rome";
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      // Check if user is blocked
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_blocked")
        .eq("id", session.user.id)
        .single();

      if (profile?.is_blocked) {
        setIsBlocked(true);
      }
    };
    checkAuth();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots(selectedDate);
    }
  }, [selectedDate]);
  const loadAvailableSlots = async (date: Date) => {
    try {
      setLoading(true);

      // Get shop settings
      const {
        data: settings
      } = await supabase.from("shop_settings").select("*").single();
      if (!settings) {
        toast.error("Impossibile caricare le impostazioni del negozio");
        return;
      }
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const dayName = dayNames[date.getDay()];
      const openHours = settings.open_hours[dayName] || [];
      if (openHours.length === 0) {
        setAllSlots([]);
        setHasBookedSlots(false);
        return;
      }

      // Generate all possible slots
      const slots: string[] = [];
      const zonedDate = toZonedTime(date, timezone);
      const now = toZonedTime(new Date(), timezone);
      for (const [start, end] of openHours) {
        const [startHour, startMin] = start.split(":").map(Number);
        const [endHour, endMin] = end.split(":").map(Number);
        let currentHour = startHour;
        let currentMin = startMin;
        while (currentHour < endHour || currentHour === endHour && currentMin < endMin) {
          const slotTime = new Date(zonedDate);
          slotTime.setHours(currentHour, currentMin, 0, 0);

          // Only show future slots (or current day after current time)
          if (slotTime > now) {
            slots.push(`${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`);
          }

          // Add 45 minutes
          currentMin += 45;
          if (currentMin >= 60) {
            currentMin -= 60;
            currentHour += 1;
          }
        }
      }

      // Get existing appointments for this day
      const startOfDay = new Date(zonedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(zonedDate);
      endOfDay.setHours(23, 59, 59, 999);
      const {
        data: appointments
      } = await supabase.from("appointments").select("*").eq("status", "CONFIRMED").gte("start_time", startOfDay.toISOString()).lte("start_time", endOfDay.toISOString());

      // Create set of booked slots
      const bookedSlotsSet = new Set((appointments || []).map(apt => {
        const aptTime = toZonedTime(new Date(apt.start_time), timezone);
        return format(aptTime, "HH:mm");
      }));

      // Combine all slots with availability status
      const combinedSlots = slots.map(slot => ({
        time: slot,
        available: !bookedSlotsSet.has(slot)
      }));
      setAllSlots(combinedSlots);
      setHasBookedSlots(bookedSlotsSet.size > 0);
    } catch (error: any) {
      console.error("Error loading slots:", error);
      toast.error("Errore nel caricamento degli slot disponibili");
    } finally {
      setLoading(false);
    }
  };
  const handleSlotSelection = (slot: string) => {
    setSelectedSlot(slot);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedDate || !user) return;
    setBookingSlot(selectedSlot);
    try {
      const slot = selectedSlot;
      const [hour, minute] = slot.split(":").map(Number);
      const zonedDate = toZonedTime(selectedDate, timezone);
      zonedDate.setHours(hour, minute, 0, 0);
      const startTime = fromZonedTime(zonedDate, timezone);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 45);

      // Check one more time if slot is still available (prevent race conditions)
      const {
        data: existingApt
      } = await supabase.from("appointments").select("id").eq("status", "CONFIRMED").or(`and(start_time.lt.${endTime.toISOString()},end_time.gt.${startTime.toISOString()})`).maybeSingle();
      if (existingApt) {
        toast.error("Questo slot è stato appena prenotato. Ricarico gli slot disponibili...");
        await loadAvailableSlots(selectedDate);
        return;
      }

      // Get user profile
      const {
        data: profile
      } = await supabase.from("profiles").select("name, email, phone").eq("id", user.id).single();

      // Create appointment
      const { data: newAppointment, error } = await supabase
        .from("appointments")
        .insert({
          user_id: user.id,
          client_name: profile?.name || user.email,
          client_email: profile?.email || user.email,
          client_phone: profile?.phone,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          is_bonus: false,
          status: "CONFIRMED",
          created_by: "USER"
        })
        .select()
        .single();

      if (error) throw error;

      // Send confirmation email
      try {
        const { error: emailError } = await supabase.functions.invoke('send-confirmation', {
          body: { appointment_id: newAppointment.id }
        });
        
        if (emailError) {
          console.error("Failed to send confirmation email:", emailError);
          toast.success("Prenotazione effettuata! Email di conferma non inviata.");
        } else {
          toast.success("Prenotazione effettuata con successo!");
        }
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
        toast.success("Prenotazione effettuata! Email di conferma non inviata.");
      }

      navigate("/miei-appuntamenti");
    } catch (error: any) {
      console.error("Booking error:", error);
      if (error.message?.includes('Slot non disponibile')) {
        toast.error("Questo slot è stato appena prenotato da un altro utente. Ricarico gli slot...");
        await loadAvailableSlots(selectedDate);
      } else {
        toast.error(error.message || "Errore durante la prenotazione");
      }
    } finally {
      setBookingSlot(null);
      setSelectedSlot(null);
    }
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };
  if (!user) return null;
  return <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-3 md:px-4 py-2 md:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-3">
            <Scissors className="w-5 h-5 md:w-6 md:h-6" />
            <h1 className="text-lg md:text-2xl font-bold">ZIO FRANK</h1>
          </div>
          <div className="flex gap-1 md:gap-2">
            <Button variant="ghost" onClick={() => navigate("/miei-appuntamenti")} className="text-primary-foreground hover:bg-primary-foreground/20 text-xs md:text-sm px-2 md:px-4 h-8 md:h-10">
              <span className="hidden sm:inline">I Miei Appuntamenti</span>
              <span className="sm:hidden">Appuntamenti</span>
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/20 text-xs md:text-sm px-2 md:px-4 h-8 md:h-10">
              <LogOut className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full px-2 sm:px-4 md:px-6 py-4 md:py-8 pb-24 overflow-x-hidden max-w-7xl mx-auto">
        <div className="w-full">
          <div className="mb-4 md:mb-8 text-center px-2">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 md:mb-2">Prenota il tuo appuntamento</h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">Scegli data e orario per il tuo taglio</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 lg:gap-8 w-full">
            <Card className="w-full overflow-hidden">
              <CardHeader className="pb-1 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4">
                <CardTitle className="text-base sm:text-lg md:text-xl">Seleziona la data</CardTitle>
                
              </CardHeader>
              <CardContent className="flex justify-center px-1 sm:px-2 md:px-4">
                <div className="w-full max-w-full overflow-hidden flex justify-center">
                  <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))} locale={it} className="rounded-md border scale-100 sm:scale-110 md:scale-125 origin-center [&_button]:text-sm sm:[&_button]:text-base md:[&_button]:text-lg [&_button]:h-9 sm:[&_button]:h-10 md:[&_button]:h-11 [&_button]:w-9 sm:[&_button]:w-10 md:[&_button]:w-11" />
                </div>
              </CardContent>
            </Card>

            <Card className="w-full overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-4 md:px-6">
                <CardTitle className="text-base sm:text-lg md:text-xl">Orari disponibili</CardTitle>
                <CardDescription className="text-xs sm:text-sm break-words">
                  {selectedDate ? format(selectedDate, "EEEE, d MMMM yyyy", {
                  locale: it
                }) : "Seleziona una data"}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-3 md:px-6">
                {isBlocked ? (
                  <div className="text-center py-8">
                    <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                      <span className="text-3xl">🔒</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Account Bloccato</h3>
                    <p className="text-muted-foreground mb-4">
                      Il tuo account è bloccato: non puoi effettuare nuove prenotazioni.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Contatta il negozio per maggiori informazioni.
                    </p>
                  </div>
                ) : loading ? <div className="text-center py-8 text-muted-foreground">
                    Caricamento...
                  </div> : allSlots.length === 0 ? <div className="text-center py-8">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Nessun orario disponibile per questa data
                    </p>
                  </div> : <>
                    <div className="max-h-[350px] sm:max-h-[400px] md:max-h-none overflow-y-auto scrollbar-hide">
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3 w-full">
                        {allSlots.map(slot => <Button key={slot.time} onClick={() => slot.available && handleSlotSelection(slot.time)} disabled={!slot.available || bookingSlot !== null} variant="outline" className={
                            slot.available && selectedSlot === slot.time
                              ? "h-10 sm:h-11 md:h-12 lg:h-14 text-xs sm:text-sm md:text-base px-1 sm:px-2 md:px-3 bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600 font-medium whitespace-nowrap"
                              : slot.available
                              ? "h-10 sm:h-11 md:h-12 lg:h-14 text-xs sm:text-sm md:text-base px-1 sm:px-2 md:px-3 hover:bg-accent hover:text-accent-foreground font-medium whitespace-nowrap"
                              : "h-10 sm:h-11 md:h-12 lg:h-14 text-xs sm:text-sm md:text-base px-1 sm:px-2 md:px-3 opacity-50 bg-destructive/10 border-destructive/50 text-destructive cursor-not-allowed font-medium whitespace-nowrap"
                          }>
                            {slot.time}
                          </Button>)}
                      </div>
                    </div>
                    
                    {selectedSlot && (
                      <div className="mt-3 sm:mt-4 md:mt-6 space-y-2">
                        <Button
                          size="lg"
                          onClick={handleConfirmBooking}
                          disabled={bookingSlot !== null}
                          className="w-full h-auto py-3 sm:py-3.5 md:py-4 lg:py-5 text-sm sm:text-base md:text-lg lg:text-xl px-3 sm:px-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold"
                        >
                          {bookingSlot ? "Prenotazione in corso..." : "Conferma Prenotazione"}
                        </Button>
                        <p className="text-xs sm:text-sm text-red-600 font-medium text-center px-2">
                          NB: Le prenotazioni non possono essere modificate o annullate a meno di 24 ore dall'orario previsto.
                        </p>
                      </div>
                    )}
                    
                    <div className="mt-3 sm:mt-4 md:mt-6 pt-3 sm:pt-4 md:pt-6 border-t">
                      <Button size="lg" className="w-full h-auto py-3 sm:py-3.5 md:py-4 lg:py-5 text-xs sm:text-sm md:text-base lg:text-lg px-3 sm:px-4 bg-accent text-accent-foreground hover:bg-accent/90 leading-snug font-semibold" onClick={() => navigate("/#contatti")}>
                        <Phone className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 mr-1.5 sm:mr-2 flex-shrink-0" />
                        <span className="text-left break-words">
                          L'orario che desideravi è occupato? Chiamami!
                        </span>
                      </Button>
                    </div>
                  </>}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <BottomNav isAuthenticated={true} />
    </div>;
};
export default Prenota;