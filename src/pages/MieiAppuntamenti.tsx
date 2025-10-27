import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { Scissors, LogOut, Calendar as CalendarIcon, Clock, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MieiAppuntamenti = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const timezone = "Europe/Rome";

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadAppointments(session.user.id);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadAppointments(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadAppointments = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", userId)
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

  const handleCancel = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "CANCELED" })
        .eq("id", appointmentId);

      if (error) throw error;

      toast.success("Appuntamento cancellato con successo");
      if (user) {
        loadAppointments(user.id);
      }
    } catch (error: any) {
      console.error("Error canceling appointment:", error);
      toast.error("Errore durante la cancellazione");
    } finally {
      setCancelingId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!user) return null;

  const futureAppointments = appointments.filter(apt => 
    apt.status === "CONFIRMED" && new Date(apt.start_time) > new Date()
  );
  
  const pastAppointments = appointments.filter(apt => 
    apt.status === "CANCELED" || new Date(apt.start_time) <= new Date()
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Scissors className="w-6 h-6" />
            <h1 className="text-2xl font-bold">ZIO FRANK</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/prenota")} className="text-primary-foreground hover:bg-primary-foreground/20">
              Prenota
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/20">
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">I tuoi appuntamenti</h2>
            <p className="text-muted-foreground">Gestisci le tue prenotazioni</p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Caricamento...</p>
            </div>
          ) : (
            <div className="space-y-8">
              <section>
                <h3 className="text-xl font-semibold mb-4">Prossimi appuntamenti</h3>
                {futureAppointments.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">
                        Non hai appuntamenti futuri
                      </p>
                      <Button onClick={() => navigate("/prenota")}>
                        Prenota ora
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {futureAppointments.map((apt) => {
                      const startTime = toZonedTime(new Date(apt.start_time), timezone);
                      return (
                        <Card key={apt.id}>
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="flex items-center gap-2">
                                  <CalendarIcon className="w-5 h-5" />
                                  {format(startTime, "EEEE, d MMMM yyyy", { locale: it })}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-2 mt-2">
                                  <Clock className="w-4 h-4" />
                                  {format(startTime, "HH:mm")} - 30 minuti
                                </CardDescription>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setCancelingId(apt.id)}
                              >
                                Cancella
                              </Button>
                            </div>
                          </CardHeader>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>

              {pastAppointments.length > 0 && (
                <section>
                  <h3 className="text-xl font-semibold mb-4">Storico</h3>
                  <div className="grid gap-4">
                    {pastAppointments.map((apt) => {
                      const startTime = toZonedTime(new Date(apt.start_time), timezone);
                      return (
                        <Card key={apt.id} className="opacity-60">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <CalendarIcon className="w-5 h-5" />
                              {format(startTime, "EEEE, d MMMM yyyy", { locale: it })}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              {format(startTime, "HH:mm")} - {apt.status === "CANCELED" ? "Cancellato" : "Completato"}
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={cancelingId !== null} onOpenChange={() => setCancelingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Conferma cancellazione
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler cancellare questo appuntamento? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelingId && handleCancel(cancelingId)}>
              Conferma cancellazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MieiAppuntamenti;
