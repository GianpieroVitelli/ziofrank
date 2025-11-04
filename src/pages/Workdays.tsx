import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar, LogOut } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { WorkdaysManager } from "@/components/owner/WorkdaysManager";

const Workdays = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

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
    };

    checkAuth();

    const {
      data: { subscription }
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

  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6" />
            <h1 className="text-lg font-bold">Modifica giorni lavorativi</h1>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Esci
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/proprietario")}
              className="mb-1"
            >
              ← Torna al menù
            </Button>
            <h2 className="text-2xl font-bold mb-1">Gestione giorni lavorativi</h2>
            <p className="text-sm text-muted-foreground">
              Gestisci aperture straordinarie, chiusure e blocchi orari
            </p>
          </div>

          <WorkdaysManager />
        </div>
      </main>

      <BottomNav isAuthenticated={true} isOwner={true} />
    </div>
  );
};

export default Workdays;
