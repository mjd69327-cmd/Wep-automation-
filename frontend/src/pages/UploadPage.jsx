import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/apiClient";
import { useLang } from "../context/LangContext";
import AppShell from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import {
  UploadCloud,
  FileText,
  Receipt,
  ShoppingCart,
  IdCard,
  X,
  Loader2,
  Plus,
  CheckCircle2,
} from "lucide-react";

const iconMap = { FileText, Receipt, ShoppingCart, IdCard };

export default function Upload() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [templates, setTemplates] = useState({ presets: [], custom: [] });
  const [selected, setSelected] = useState(params.get("template") || null);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/templates");
        setTemplates(data);
        if (!selected && data.presets.length > 0) setSelected(data.presets[0].template_id);
      } catch (e) {
        toast.error("Failed to load templates");
      }
    })();
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(pdf|jpe?g|png|webp)$/i.test(f.name)
    );
    setFiles((prev) => [...prev, ...dropped]);
  };

  const onPick = (e) => {
    const picked = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...picked]);
    e.target.value = "";
  };

  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const start = async () => {
    if (!selected) {
      toast.error(lang === "ar" ? "اختر قالباً أولاً" : "Select a template first");
      return;
    }
    if (files.length === 0) return;
    setUploading(true);
    const results = [];
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("template_id", selected);
      try {
        const { data } = await api.post("/documents/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        results.push(data);
      } catch (e) {
        const detail = e?.response?.data?.detail || "Upload failed";
        toast.error(`${f.name}: ${detail}`);
      }
    }
    setUploading(false);
    if (results.length > 0) {
      toast.success(
        lang === "ar"
          ? `تم رفع ${results.length} ملف — بدأت المعالجة`
          : `Uploaded ${results.length} file(s) — processing started`
      );
      navigate("/documents");
    }
  };

  const allTemplates = [...(templates.presets || []), ...(templates.custom || [])];

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="upload-title">
            {t("upload_title")}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">{t("upload_subtitle")}</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-sm text-gray-700">{t("upload_select_template")}</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/templates")} data-testid="create-template-link">
              <Plus className="w-4 h-4 me-1" />
              {t("templates_create")}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allTemplates.map((tpl) => {
              const Icon = iconMap[tpl.icon] || FileText;
              const active = selected === tpl.template_id;
              return (
                <button
                  key={tpl.template_id}
                  onClick={() => setSelected(tpl.template_id)}
                  data-testid={`template-${tpl.template_id}`}
                  className={`text-start border rounded-xl p-4 transition-all ${
                    active
                      ? "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-500/10"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${active ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {active && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                  </div>
                  <div className="mt-3 font-medium text-sm">{lang === "ar" ? tpl.name_ar : tpl.name_en}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{tpl.fields.length} {t("templates_fields")}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          data-testid="upload-dropzone"
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragging ? "dropzone-active" : "border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/30"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={onPick}
            data-testid="file-input"
          />
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center">
            <UploadCloud className="w-8 h-8 text-indigo-600" />
          </div>
          <p className="mt-4 font-display font-semibold text-lg">{t("upload_drop_here")}</p>
          <p className="text-xs text-gray-500 mt-1">{t("upload_formats")}</p>
        </div>

        {files.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-3 p-3" data-testid={`queued-file-${i}`}>
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-gray-500">{(f.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t("status_pending")}</Badge>
                  <button
                    onClick={() => removeFile(i)}
                    className="w-7 h-7 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center"
                    data-testid={`remove-file-${i}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {files.length > 0 && (
          <div className="flex justify-end">
            <Button
              onClick={start}
              disabled={uploading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-11 px-6 shadow-lg shadow-indigo-500/20"
              data-testid="start-upload-btn"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  {t("upload_processing")}
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 me-2" />
                  {t("upload_button")}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
