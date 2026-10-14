import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { API } from "../lib/apiClient";
import { useLang } from "../context/LangContext";
import AppShell from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Download,
  FileSpreadsheet,
  Table as TableIcon,
  Loader2,
  Sparkles,
  Info,
  AlertTriangle,
} from "lucide-react";

export default function Review() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [template, setTemplate] = useState(null);
  const [extraction, setExtraction] = useState(null);
  const [values, setValues] = useState({});
  const [confidences, setConfidences] = useState({});
  const [bboxes, setBboxes] = useState({});
  const [hovered, setHovered] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sheetsConnected, setSheetsConnected] = useState(false);
  const [polling, setPolling] = useState(false);
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  const token = typeof window !== "undefined" ? localStorage.getItem("df_token") : null;
  const fileUrl = `${API}/documents/${id}/file${token ? `?auth=${encodeURIComponent(token)}` : ""}`;

  const load = async () => {
    try {
      const { data } = await api.get(`/documents/${id}`);
      setDoc(data.document);
      setTemplate(data.template);
      setExtraction(data.extraction);
      if (data.extraction?.fields) {
        const vals = {};
        const confs = {};
        const bbs = {};
        for (const [k, v] of Object.entries(data.extraction.fields)) {
          if (typeof v === "object" && v !== null) {
            vals[k] = v.value || "";
            confs[k] = v.confidence ?? null;
            bbs[k] = v.bbox || null;
          } else {
            vals[k] = v || "";
          }
        }
        setValues(vals);
        setConfidences(confs);
        setBboxes(bbs);
      }
      if (data.document.status === "pending" || data.document.status === "processing") {
        setPolling(true);
      } else {
        setPolling(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    api.get("/oauth/sheets/status").then((r) => setSheetsConnected(r.data.connected)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!polling) return;
    const i = setInterval(load, 3000);
    return () => clearInterval(i);
  }, [polling]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      for (const key of Object.keys(values)) {
        payload[key] = {
          value: values[key],
          confidence: confidences[key] ?? null,
          bbox: bboxes[key] ?? null,
        };
      }
      await api.put(`/documents/${id}/extraction`, { fields: payload });
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      load();
    } catch (e) {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  };

  const exportBlob = async (endpoint, filename) => {
    try {
      const resp = await api.post(endpoint, { document_ids: [id] }, { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Export failed");
    }
  };

  const exportSheets = async () => {
    if (!sheetsConnected) {
      toast.error(lang === "ar" ? "اربط حساب Google من الإعدادات" : "Connect Google account in Settings");
      navigate("/settings");
      return;
    }
    try {
      const { data } = await api.post("/export/sheets", { document_ids: [id] });
      toast.success("Exported to Google Sheets");
      window.open(data.url, "_blank");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Export failed");
    }
  };

  const confidenceBadge = (c) => {
    if (c == null) return null;
    const pct = Math.round(c * 100);
    let cls = "bg-green-50 text-green-700 border-green-200";
    if (pct < 50) cls = "bg-red-50 text-red-700 border-red-200";
    else if (pct < 80) cls = "bg-amber-50 text-amber-700 border-amber-200";
    return (
      <Badge variant="outline" className={`text-[10px] border ${cls}`}>
        {pct}%
      </Badge>
    );
  };

  const isLowConf = (c) => c != null && c < 0.5;

  const isImage = doc?.content_type?.startsWith("image/");
  const isPdf = doc?.content_type === "application/pdf";

  return (
    <AppShell>
      <div className="space-y-4" onKeyDown={onKeyDown}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate("/documents")} data-testid="back-btn">
              <ArrowLeft className="w-4 h-4 me-1 rtl:rotate-180" />
              {lang === "ar" ? "رجوع" : "Back"}
            </Button>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold truncate" data-testid="review-title">
                {doc?.original_filename || t("review_title")}
              </h1>
              <p className="text-xs text-gray-500">
                {template && (lang === "ar" ? template.name_ar : template.name_en)}{" "}
                {extraction?.detected_language && ` · ${t("review_detected_lang")}: ${extraction.detected_language}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="review-export-btn">
                  <Download className="w-4 h-4 me-2" />
                  {t("review_export")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => exportBlob("/export/excel", `${doc?.original_filename || "doc"}.xlsx`)} data-testid="single-export-excel">
                  <FileSpreadsheet className="w-4 h-4 me-2" /> {t("review_export_excel")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportBlob("/export/csv", `${doc?.original_filename || "doc"}.csv`)} data-testid="single-export-csv">
                  <TableIcon className="w-4 h-4 me-2" /> {t("review_export_csv")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportSheets} data-testid="single-export-sheets">
                  <FileSpreadsheet className="w-4 h-4 me-2" /> {t("review_export_sheets")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="save-review-btn">
              {saving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
              {t("review_save")}
            </Button>
          </div>
        </div>

        {polling && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3" data-testid="processing-banner">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <p className="text-sm text-amber-900">
              {lang === "ar" ? "نحن نستخرج البيانات الآن... سيتم تحديث الحقول خلال ثواني" : "Extracting data... fields will populate in seconds"}
            </p>
          </div>
        )}

        {doc?.status === "failed" && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm text-red-900">{doc.error || "Extraction failed"}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-14rem)] min-h-[500px]">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="h-10 bg-gray-50 border-b border-gray-200 px-4 flex items-center text-xs text-gray-500 font-medium">
              {lang === "ar" ? "المستند" : "Document"}
            </div>
            <div className="flex-1 overflow-auto relative bg-gray-100 p-4 flex items-start justify-center">
              {isImage && (
                <div className="relative inline-block">
                  <img
                    ref={imgRef}
                    src={fileUrl}
                    alt="document"
                    onLoad={(e) => setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
                    className="max-w-full h-auto rounded-lg shadow-sm bg-white"
                    data-testid="document-image"
                  />
                  {hovered && bboxes[hovered] && (
                    <div
                      className="absolute border-2 border-indigo-500 bg-indigo-500/10 rounded pointer-events-none bbox-pulse"
                      style={{
                        left: `${(bboxes[hovered][0] / 1000) * 100}%`,
                        top: `${(bboxes[hovered][1] / 1000) * 100}%`,
                        width: `${((bboxes[hovered][2] - bboxes[hovered][0]) / 1000) * 100}%`,
                        height: `${((bboxes[hovered][3] - bboxes[hovered][1]) / 1000) * 100}%`,
                      }}
                    />
                  )}
                </div>
              )}
              {isPdf && (
                <iframe
                  src={fileUrl}
                  title="document"
                  className="w-full h-full border-0 rounded-lg bg-white"
                  data-testid="document-pdf"
                />
              )}
              {!isImage && !isPdf && (
                <div className="text-gray-500 text-sm p-8 text-center">
                  {lang === "ar" ? "لا يمكن معاينة هذا النوع" : "Cannot preview this file type"}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="h-10 bg-gray-50 border-b border-gray-200 px-4 flex items-center justify-between text-xs text-gray-500">
              <span className="font-medium">{t("review_title")}</span>
              <span className="hidden sm:inline">{t("review_shortcut_hint")}</span>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {!template && (
                <div className="text-sm text-gray-500">{t("common_loading")}</div>
              )}
              {template?.fields.map((f, idx) => {
                const key = f.key;
                const c = confidences[key];
                const low = isLowConf(c);
                return (
                  <div
                    key={key}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                    className={`border rounded-xl p-3 field-highlight ${
                      hovered === key
                        ? "border-indigo-400 bg-indigo-50/40"
                        : low
                        ? "border-amber-200 bg-amber-50/30"
                        : "border-gray-200 bg-white"
                    }`}
                    data-testid={`field-${key}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor={`fld-${key}`} className="text-xs text-gray-600">
                        {lang === "ar" ? f.label_ar : f.label_en}
                        {f.required && <span className="text-red-500 ms-1">*</span>}
                      </Label>
                      <div className="flex items-center gap-1.5">
                        {low && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                        {confidenceBadge(c)}
                      </div>
                    </div>
                    <Input
                      id={`fld-${key}`}
                      value={values[key] || ""}
                      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                      className="h-9"
                      tabIndex={idx + 1}
                      data-testid={`input-${key}`}
                      placeholder={lang === "ar" ? "فارغ" : "Empty"}
                    />
                  </div>
                );
              })}
              <p className="text-[11px] text-gray-400 flex items-center gap-1 pt-2">
                <Info className="w-3 h-3" />
                {t("review_tap_bbox")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
