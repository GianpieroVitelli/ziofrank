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
import { Scissors, LogOut, Clock } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const Prenota = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingSlot, setBookingSlot] = useState<string | null>(null);
  const timezone = "Europe/Rome";

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
      const { data: settings } = await supabase
        .from("shop_settings")
        .select("*")
        .single();

      if (!settings) {
        toast.error("Impossibile caricare le impostazioni del negozio");
        return;
      }

      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const dayName = dayNames[date.getDay()];
      const openHours = settings.open_hours[dayName] || [];
      
      if (openHours.length === 0) {
        setAvailableSlots([]);
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
        
        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
          const slotTime = new Date(zonedDate);
          slotTime.setHours(currentHour, currentMin, 0, 0);
          
          // Only show future slots (or current day after current time)
          if (slotTime > now) {
            slots.push(`${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`);
          }
          
          // Add 30 minutes
          currentMin += 30;
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

      const { data: appointments } = await supabase
        .from("appointments")
        .select("*")
        .eq("status", "CONFIRMED")
        .eq("is_bonus", false)
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString());

      // Filter out booked slots
      const bookedSlots = new Set(
        (appointments || []).map(apt => {
          const aptTime = toZonedTime(new Date(apt.start_time), timezone);
          return format(aptTime, "HH:mm");
        })
      );

      const available = slots.filter(slot => !bookedSlots.has(slot));
      setAvailableSlots(available);
    } catch (error: any) {
      console.error("Error loading slots:", error);
      toast.error("Errore nel caricamento degli slot disponibili");
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (slot: string) => {
    if (!selectedDate || !user) return;
    
    setBookingSlot(slot);
    try {
      const [hour, minute] = slot.split(":").map(Number);
      const zonedDate = toZonedTime(selectedDate, timezone);
      zonedDate.setHours(hour, minute, 0, 0);
      
      const startTime = fromZonedTime(zonedDate, timezone);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      // Check one more time if slot is still available (prevent race conditions)
      const { data: existingApt } = await supabase
        .from("appointments")
        .select("id")
        .eq("status", "CONFIRMED")
        .eq("is_bonus", false)
        .gte("start_time", startTime.toISOString())
        .lt("start_time", endTime.toISOString())
        .maybeSingle();

      if (existingApt) {
        toast.error("Questo slot è stato appena prenotato. Ricarico gli slot disponibili...");
        await loadAvailableSlots(selectedDate);
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email, phone")
        .eq("id", user.id)
        .single();

      // Create appointment
      const { error } = await supabase
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
        });

      if (error) throw error;

      toast.success("Prenotazione effettuata con successo!");
      navigate("/miei-appuntamenti");
    } catch (error: any) {
      console.error("Booking error:", error);
      toast.error(error.message || "Errore durante la prenotazione");
    } finally {
      setBookingSlot(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Scissors className="w-6 h-6" />
            <h1 className="text-2xl font-bold">ZIO FRANK</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/miei-appuntamenti")} className="text-primary-foreground hover:bg-primary-foreground/20">
              I Miei Appuntamenti
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/20">
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold mb-2">Prenota il tuo appuntamento</h2>
            <p className="text-muted-foreground">Scegli data e orario per il tuo taglio</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Seleziona la data</CardTitle>
                <CardDescription>Scegli il giorno che preferisci</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  locale={it}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Orari disponibili</CardTitle>
                <CardDescription>
                  {selectedDate ? format(selectedDate, "EEEE, d MMMM yyyy", { locale: it }) : "Seleziona una data"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Caricamento...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Nessun orario disponibile per questa data
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot}
                        onClick={() => handleBooking(slot)}
                        disabled={bookingSlot !== null}
                        variant="outline"
                        className="h-12 hover:bg-accent hover:text-accent-foreground"
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <BottomNav isAuthenticated={true} />
    </div>
  );
};

export default Prenota;
