import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import { Sparkles, Loader2, Languages } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const { t, toggle } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = () => {
    const redirectUrl = window.location.origin + "/auth-callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 relative bg-indigo-600 text-white p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-10 start-10 w-80 h-80 rounded-full bg-teal-400 blur-3xl" />
          <div className="absolute bottom-10 end-10 w-96 h-96 rounded-full bg-indigo-300 blur-3xl" />
        </div>
        <Link to="/" className="relative flex items-center gap-2 w-fit">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-xl">{t("app_name")}</span>
        </Link>
        <div className="relative">
          <h2 className="font-display font-bold text-4xl leading-tight mb-4">
            {t("hero_title")}
          </h2>
          <p className="text-indigo-100 text-base max-w-md">{t("hero_subtitle")}</p>
        </div>
        <div className="relative text-xs text-indigo-200">© 2026 {t("app_name")}</div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10 bg-white">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-display font-bold text-lg">{t("app_name")}</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={toggle} data-testid="lang-toggle" className="ms-auto">
              <Languages className="w-4 h-4 me-1" />
              {t("lang_toggle")}
            </Button>
          </div>
          <h1 className="font-display text-3xl font-bold" data-testid="login-title">{t("login_title")}</h1>
          <p className="text-gray-500 mt-2 text-sm">{t("login_subtitle")}</p>

          <Button
            variant="outline"
            className="w-full mt-8 h-11 rounded-lg border-gray-300 hover:bg-gray-50"
            onClick={googleLogin}
            data-testid="google-login-btn"
          >
            <svg className="w-5 h-5 me-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            {t("form_google")}
          </Button>

          <div className="relative my-6">
            <Separator />
            <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 bg-white px-2 w-fit mx-auto top-1/2 -translate-y-1/2">
              {t("form_or")}
            </span>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("form_email")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <Label htmlFor="password">{t("form_password")}</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-11"
                data-testid="login-password-input"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              data-testid="login-submit-btn"
            >
              {loading && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {t("form_login_btn")}
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-gray-600">
            {t("form_no_account")}{" "}
            <Link to="/register" className="text-indigo-600 font-medium hover:underline" data-testid="goto-register">
              {t("nav_signup")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
