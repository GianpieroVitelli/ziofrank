import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Scissors, Clock, MapPin, Phone, Mail, Megaphone, Instagram } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { format } from "date-fns";
import { it } from "date-fns/locale";
interface News {
  id: string;
  title: string;
  body: string;
  is_featured: boolean;
  published_at: string;
}
interface ShopSettings {
  shop_name: string;
  description: string;
  address: string;
  phone: string;
  email_from: string;
  open_hours: any;
  social_links?: any;
}
const Index = () => {
  const navigate = useNavigate();
  const [news, setNews] = useState<News[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    loadData();
    checkUserRole();
    
    // Scroll to section if hash is present
    if (window.location.hash === '#contatti') {
      setTimeout(() => {
        document.getElementById('contatti')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, []);

  const checkUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsAuthenticated(true);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      
      if (roles && roles.some(r => r.role === "PROPRIETARIO")) {
        setIsOwner(true);
      }
    }
    setIsCheckingAuth(false);
  };
  const loadData = async () => {
    try {
      // Load published news
      const {
        data: newsData
      } = await supabase.from("news").select("*").eq("status", "PUBLISHED").order("published_at", {
        ascending: false
      });
      if (newsData) setNews(newsData);

      // Load shop settings
      const {
        data: settingsData
      } = await supabase.from("shop_settings").select("*").single();
      if (settingsData) setSettings(settingsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoadingSettings(false);
    }
  };
  const featuredNews = news.find(n => n.is_featured);
  
  const formatOpenHours = () => {
    if (!settings?.open_hours) return null;
    
    const dayNames: { [key: string]: string } = {
      mon: "Lunedì",
      tue: "Martedì", 
      wed: "Mercoledì",
      thu: "Giovedì",
      fri: "Venerdì",
      sat: "Sabato",
      sun: "Domenica"
    };

    const hours = settings.open_hours;
    const daysOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    
    // Group consecutive days with same hours
    const groupedHours: Array<{ days: string; hours: string[][] }> = [];
    
    for (let i = 0; i < daysOrder.length; i++) {
      const day = daysOrder[i];
      const dayHours = hours[day] || [];
      
      if (dayHours.length === 0) {
        groupedHours.push({ days: dayNames[day], hours: [] });
        continue;
      }
      
      // Check if we can group with previous day
      const prevGroup = groupedHours[groupedHours.length - 1];
      const hoursMatch = prevGroup && 
        JSON.stringify(prevGroup.hours) === JSON.stringify(dayHours);
      
      if (hoursMatch && prevGroup.hours.length > 0) {
        // Extend the range
        const lastDayInGroup = prevGroup.days.split('-').pop()?.trim() || '';
        const firstDayInGroup = prevGroup.days.split('-')[0].trim();
        prevGroup.days = `${firstDayInGroup}-${dayNames[day]}`;
      } else {
        groupedHours.push({ days: dayNames[day], hours: dayHours });
      }
    }
    
    return groupedHours.map((group, idx) => (
      <p key={idx}>
        <strong>{group.days}:</strong>{' '}
        {group.hours.length === 0 
          ? 'Chiuso' 
          : group.hours.map(slot => `${slot[0]} - ${slot[1]}`).join(', ')}
      </p>
    ));
  };

  return <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
              <Scissors className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">ZIO FRANK</h1>
          </div>
          <Button size="sm" onClick={() => navigate("/prenota")} className="bg-accent text-accent-foreground hover:bg-accent/90 text-sm">
            Prenota Appuntamento
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 text-center py-[60px]">
          <div className="max-w-3xl mx-auto">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
              <Scissors className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-5xl font-bold mb-6">
              {isLoadingSettings ? "ZIO FRANK" : `Benvenuto da ${settings?.shop_name || "ZIO FRANK"}`}
            </h2>
            <p className="text-xl mb-8 text-primary-foreground/90">
              {isLoadingSettings ? "\u00A0" : (settings?.description || "Il tuo barbiere di fiducia a Roma. Stile, precisione e professionalità dal 1985.")}
            </p>
            <Button size="lg" onClick={() => navigate("/prenota")} className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6 h-auto font-bold">
              Prenota il tuo appuntamento
            </Button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent"></div>
      </section>


      {/* News Section */}
      {news.length > 0 && <section className="container mx-auto px-4 py-[8px]">
          <h2 className="text-3xl font-bold mb-6 text-center">Notizie e Avvisi</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {news.slice(0, 6).map(item => <Card key={item.id} className="hover:shadow-lg transition-shadow bg-accent/15 border-accent/20">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                    {item.body}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(item.published_at), "d MMMM yyyy", {
                locale: it
              })}
                  </p>
                </CardContent>
              </Card>)}
          </div>
        </section>}

      {/* Info Cards */}
      <section id="contatti" className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-bold mb-2">Orari di Apertura</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                {isLoadingSettings ? (
                  <>
                    <p><strong>Lun-Ven:</strong> 09:00 - 13:00, 15:00 - 19:00</p>
                    <p><strong>Sabato:</strong> 09:00 - 13:00</p>
                    <p><strong>Domenica:</strong> Chiuso</p>
                  </>
                ) : (
                  formatOpenHours()
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-bold mb-2">Dove Siamo</h3>
              <p className="text-sm text-muted-foreground">
                {settings?.address || "Via Roma 1, 00100 Roma"}<br />
                <a href={`https://maps.google.com/?q=${encodeURIComponent(settings?.address || "Via Roma 1 Roma")}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  Vedi sulla mappa →
                </a>
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mb-4">
                <Phone className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-bold mb-2">Contatti</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <a href={`tel:${settings?.phone || "+390612345678"}`} className="hover:text-accent">
                    {settings?.phone || "+39 06 1234567"}
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${settings?.email_from || "info@ziofrank.it"}`} className="hover:text-accent">
                    {settings?.email_from || "info@ziofrank.it"}
                  </a>
                </p>
                {settings?.social_links?.instagram && (
                  <p className="flex items-center gap-2">
                    <Instagram className="w-4 h-4" />
                    <a href={settings.social_links.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                      Instagram
                    </a>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto per un nuovo look?</h2>
          <p className="text-muted-foreground mb-6">
            Prenota il tuo appuntamento in pochi click. Semplice, veloce, garantito.
          </p>
          <Button size="lg" onClick={() => navigate("/prenota")} className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
            Prenota ora
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-8 pb-20">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Scissors className="w-6 h-6" />
            <span className="text-xl font-bold">ZIO FRANK</span>
          </div>
          <p className="text-sm text-primary-foreground/80">
            © 2025 ZIO FRANK. Tutti i diritti riservati.
          </p>
        </div>
      </footer>

      <BottomNav isAuthenticated={isAuthenticated} isOwner={isOwner} />
    </div>;
};
export default Index;