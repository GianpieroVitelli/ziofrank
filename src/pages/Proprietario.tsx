import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Scissors, LogOut, CalendarDays, Settings, Newspaper, Calendar, CalendarClock } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { CalendarManager } from "@/components/owner/CalendarManager";
import { ShopSettingsEditor } from "@/components/owner/ShopSettingsEditor";
import { NewsManager } from "@/components/owner/NewsManager";
import { AppointmentsList } from "@/components/owner/AppointmentsList";
const Proprietario = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "calendar" | "settings" | "news" | "appointments">("dashboard");
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

      // Check if user is owner
      const {
        data: roles
      } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (!roles || !roles.some(r => r.role === "PROPRIETARIO")) {
        navigate("/prenota");
        return;
      }
      setUser(session.user);
    };
    checkAuth();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };
  if (!user) return null;
  return <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Scissors className="w-6 h-6" />
            <h1 className="text-lg font-bold">ZIO FRANK - Dashboard Proprietario</h1>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/20">
            <LogOut className="w-4 h-4 mr-2" />
            Esci
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="max-w-7xl mx-auto">
          {activeView === "dashboard" && <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Dashboard Proprietario</h2>
                <p className="text-muted-foreground">Gestisci il tuo negozio</p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveView("appointments")}>
                  <CardHeader>
                    <CalendarDays className="w-12 h-12 mb-4 text-primary" />
                    <CardTitle>Appuntamenti</CardTitle>
                    <CardDescription>
                      Visualizza tutti gli appuntamenti prenotati in ordine cronologico.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full">Vedi Appuntamenti</Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveView("calendar")}>
                  <CardHeader>
                    <CalendarDays className="w-12 h-12 mb-4 text-primary" />
                    <CardTitle>Calendario Prenotazioni</CardTitle>
                    <CardDescription>
                      Visualizza, crea, modifica ed elimina appuntamenti. Gestisci BONUS e blocchi orari.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full">Apri Calendario</Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/workdays")}>
                  <CardHeader>
                    <CalendarClock className="w-12 h-12 mb-4 text-primary" />
                    <CardTitle>Modifica giorni lavorativi</CardTitle>
                    <CardDescription>
                      Gestisci aperture straordinarie, chiusure e blocca singoli orari.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">Gestisci Orari</Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveView("settings")}>
                  <CardHeader>
                    <Settings className="w-12 h-12 mb-4 text-primary" />
                    <CardTitle>Modifica Contenuti Home</CardTitle>
                    <CardDescription>
                      Aggiorna informazioni di contatto, descrizione, orari e link social.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">Modifica Impostazioni</Button>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-8">
                <NewsManager />
              </div>
            </>}

          {activeView === "calendar" && <>
              <div className="mb-4 md:mb-6 space-y-3 md:space-y-0 md:flex md:items-center md:gap-4">
                <Button variant="ghost" size="sm" onClick={() => setActiveView("dashboard")} className="text-xs md:text-sm mb-1 -ml-2">
                  ← Torna
                </Button>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Calendario Prenotazioni</h2>
              </div>
              <CalendarManager />
            </>}

          {activeView === "settings" && <>
              <div className="mb-4 md:mb-6 space-y-3 md:space-y-0 md:flex md:items-center md:gap-4">
                <Button variant="ghost" size="sm" onClick={() => setActiveView("dashboard")} className="text-xs md:text-sm mb-1 -ml-2">← Torna al menù
            </Button>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Impostazioni Negozio</h2>
              </div>
              <ShopSettingsEditor />
            </>}

          {activeView === "appointments" && <>
              <div className="mb-4 md:mb-6 space-y-3 md:space-y-0 md:flex md:items-center md:gap-4">
                <Button variant="ghost" size="sm" onClick={() => setActiveView("dashboard")} className="text-xs md:text-sm mb-1 -ml-2">
                  <Calendar className="w-4 h-4" />
                  Torna a menù
                </Button>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Tutti gli Appuntamenti</h2>
              </div>
              <AppointmentsList />
            </>}
        </div>
      </main>

      <BottomNav isAuthenticated={true} isOwner={true} />
    </div>;
};
export default Proprietario;