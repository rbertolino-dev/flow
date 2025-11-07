import { MessageSquare, Send, Settings, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";

export function WhatsAppNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      label: "Conversas",
      icon: MessageSquare,
      path: "/whatsapp",
    },
    {
      label: "Disparos",
      icon: Send,
      path: "/broadcast-campaigns",
    },
    {
      label: "Templates",
      icon: FileText,
      path: "/settings",
      hash: "templates",
    },
    {
      label: "Configurações",
      icon: Settings,
      path: "/settings",
    },
  ];

  return (
    <nav className="border-b border-border/50 bg-[#1e1e1e]">
      <div className="flex overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => {
                if (item.hash) {
                  navigate(`${item.path}#${item.hash}`);
                } else {
                  navigate(item.path);
                }
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                isActive
                  ? "text-[#25d366] border-[#25d366]"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
