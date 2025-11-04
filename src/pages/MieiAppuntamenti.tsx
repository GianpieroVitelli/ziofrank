import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { Scissors, LogOut, Calendar as CalendarIcon, Clock, AlertCircle, User, Edit, Save, X } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MieiAppuntamenti = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ name: string; phone: string | null; customer_photo: string | null } | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
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
      loadProfile(session.user.id);
      loadUserRole(session.user.id);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadAppointments(session.user.id);
        loadProfile(session.user.id);
        loadUserRole(session.user.id);
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

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, phone, customer_photo")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
      setEditName(data.name);
      setEditPhone(data.phone || "");

      // Load photo URL if exists
      if (data.customer_photo) {
        const { data: urlData } = await supabase.storage
          .from("customer-photos")
          .createSignedUrl(data.customer_photo, 3600);
        
        if (urlData?.signedUrl) {
          setPhotoUrl(urlData.signedUrl);
        }
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
    }
  };

  const loadUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setUserRole(data?.role || null);
    } catch (error: any) {
      console.error("Error loading user role:", error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: editName,
          phone: editPhone || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfile({ name: editName, phone: editPhone || null, customer_photo: profile?.customer_photo || null });
      setEditingProfile(false);
      toast.success("Profilo aggiornato con successo");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Errore nell'aggiornamento del profilo");
    }
  };

  const handleCancel = async (appointmentId: string) => {
    try {
      // Use RPC function to cancel with 24h validation
      const { data, error } = await supabase.rpc('cancel_appointment', {
        p_appointment_id: appointmentId
      });

      if (error) throw error;

      // Send cancellation email
      try {
        const { error: emailError } = await supabase.functions.invoke('send-cancellation', {
          body: { appointment_id: appointmentId }
        });
        
        if (emailError) {
          console.error("Failed to send cancellation email:", emailError);
        }
      } catch (emailError) {
        console.error("Error sending cancellation email:", emailError);
      }

      toast.success("Appuntamento cancellato con successo");
      if (user) {
        loadAppointments(user.id);
      }
    } catch (error: any) {
      console.error("Error canceling appointment:", error);
      toast.error(error.message || "Errore durante la cancellazione");
    } finally {
      setCancelingId(null);
    }
  };

  const canCancelAppointment = (startTime: string): boolean => {
    if (userRole === "PROPRIETARIO") return true;
    const appointmentTime = new Date(startTime);
    const now = new Date();
    const hoursDifference = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursDifference >= 24;
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
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
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

      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Area personale</h2>
            <p className="text-muted-foreground">Gestisci il tuo profilo e le tue prenotazioni</p>
          </div>

          {/* User Profile Section */}
          <Card className="mb-6 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Il tuo profilo
                </CardTitle>
                {!editingProfile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setEditingProfile(true)}
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" />
                    <span className="text-xs">Modifica</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-start gap-4 mb-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={photoUrl || undefined} alt={profile?.name} />
                  <AvatarFallback className="text-lg">
                    <User className="w-8 h-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  {editingProfile ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-name" className="text-xs">Nome</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Il tuo nome"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-phone" className="text-xs">Numero di telefono</Label>
                    <Input
                      id="edit-phone"
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+39 123 456 7890"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveProfile} size="sm" className="h-8 text-xs">
                      <Save className="w-3 h-3 mr-1" />
                      Salva
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setEditingProfile(false);
                        setEditName(profile?.name || "");
                        setEditPhone(profile?.phone || "");
                      }}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Annulla
                    </Button>
                  </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Nome</p>
                      <p className="text-sm font-medium">{profile?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefono</p>
                      <p className="text-sm font-medium">{profile?.phone || "—"}</p>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </CardContent>
          </Card>

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
                      const canCancel = canCancelAppointment(apt.start_time);
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
                                  {format(startTime, "HH:mm")} - 45 minuti
                                </CardDescription>
                              </div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setCancelingId(apt.id)}
                                        disabled={!canCancel}
                                      >
                                        Cancella
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  {!canCancel && (
                                    <TooltipContent>
                                      <p>L'annullamento non è disponibile nelle 24 ore che precedono l'appuntamento. Contatta il negozio.</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
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

      <BottomNav isAuthenticated={true} />

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
