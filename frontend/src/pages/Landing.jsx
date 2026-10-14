import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLang } from "../context/LangContext";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Sparkles,
  Languages,
  ArrowRight,
  Zap,
  LayoutTemplate,
  Columns2,
  Table,
  FileSpreadsheet,
  BadgeCheck,
  Check,
  FileText,
  Receipt,
  ShoppingCart,
  IdCard,
  Play,
} from "lucide-react";

export default function Landing() {
  const { t, lang, toggle } = useLang();
  const navigate = useNavigate();

  const features = [
    { icon: Zap, title: t("feat_1_title"), desc: t("feat_1_desc"), color: "bg-indigo-50 text-indigo-600" },
    { icon: LayoutTemplate, title: t("feat_2_title"), desc: t("feat_2_desc"), color: "bg-teal-50 text-teal-600" },
    { icon: Columns2, title: t("feat_3_title"), desc: t("feat_3_desc"), color: "bg-amber-50 text-amber-600" },
    { icon: FileSpreadsheet, title: t("feat_4_title"), desc: t("feat_4_desc"), color: "bg-green-50 text-green-600" },
    { icon: Table, title: t("feat_5_title"), desc: t("feat_5_desc"), color: "bg-rose-50 text-rose-600" },
    { icon: BadgeCheck, title: t("feat_6_title"), desc: t("feat_6_desc"), color: "bg-violet-50 text-violet-600" },
  ];

  const templates = [
    { icon: FileText, label: lang === "ar" ? "فاتورة" : "Invoice" },
    { icon: Receipt, label: lang === "ar" ? "إيصال" : "Receipt" },
    { icon: ShoppingCart, label: lang === "ar" ? "أمر شراء" : "Purchase Order" },
    { icon: IdCard, label: lang === "ar" ? "بطاقة هوية" : "ID Card" },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-900">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-link">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl">{t("app_name")}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-gray-900">{t("nav_features")}</a>
            <a href="#pricing" className="hover:text-gray-900">{t("nav_pricing")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggle} data-testid="lang-toggle">
              <Languages className="w-4 h-4 me-1" />
              {t("lang_toggle")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")} data-testid="nav-login">
              {t("nav_login")}
            </Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => navigate("/register")} data-testid="nav-signup">
              {t("nav_signup")}
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 start-1/4 w-96 h-96 bg-indigo-200 rounded-full blur-3xl opacity-30" />
          <div className="absolute bottom-0 end-1/4 w-96 h-96 bg-teal-200 rounded-full blur-3xl opacity-30" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-24">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-6 border-indigo-200 bg-indigo-50 text-indigo-700" data-testid="hero-badge">
              <Sparkles className="w-3 h-3 me-1" />
              {t("hero_badge")}
            </Badge>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]" data-testid="hero-title">
              <span className="text-gradient-primary">{t("hero_title")}</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl">
              {t("hero_subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 rounded-full h-12 px-6"
                onClick={() => navigate("/register")}
                data-testid="hero-cta-primary"
              >
                {t("hero_cta_primary")}
                <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full h-12 px-6 border-gray-300"
                data-testid="hero-cta-secondary"
              >
                <Play className="w-4 h-4 me-2" />
                {t("hero_cta_secondary")}
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-6 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> 20 {lang === "ar" ? "صفحة مجاناً" : "free pages"}</div>
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> {lang === "ar" ? "لا بطاقة ائتمان" : "No credit card"}</div>
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> {lang === "ar" ? "عربي وإنجليزي" : "Arabic + English"}</div>
            </div>
          </div>

          <div className="mt-16 relative">
            <div className="rounded-2xl bg-white border border-gray-200 shadow-2xl shadow-indigo-900/10 overflow-hidden">
              <div className="h-10 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5 px-4">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="ms-4 text-xs text-gray-400">dataflow.app / review / inv-2026-0184</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 h-96">
                <div className="bg-gray-50 border-e border-gray-200 p-6 flex items-center justify-center">
                  <div className="w-full h-full bg-white border border-gray-200 rounded-lg p-6 shadow-sm relative">
                    <div className="text-xs text-gray-400 mb-3">INVOICE</div>
                    <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-48 bg-gray-100 rounded mb-6" />
                    <div className="h-3 w-full bg-gray-100 rounded mb-2" />
                    <div className="h-3 w-5/6 bg-gray-100 rounded mb-2" />
                    <div className="h-3 w-4/6 bg-gray-100 rounded mb-6" />
                    <div className="absolute bottom-6 start-6 end-6">
                      <div className="h-6 w-40 bg-indigo-100 border border-indigo-300 rounded" />
                      <div className="mt-2 text-[10px] text-indigo-600 font-medium">Total: 1,250.00 SAR</div>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  <div className="text-xs text-gray-400 font-medium">Extracted fields</div>
                  {[
                    { label: lang === "ar" ? "اسم المورد" : "Vendor name", v: "Tech Supplies LLC", c: "98%" },
                    { label: lang === "ar" ? "رقم الفاتورة" : "Invoice number", v: "INV-2026-0184", c: "95%" },
                    { label: lang === "ar" ? "التاريخ" : "Date", v: "2026-02-14", c: "99%" },
                    { label: lang === "ar" ? "المبلغ الإجمالي" : "Total amount", v: "1,250.00 SAR", c: "92%" },
                  ].map((f, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-indigo-300 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">{f.label}</div>
                        <Badge variant="outline" className="text-[10px] border-green-200 bg-green-50 text-green-700 h-5">{f.c}</Badge>
                      </div>
                      <div className="text-sm font-medium text-gray-900 mt-0.5">{f.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs text-gray-500 uppercase tracking-widest font-semibold mb-6">
            {lang === "ar" ? "قوالب جاهزة فور التسجيل" : "Ready templates on sign-up"}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {templates.map((t, i) => {
              const Icon = t.icon;
              return (
                <div key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className="font-medium text-sm">{t.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight" data-testid="features-title">
              {t("features_title")}
            </h2>
            <p className="mt-3 text-base text-gray-600">{t("features_subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-gray-300 transition-shadow animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-5`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight" data-testid="pricing-title">
              {t("pricing_title")}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-white border-2 border-indigo-200 rounded-2xl p-8 relative shadow-sm">
              <div className="absolute top-0 end-6 -translate-y-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                {lang === "ar" ? "موصى به" : "Recommended"}
              </div>
              <h3 className="font-display font-bold text-2xl">{t("pricing_free")}</h3>
              <p className="text-sm text-gray-500 mt-1">{t("pricing_free_desc")}</p>
              <div className="mt-6">
                <span className="font-display text-5xl font-extrabold">$0</span>
                <span className="text-gray-500 ms-2">/ {lang === "ar" ? "شهرياً" : "month"}</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm">
                {[lang === "ar" ? "20 صفحة شهرياً" : "20 pages per month",
                  lang === "ar" ? "جميع القوالب الجاهزة" : "All preset templates",
                  lang === "ar" ? "قوالب مخصصة" : "Custom templates",
                  lang === "ar" ? "تصدير Excel & CSV" : "Excel & CSV export",
                  lang === "ar" ? "تصدير Google Sheets" : "Google Sheets export",
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /><span>{s}</span></li>
                ))}
              </ul>
              <Button
                className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-11"
                onClick={() => navigate("/register")}
                data-testid="pricing-free-cta"
              >
                {t("pricing_cta_free")}
              </Button>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
              <h3 className="font-display font-bold text-2xl">{t("pricing_pro")}</h3>
              <p className="text-sm text-gray-500 mt-1">{lang === "ar" ? "للفرق والمحاسبين النشطين" : "For teams & active accountants"}</p>
              <div className="mt-6">
                <span className="font-display text-5xl font-extrabold text-gray-400">—</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm text-gray-600">
                {[lang === "ar" ? "صفحات غير محدودة" : "Unlimited pages",
                  lang === "ar" ? "رفع مجمع متقدم" : "Advanced bulk upload",
                  lang === "ar" ? "دعم أولوية" : "Priority support",
                  lang === "ar" ? "تكامل API" : "API integration",
                  lang === "ar" ? "فرق متعددة المستخدمين" : "Multi-user teams",
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-2"><Check className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /><span>{s}</span></li>
                ))}
              </ul>
              <Button variant="outline" className="w-full mt-8 rounded-full h-11" disabled data-testid="pricing-pro-cta">
                {t("pricing_cta_pro")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white border-t border-gray-200 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="font-display font-bold">{t("app_name")}</span>
          </div>
          <p className="text-sm text-gray-500">{t("footer_tagline")}</p>
        </div>
      </footer>
    </div>
  );
}
