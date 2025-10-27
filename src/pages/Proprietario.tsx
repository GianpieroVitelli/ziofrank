import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { Scissors, LogOut, Plus, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import BottomNav from "@/components/BottomNav";

const Proprietario = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const timezone = "Europe/Rome";

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user is owner
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (!roles || !roles.some(r => r.role === "PROPRIETARIO")) {
        navigate("/prenota");
        return;
      }

      setUser(session.user);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (selectedDate) {
      loadAppointments(selectedDate);
    }
  }, [selectedDate]);

  const loadAppointments = async (date: Date) => {
    try {
      setLoading(true);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error: any) {
      console.error("Error loading appointments:", error);
      toast.error("Errore nel caricamento degli appuntamenti");
    } finally {
      setLoading(false);
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
            <h1 className="text-2xl font-bold">ZIO FRANK - Dashboard Proprietario</h1>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/20">
            <LogOut className="w-4 h-4 mr-2" />
            Esci
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Gestione Appuntamenti</h2>
            <p className="text-muted-foreground">Visualizza e gestisci tutti gli appuntamenti</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Calendario</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={it}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    {selectedDate ? format(selectedDate, "EEEE, d MMMM yyyy", { locale: it }) : "Seleziona una data"}
                  </CardTitle>
                  <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuovo Appuntamento
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Caricamento...
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Nessun appuntamento per questa data
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appointments.map((apt) => {
                      const startTime = toZonedTime(new Date(apt.start_time), timezone);
                      return (
                        <div
                          key={apt.id}
                          className={`p-4 rounded-lg border ${
                            apt.is_bonus 
                              ? "bg-accent/10 border-accent" 
                              : apt.status === "CANCELED"
                              ? "bg-destructive/10 border-destructive"
                              : "bg-card"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">
                                {format(startTime, "HH:mm")} - {apt.client_name || "Cliente walk-in"}
                              </p>
                              {apt.client_email && (
                                <p className="text-sm text-muted-foreground">{apt.client_email}</p>
                              )}
                              {apt.client_phone && (
                                <p className="text-sm text-muted-foreground">{apt.client_phone}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {apt.is_bonus && (
                                <span className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground font-semibold">
                                  BONUS
                                </span>
                              )}
                              {apt.status === "CANCELED" && (
                                <span className="text-xs px-2 py-1 rounded-full bg-destructive text-destructive-foreground">
                                  CANCELLATO
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

export default Proprietario;
