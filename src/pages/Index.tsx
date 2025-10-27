import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Scissors, Clock, MapPin, Phone, Mail } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
              <Scissors className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">ZIO FRANK</h1>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => navigate("/prenota")} 
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
            >
              Prenota Appuntamento
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate("/auth")}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              Accedi
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 py-24 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
              <Scissors className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-5xl font-bold mb-6">Benvenuto da ZIO FRANK</h2>
            <p className="text-xl mb-8 text-primary-foreground/90">
              Il tuo barbiere di fiducia a Roma. Stile, precisione e professionalità dal 1985.
            </p>
            <Button 
              size="lg"
              onClick={() => navigate("/prenota")}
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6 h-auto font-bold"
            >
              Prenota il tuo appuntamento
            </Button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent"></div>
      </section>

      {/* Info Cards */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-bold mb-2">Orari di Apertura</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Lun-Ven:</strong> 09:00 - 13:00, 15:00 - 19:00</p>
                <p><strong>Sabato:</strong> 09:00 - 13:00</p>
                <p><strong>Domenica:</strong> Chiuso</p>
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
                Via Roma 1<br />
                00100 Roma<br />
                <a 
                  href="https://maps.google.com/?q=Via+Roma+1+Roma" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
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
                  <a href="tel:+390612345678" className="hover:text-accent">
                    +39 06 1234567
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <a href="mailto:info@ziofrank.it" className="hover:text-accent">
                    info@ziofrank.it
                  </a>
                </p>
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
          <Button 
            size="lg"
            onClick={() => navigate("/prenota")}
            className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
          >
            Prenota ora
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-8">
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
    </div>
  );
};

export default Index;
