import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { API } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import AppShell from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { Mail, User, CreditCard, Zap, FileSpreadsheet, CheckCircle2, LogOut, Info, Crown, Sparkles, Loader2 } from "lucide-react";

export default function Settings() {
  const { user, logout, refresh } = useAuth();
  const { t, lang } = useLang();
  const [params] = useSearchParams();
  const [sheets, setSheets] = useState({ connected: false, configured: false });
  const [upgrading, setUpgrading] = useState(false);
  const [polling, setPolling] = useState(false);

  const loadSheets = async () => {
    try {
      const { data } = await api.get("/oauth/sheets/status");
      setSheets(data);
    } catch {}
  };

  useEffect(() => {
    loadSheets();
    if (params.get("sheets") === "connected") {
      toast.success(lang === "ar" ? "تم ربط حساب Google بنجاح" : "Google account connected");
    }
    if (params.get("payment") === "success") {
      const sessionId = params.get("session_id");
      if (sessionId) {
        setPolling(true);
        const check = async (tries = 0) => {
          try {
            const { data } = await api.get(`/payments/status/${sessionId}`);
            if (data.payment_status === "paid") {
              toast.success(lang === "ar" ? "تمت الترقية إلى Pro 🎉" : "Upgraded to Pro 🎉");
              refresh();
              setPolling(false);
              window.history.replaceState(null, "", "/settings");
              return;
            }
          } catch {}
          if (tries < 15) setTimeout(() => check(tries + 1), 2000);
          else setPolling(false);
        };
        check();
      }
    } else if (params.get("payment") === "cancel") {
      toast.info(lang === "ar" ? "تم إلغاء الدفع" : "Payment cancelled");
      window.history.replaceState(null, "", "/settings");
    }
    // eslint-disable-next-line
  }, []);

  const upgrade = async () => {
    setUpgrading(true);
    try {
      const { data } = await api.post("/payments/checkout", {
        lookup_key: "dataflow_pro_monthly",
        origin_url: window.location.origin,
      });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Checkout failed");
      setUpgrading(false);
    }
  };

  const usage = Math.min(100, Math.round(((user?.pages_used_month || 0) / (user?.pages_limit || 20)) * 100));

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("settings_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("settings_subtitle")}</p>
        </div>

        {/* Profile */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            <h2 className="font-semibold">{t("settings_profile")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-muted-foreground block text-xs">{t("auth_name")}</span>
              <span className="font-medium text-gray-900">{user?.name}</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-muted-foreground block text-xs">{t("auth_email")}</span>
              <span className="font-medium text-gray-900">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Plan + Usage */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <h2 className="font-semibold">{t("settings_plan")}</h2>
            </div>
            <Badge variant="outline" className={user?.plan === "pro" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"}>
              {user?.plan === "pro" ? (<><Crown className="w-3 h-3 me-1" />Pro</>) : "Free"}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                {t("settings_usage")}
              </span>
              <span className="font-medium">
                {user?.pages_used_month ?? 0} / {user?.pages_limit ?? 20}
              </span>
            </div>
            <Progress value={usage} className="h-2" />
          </div>
          {user?.plan !== "pro" && (
            <div className="mt-5 bg-gradient-to-br from-indigo-50 via-white to-teal-50 border border-indigo-200 rounded-xl p-4 relative overflow-hidden" data-testid="pro-upgrade-card">
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <h3 className="font-display font-bold text-lg">{lang === "ar" ? "ترقية إلى Pro" : "Upgrade to Pro"}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {lang === "ar"
                    ? "2,000 صفحة شهرياً، معالجة ذات أولوية، دعم مباشر"
                    : "2,000 pages/month, priority processing, direct support"}
                </p>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <span className="font-display text-3xl font-extrabold">$19</span>
                    <span className="text-sm text-gray-500 ms-1">/{lang === "ar" ? "شهرياً" : "mo"}</span>
                  </div>
                  <Button
                    onClick={upgrade}
                    disabled={upgrading || polling}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full"
                    data-testid="upgrade-pro-btn"
                  >
                    {(upgrading || polling) ? (
                      <>
                        <Loader2 className="w-4 h-4 me-2 animate-spin" />
                        {polling ? (lang === "ar" ? "جاري التأكيد..." : "Confirming...") : "..."}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 me-2" />
                        {lang === "ar" ? "ترقية الآن" : "Upgrade now"}
                      </>
                    )}
                  </Button>
                </div>
                <p className="mt-3 text-[11px] text-gray-500">
                  {lang === "ar"
                    ? "وضع اختبار Stripe — استخدم بطاقة 4242 4242 4242 4242 للتجربة"
                    : "Stripe test mode — use card 4242 4242 4242 4242 to try"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Google Sheets Integration */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold">{t("settings_sheets")}</h2>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{lang === "ar" ? "حساب Google Sheets" : "Google Sheets Account"}</p>
              <p className="text-xs text-muted-foreground">
                {sheets.connected 
                  ? (lang === "ar" ? "متصل بنجاح" : "Connected successfully") 
                  : (lang === "ar" ? "غير متصل حالياً" : "Not connected")}
              </p>
            </div>
            {sheets.connected ? (
              <Button variant="outline" size="sm" onClick={async () => {
                await api.post("/oauth/sheets/disconnect");
                loadSheets();
                toast.success(lang === "ar" ? "تم قطع الاتصال" : "Disconnected");
              }}>
                {lang === "ar" ? "قطع الاتصال" : "Disconnect"}
              </Button>
            ) : (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => {
                const { data } = await api.get(`/oauth/sheets/login?token=${localStorage.getItem("df_token")}`);
                window.location.href = data.url;
              }}>
                {lang === "ar" ? "ربط الحساب" : "Connect Account"}
              </Button>
            )}
          </div>
        </div>

        {/* Logout */}
        <div className="pt-4 flex justify-end">
          <Button variant="destructive" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 me-2" />
            {t("settings_logout")}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
