import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { Scissors, LogOut, Clock, Phone, Euro, ArrowLeft, ArrowRight, Check } from "lucide-react";
import BottomNav from "@/components/BottomNav";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  description: string | null;
}

type BookingStep = 'services' | 'date' | 'time';

const Prenota = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [step, setStep] = useState<BookingStep>('services');
  
  // Services state
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [showPrices, setShowPrices] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  
  // Date and slot state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [allSlots, setAllSlots] = useState<{ time: string; available: boolean; }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingSlot, setBookingSlot] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  
  const timezone = "Europe/Rome";

  // Calculate total duration based on selected services
  const totalDuration = services
    .filter(s => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

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
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Load services and shop settings
  useEffect(() => {
    const loadServicesAndSettings = async () => {
      setLoadingServices(true);
      
      const [servicesResult, settingsResult] = await Promise.all([
        supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("shop_settings").select("show_prices_to_customers").limit(1).maybeSingle()
      ]);

      if (servicesResult.data) {
        setServices(servicesResult.data);
      }
      if (settingsResult.data) {
        setShowPrices(settingsResult.data.show_prices_to_customers);
      }
      
      setLoadingServices(false);
    };
    loadServicesAndSettings();
  }, []);

  // Load available slots when date changes (only when on time step)
  useEffect(() => {
    if (selectedDate && step === 'time') {
      loadAvailableSlots(selectedDate);
    }
  }, [selectedDate, step, totalDuration]);

  const loadAvailableSlots = async (date: Date) => {
    if (totalDuration === 0) return;
    
    try {
      setLoading(true);

      const { data: settings } = await supabase.from("shop_settings").select("*").single();
      if (!settings) {
        toast.error("Impossibile caricare le impostazioni del negozio");
        return;
      }

      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const dayName = dayNames[date.getDay()];
      const openHours = settings.open_hours[dayName] || [];

      if (openHours.length === 0) {
        setAllSlots([]);
        return;
      }

      // Generate all possible starting slots (every 15 minutes)
      const slots: string[] = [];
      const zonedDate = toZonedTime(date, timezone);
      const now = toZonedTime(new Date(), timezone);

      for (const [start, end] of openHours) {
        const [startHour, startMin] = start.split(":").map(Number);
        const [endHour, endMin] = end.split(":").map(Number);
        
        let currentHour = startHour;
        let currentMin = startMin;
        
        // Calculate end time in minutes for this period
        const endTimeMinutes = endHour * 60 + endMin;

        while (true) {
          const currentTimeMinutes = currentHour * 60 + currentMin;
          // Check if there's enough time for the service before the period ends
          if (currentTimeMinutes + totalDuration > endTimeMinutes) break;

          const slotTime = new Date(zonedDate);
          slotTime.setHours(currentHour, currentMin, 0, 0);

          // Only show future slots
          if (slotTime > now) {
            slots.push(`${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`);
          }

          // Move to next slot (every 15 minutes)
          currentMin += 15;
          if (currentMin >= 60) {
            currentMin -= 60;
            currentHour += 1;
          }
        }
      }

      // Get busy slots for this day
      const startOfDay = new Date(zonedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const dayString = format(startOfDay, 'yyyy-MM-dd');

      const { data: busySlots, error: busySlotsError } = await supabase.rpc('get_busy_slots', {
        p_day: dayString
      });

      if (busySlotsError) {
        console.error("Errore nel caricamento degli slot occupati:", busySlotsError);
        toast.error("Errore nel caricamento degli slot");
        return;
      }

      // Check each slot for availability considering total duration
      const combinedSlots = slots.map(slot => {
        const [slotHour, slotMin] = slot.split(":").map(Number);
        const slotStartMinutes = slotHour * 60 + slotMin;
        const slotEndMinutes = slotStartMinutes + totalDuration;

        // Check if any busy slot overlaps with our desired time range
        const isOccupied = (busySlots || []).some((busy: any) => {
          const busyStart = toZonedTime(new Date(busy.start_time), timezone);
          const busyEnd = toZonedTime(new Date(busy.end_time), timezone);
          const busyStartMinutes = busyStart.getHours() * 60 + busyStart.getMinutes();
          const busyEndMinutes = busyEnd.getHours() * 60 + busyEnd.getMinutes();

          // Check for overlap
          return slotStartMinutes < busyEndMinutes && slotEndMinutes > busyStartMinutes;
        });

        return { time: slot, available: !isOccupied };
      });

      setAllSlots(combinedSlots);
    } catch (error: any) {
      console.error("Error loading slots:", error);
      toast.error("Errore nel caricamento degli slot disponibili");
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSlotSelection = (slot: string) => {
    setSelectedSlot(slot);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedDate || !user || selectedServices.length === 0) return;
    setBookingSlot(selectedSlot);
    
    try {
      const [hour, minute] = selectedSlot.split(":").map(Number);
      const zonedDate = toZonedTime(selectedDate, timezone);
      zonedDate.setHours(hour, minute, 0, 0);
      const startTime = fromZonedTime(zonedDate, timezone);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + totalDuration);

      // Check if slot is still available
      const { data: existingApt } = await supabase
        .from("appointments")
        .select("id")
        .eq("status", "CONFIRMED")
        .or(`and(start_time.lt.${endTime.toISOString()},end_time.gt.${startTime.toISOString()})`)
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

      // Insert appointment services
      const appointmentServices = selectedServices.map(serviceId => {
        const service = services.find(s => s.id === serviceId);
        return {
          appointment_id: newAppointment.id,
          service_id: serviceId,
          duration_at_booking: service?.duration_minutes || 0
        };
      });

      const { error: servicesError } = await supabase
        .from("appointment_services")
        .insert(appointmentServices);

      if (servicesError) {
        console.error("Error saving appointment services:", servicesError);
      }

      // Send confirmation email
      try {
        await supabase.functions.invoke('send-confirmation', {
          body: { appointment_id: newAppointment.id }
        });
        toast.success("Prenotazione effettuata con successo!");
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

  const goToNextStep = () => {
    if (step === 'services' && selectedServices.length > 0) {
      setStep('date');
    } else if (step === 'date' && selectedDate) {
      setStep('time');
    }
  };

  const goToPrevStep = () => {
    if (step === 'time') {
      setStep('date');
      setSelectedSlot(null);
    } else if (step === 'date') {
      setStep('services');
      setSelectedDate(undefined);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
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

      <main className="w-full px-2 sm:px-4 md:px-8 lg:px-12 py-4 md:py-8 pb-24 overflow-x-hidden max-w-4xl mx-auto">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step === 'services' ? 'bg-primary text-primary-foreground' : selectedServices.length > 0 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
            {selectedServices.length > 0 && step !== 'services' ? <Check className="w-4 h-4" /> : '1'}
          </div>
          <div className={`w-12 h-1 ${step !== 'services' ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step === 'date' ? 'bg-primary text-primary-foreground' : selectedDate ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
            {selectedDate && step === 'time' ? <Check className="w-4 h-4" /> : '2'}
          </div>
          <div className={`w-12 h-1 ${step === 'time' ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step === 'time' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            3
          </div>
        </div>

        {isBlocked ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
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
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Step 1: Service Selection */}
            {step === 'services' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Scegli i servizi</CardTitle>
                  <CardDescription>Seleziona uno o più servizi per il tuo appuntamento</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingServices ? (
                    <div className="text-center py-8 text-muted-foreground">Caricamento servizi...</div>
                  ) : services.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Nessun servizio disponibile</div>
                  ) : (
                    <div className="space-y-3">
                      {services.map(service => (
                        <div
                          key={service.id}
                          onClick={() => toggleService(service.id)}
                          className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedServices.includes(service.id)
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <Checkbox
                            checked={selectedServices.includes(service.id)}
                            onCheckedChange={() => toggleService(service.id)}
                          />
                          <div className="flex-1">
                            <h3 className="font-semibold">{service.name}</h3>
                            {service.description && (
                              <p className="text-sm text-muted-foreground">{service.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              {service.duration_minutes} min
                            </div>
                            {showPrices && service.price !== null && (
                              <div className="flex items-center gap-1 text-sm font-medium">
                                <Euro className="w-4 h-4" />
                                {service.price.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedServices.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-medium">Durata totale:</span>
                        <span className="text-lg font-bold">{totalDuration} minuti</span>
                      </div>
                      <Button onClick={goToNextStep} className="w-full" size="lg">
                        Continua
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Date Selection */}
            {step === 'date' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Seleziona la data</CardTitle>
                  <CardDescription>
                    Servizi selezionati: {services.filter(s => selectedServices.includes(s.id)).map(s => s.name).join(', ')} ({totalDuration} min)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      locale={it}
                      className="rounded-md border"
                    />
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Button variant="outline" onClick={goToPrevStep} className="flex-1">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                    <Button onClick={goToNextStep} disabled={!selectedDate} className="flex-1">
                      Continua
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Time Selection */}
            {step === 'time' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Scegli l'orario</CardTitle>
                  <CardDescription>
                    {selectedDate && format(selectedDate, "EEEE d MMMM yyyy", { locale: it })} - {totalDuration} minuti
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Caricamento orari...</div>
                  ) : allSlots.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Nessun orario disponibile per questa data</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                        {allSlots.map(slot => (
                          <Button
                            key={slot.time}
                            onClick={() => slot.available && handleSlotSelection(slot.time)}
                            disabled={!slot.available || bookingSlot !== null}
                            variant="outline"
                            className={
                              slot.available && selectedSlot === slot.time
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : slot.available
                                ? "hover:bg-accent"
                                : "opacity-50 bg-destructive/10 border-destructive/50 text-destructive cursor-not-allowed"
                            }
                          >
                            {slot.time}
                          </Button>
                        ))}
                      </div>

                      {selectedSlot && (
                        <div className="mt-6 p-4 rounded-lg bg-muted">
                          <p className="text-sm text-center mb-3">
                            Orario selezionato: <strong>{selectedSlot}</strong> - Fine prevista: <strong>
                              {(() => {
                                const [h, m] = selectedSlot.split(':').map(Number);
                                const endMinutes = h * 60 + m + totalDuration;
                                return `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
                              })()}
                            </strong>
                          </p>
                          <Button
                            size="lg"
                            onClick={handleConfirmBooking}
                            disabled={bookingSlot !== null}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold"
                          >
                            {bookingSlot ? "Prenotazione in corso..." : "Conferma Prenotazione"}
                          </Button>
                          <p className="text-xs text-destructive font-medium text-center mt-2">
                            NB: Le prenotazioni non possono essere modificate o annullate a meno di 24 ore dall'orario previsto.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  <div className="mt-6 flex gap-3">
                    <Button variant="outline" onClick={goToPrevStep} className="flex-1">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <Button size="lg" variant="secondary" className="w-full" onClick={() => navigate("/#contatti")}>
                      <Phone className="w-4 h-4 mr-2" />
                      L'orario che desideravi è occupato? Chiamami!
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <BottomNav isAuthenticated={true} />
    </div>
  );
};

export default Prenota;
