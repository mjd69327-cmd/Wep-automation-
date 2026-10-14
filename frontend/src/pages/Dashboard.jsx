import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import AppShell from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  Upload,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

const statusMeta = (status, t) => {
  switch (status) {
    case "completed":
      return { label: t("status_completed"), color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 };
    case "reviewed":
      return { label: t("status_reviewed"), color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: CheckCircle2 };
    case "pending":
    case "processing":
      return { label: t("status_processing"), color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock };
    case "failed":
      return { label: t("status_failed"), color: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle };
    default:
      return { label: status, color: "bg-gray-50 text-gray-700 border-gray-200", icon: Clock };
  }
};

export default function Dashboard() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  const fetchStats = async () => {
    try {
      const { data } = await api.get("/dashboard/stats");
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const usagePct = stats ? Math.round((stats.pages_used / stats.pages_limit) * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="dashboard-title">
              {t("dashboard_welcome")}, {user?.name?.split(" ")[0] || "👋"}
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              {lang === "ar" ? "نظرة سريعة على نشاطك" : "Quick overview of your activity"}
            </p>
          </div>
          <Button
            onClick={() => navigate("/upload")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-11 px-5 shadow-lg shadow-indigo-500/20"
            data-testid="dashboard-upload-cta"
          >
            <Upload className="w-4 h-4 me-2" />
            {t("dashboard_cta")}
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={FileText}
            label={t("dashboard_stats_total")}
            value={stats?.total_documents ?? 0}
            color="indigo"
            testId="stat-total"
          />
          <StatCard
            icon={CheckCircle2}
            label={t("dashboard_stats_completed")}
            value={stats?.completed ?? 0}
            color="green"
            testId="stat-completed"
          />
          <StatCard
            icon={Clock}
            label={t("dashboard_stats_pending")}
            value={stats?.pending ?? 0}
            color="amber"
            testId="stat-pending"
          />
          <div className="bg-white border border-gray-200 rounded-2xl p-5" data-testid="stat-usage">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-teal-600" />
              </div>
              <Badge variant="outline" className="text-[10px]">
                {stats?.plan === "free" ? "Free" : "Pro"}
              </Badge>
            </div>
            <div className="text-xs text-gray-500 mt-2">{t("dashboard_stats_usage")}</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-display text-2xl font-bold">{stats?.pages_used ?? 0}</span>
              <span className="text-sm text-gray-500">/ {stats?.pages_limit ?? 20}</span>
            </div>
            <Progress value={usagePct} className="h-1.5 mt-3" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-xl">{t("dashboard_recent")}</h2>
            <Link
              to="/documents"
              className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
              data-testid="view-all-docs"
            >
              {lang === "ar" ? "عرض الكل" : "View all"}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!stats || stats.recent.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center" data-testid="dashboard-empty">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="font-display font-semibold text-lg">{t("dashboard_empty")}</h3>
              <Button onClick={() => navigate("/upload")} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full">
                <Upload className="w-4 h-4 me-2" />
                {t("dashboard_cta")}
              </Button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {stats.recent.map((d) => {
                  const meta = statusMeta(d.status, t);
                  const Icon = meta.icon;
                  return (
                    <li key={d.document_id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" data-testid={`recent-doc-${d.document_id}`}>
                          {d.original_filename}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {lang === "ar" ? d.template_name_ar : d.template_name_en} ·{" "}
                          {new Date(d.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className={`${meta.color} border text-xs`}>
                        <Icon className="w-3 h-3 me-1" />
                        {meta.label}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/review/${d.document_id}`)}
                        data-testid={`open-doc-${d.document_id}`}
                      >
                        {t("common_view")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, color, testId }) {
  const colorMap = {
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    teal: "bg-teal-50 text-teal-600",
  };
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5" data-testid={testId}>
      <div className={`w-10 h-10 rounded-xl ${colorMap[color]} flex items-center justify-center`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-xs text-gray-500 mt-4">{label}</div>
      <div className="font-display text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}
