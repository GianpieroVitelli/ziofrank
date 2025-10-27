import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Scissors } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
          <Scissors className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="mb-4 text-6xl font-bold text-primary">404</h1>
        <p className="mb-6 text-xl text-muted-foreground">
          Oops! Pagina non trovata
        </p>
        <Button onClick={() => navigate("/")} className="bg-accent text-accent-foreground hover:bg-accent/90">
          Torna alla home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
