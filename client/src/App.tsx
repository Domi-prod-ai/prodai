import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import { isLoggedIn, logout, getUser, getCompany, setAuthData } from "@/lib/auth";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import GanttPage from "./pages/GanttPage";
import OrdersPage from "./pages/OrdersPage";
import MachinesPage from "./pages/MachinesPage";
import ImportPage from "./pages/ImportPage";
import ProductsPage from "./pages/ProductsPage";
import HelpPage from "./pages/HelpPage";
import SettingsPage from "./pages/SettingsPage";
import MoldsPage from "./pages/MoldsPage";
import MaintenancePage from "./pages/MaintenancePage";
import ReportsPage from "./pages/ReportsPage";
import TeamPage from "./pages/TeamPage";
import InviteAcceptPage from "./pages/InviteAcceptPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminPage from "./pages/AdminPage";
import FloorViewPage from "./pages/FloorViewPage";
import WelcomeModal from "./components/WelcomeModal";
import NotFound from "./pages/not-found";

const SUPERADMIN_EMAILS = ["fekete0410@gmail.com", "demo@prodai.hu"];

function AppLayout({ onLogout, onAdmin }: { onLogout: () => void; onAdmin: () => void }) {
  const user = getUser();
  const company = getCompany();
  const isSuperAdmin = user && SUPERADMIN_EMAILS.includes(user.email.toLowerCase());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <Router hook={useHashLocation}>
      <div className="dashboard-layout">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="mobile-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div className={`sidebar-wrapper${sidebarOpen ? " sidebar-open" : ""}` }>
          <Sidebar
            companyName={company?.name}
            userName={user?.name}
            onLogout={onLogout}
            onAdmin={isSuperAdmin ? onAdmin : undefined}
            onNavClick={() => setSidebarOpen(false)}
          />
        </div>
        <main className="main-scroll bg-background">
          {/* Mobile hamburger */}
          <button
            className="mobile-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menu megnyitasa"
            data-testid="button-hamburger"
          >
            <span /><span /><span />
          </button>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/gantt" component={GanttPage} />
            <Route path="/orders" component={OrdersPage} />
            <Route path="/machines" component={MachinesPage} />
            <Route path="/import" component={ImportPage} />
            <Route path="/products" component={ProductsPage} />
            <Route path="/help" component={HelpPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/molds" component={MoldsPage} />
            <Route path="/maintenance" component={MaintenancePage} />
            <Route path="/reports" component={ReportsPage} />
            <Route path="/team" component={TeamPage} />
            <Route path="/floor" component={FloorViewPage} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </Router>
  );
}

type AuthScreen = "login" | "register";
type AppScreen = "app" | "admin";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [appScreen, setAppScreen] = useState<AppScreen>("app");
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState<{ name: string; company: string } | null>(null);

  // Meghivo token detektálás a hash URL-ből
  const inviteToken = (() => {
    const hash = window.location.hash;
    const m = hash.match(/[?&]invite=([a-f0-9]{64})/i);
    return m ? m[1] : null;
  })();

  useEffect(() => { setLoggedIn(isLoggedIn()); }, []);

  function handleLogout() {
    logout();
    queryClient.clear();
    setLoggedIn(false);
    setAuthScreen("login");
    setAppScreen("app");
  }

  // Meghívó oldal (bejelentkezés előtt)
  if (!loggedIn && inviteToken) {
    return (
      <QueryClientProvider client={queryClient}>
        <InviteAcceptPage token={inviteToken} onSuccess={() => { window.location.hash = "#/"; setLoggedIn(true); }} />
      </QueryClientProvider>
    );
  }

  if (!loggedIn) {
    if (authScreen === "register") {
      return (
        <QueryClientProvider client={queryClient}>
          <RegisterPage
            onSuccess={(name?: string, company?: string) => {
              setLoggedIn(true);
              if (name && company) {
                setWelcomeUser({ name, company });
                setShowWelcome(true);
              }
            }}
            onGoLogin={() => setAuthScreen("login")}
          />
        </QueryClientProvider>
      );
    }
    return (
      <QueryClientProvider client={queryClient}>
        <LoginPage onSuccess={() => setLoggedIn(true)} onGoRegister={() => setAuthScreen("register")} />
      </QueryClientProvider>
    );
  }

  if (appScreen === "admin") {
    return (
      <QueryClientProvider client={queryClient}>
        <AdminPage onBack={() => setAppScreen("app")} />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout onLogout={handleLogout} onAdmin={() => setAppScreen("admin")} />
      <Toaster />
      {showWelcome && welcomeUser && (
        <WelcomeModal
          userName={welcomeUser.name}
          companyName={welcomeUser.company}
          onClose={() => { setShowWelcome(false); setWelcomeUser(null); }}
        />
      )}
    </QueryClientProvider>
  );
}
