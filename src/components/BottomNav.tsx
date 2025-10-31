import { useNavigate, useLocation } from "react-router-dom";
import { Home, Calendar, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BottomNavProps {
  isAuthenticated?: boolean;
  isOwner?: boolean;
}

const BottomNav = ({ isAuthenticated = false, isOwner = false }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Sempre mostra home e prenota/menù basandosi su isOwner
  const navItems = [
    {
      label: "Home",
      icon: Home,
      path: "/",
      show: true,
    },
    {
      label: isOwner ? "Menù" : "Prenota",
      icon: Calendar,
      path: isOwner ? "/proprietario" : "/prenota",
      show: true,
    },
    // Mostra Appuntamenti solo se autenticato E NON proprietario
    ...(isAuthenticated && !isOwner ? [{
      label: "Appuntamenti",
      icon: Clock,
      path: "/miei-appuntamenti",
      show: true,
    }] : []),
    // Mostra Accedi solo se NON autenticato
    ...(!isAuthenticated ? [{
      label: "Accedi",
      icon: User,
      path: "/auth",
      show: true,
    }] : []),
  ];

  const visibleItems = navItems.filter(item => item.show);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Button
                key={item.path}
                variant="ghost"
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center h-full flex-1 gap-1 rounded-none hover:bg-accent/10 ${
                  isActive ? "text-accent" : "text-muted-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-accent" : ""}`} />
                <span className={`text-xs font-medium ${isActive ? "text-accent" : ""}`}>
                  {item.label}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
