import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { Button } from "./ui/button";
import {
  LayoutDashboard,
  Upload,
  FileText,
  LayoutTemplate,
  Settings,
  LogOut,
  Languages,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { t, toggle, lang } = useLang();
  const location = useLocation();
  const navigate = useNavigate();

  const nav = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav_dashboard"), testId: "nav-dashboard" },
    { to: "/upload", icon: Upload, label: t("nav_upload"), testId: "nav-upload" },
    { to: "/documents", icon: FileText, label: t("nav_documents"), testId: "nav-documents" },
    { to: "/templates", icon: LayoutTemplate, label: t("nav_templates"), testId: "nav-templates" },
    { to: "/settings", icon: Settings, label: t("nav_settings"), testId: "nav-settings" },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-900 flex">
      {/* Sidebar */}
      <aside
        className="hidden lg:flex w-64 flex-col border-e border-gray-200 bg-white"
        data-testid="app-sidebar"
      >
        <div className="h-16 flex items-center gap-2 px-6 border-b border-gray-200">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-xl text-gray-900">
            {t("app_name")}
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                data-testid={item.testId}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 p-4 space-y-2">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9">
              <AvatarImage src={user?.picture} alt={user?.name} />
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid="user-name">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-xs" data-testid="user-plan">
              {user?.plan === "free" ? "Free" : "Pro"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggle}
              data-testid="lang-toggle"
              className="h-8 px-2 text-xs"
            >
              <Languages className="w-3.5 h-3.5 me-1" />
              {t("lang_toggle")}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-gray-600 hover:text-red-600"
            onClick={handleLogout}
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4 me-2" />
            {t("nav_logout")}
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-lg">{t("app_name")}</span>
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={toggle} data-testid="lang-toggle-mobile">
            <Languages className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-white border-t border-gray-200 flex items-center justify-around z-40">
        {nav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs ${
                active ? "text-indigo-600" : "text-gray-500"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Main */}
      <main className="flex-1 min-w-0 lg:ms-0 pt-14 lg:pt-0 pb-16 lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
