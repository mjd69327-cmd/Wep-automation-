import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../context/TranslationContext";
import { Button } from "../components/ui/button";
import { api } from "../utils/api";
import { toast } from "sonner";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreHorizontal,
  Trash2,
  Download,
  Eye,
  RefreshCw,
  FileSpreadsheet,
  Table as TableIcon,
  Upload as UploadIcon,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";

export default function Documents() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [sheetsConnected, setSheetsConnected] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    try {
      const [docRes, sheetsRes] = await Promise.all([
        api.get("/documents"),
        api.get("/oauth/sheets/status").catch(() => ({ data: { connected: false } }))
      ]);
      setDocuments(docRes.data);
      setSheetsConnected(sheetsRes.data?.connected || false);
    } catch (e) {
      console.error(e);
      toast.error(lang === "ar" ? "فشل تحميل المستندات" : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleSelectAll = () => {
    if (selected.size === documents.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(documents.map((d) => d.document_id)));
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const exportExcel = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return toast.error(lang === "ar" ? "اختر مستنداً واحداً على الأقل" : "Select at least one document");
    try {
      const res = await api.post("/export/excel", { document_ids: ids }, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "dataflow_export.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(lang === "ar" ? "تم تصدير ملف Excel بنجاح" : "Excel exported successfully");
    } catch {
      toast.error("Export failed");
    }
  };

  const exportCsv = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return toast.error(lang === "ar" ? "اختر مستنداً واحداً على الأقل" : "Select at least one document");
    try {
      const res = await api.post("/export/csv", { document_ids: ids }, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "dataflow_export.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(lang === "ar" ? "تم تصدير ملف CSV بنجاح" : "CSV exported successfully");
    } catch {
      toast.error("Export failed");
    }
  };

  const exportSheets = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return toast.error(lang === "ar" ? "اختر مستنداً واحداً على الأقل" : "Select at least one document");
    if (!sheetsConnected) {
      toast.error(lang === "ar" ? "اربط حساب Google من الإعدادات" : "Connect Google account in Settings");
      navigate("/settings");
      return;
    }
    setExporting(true);
    try {
      const { data } = await api.post("/export/sheets", { document_ids: ids });
      toast.success(lang === "ar" ? "تم التصدير إلى Google Sheets" : "Exported to Google Sheets");
      window.open(data.url, "_blank");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(lang === "ar" ? `حذف ${ids.length} مستنداً؟` : `Delete ${ids.length} documents?`)) return;
    try {
      const { data } = await api.post("/documents_bulk/delete", { document_ids: ids });
      toast.success(lang === "ar" ? `تم حذف ${data.deleted}` : `Deleted ${data.deleted}`);
      setSelected(new Set());
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const bulkReprocess = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      const { data } = await api.post("/documents_bulk/reprocess", { document_ids: ids });
      toast.success(lang === "ar" ? `أعدنا معالجة ${data.queued}` : `Reprocessing ${data.queued}`);
      setSelected(new Set());
      load();
    } catch {
      toast.error("Reprocess failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav_documents")}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? "إدارة ومراجعة وتصدير المستندات المستخرجة" : "Manage, review and export your extracted documents"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={bulkReprocess} data-testid="bulk-reprocess-btn">
                <RefreshCw className="w-4 h-4 me-2" />
                {lang === "ar" ? "إعادة معالجة" : "Reprocess"} ({selected.size})
              </Button>
              <Button variant="outline" size="sm" onClick={bulkDelete} className="text-red-600 hover:text-red-700" data-testid="bulk-delete-btn">
                <Trash2 className="w-4 h-4 me-2" />
                {t("common_delete")} ({selected.size})
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm" disabled={exporting} data-testid="export-dropdown">
                    <Download className="w-4 h-4 me-2" />
                    {lang === "ar" ? "تصدير المحدد" : "Export Selected"} ({selected.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportExcel} data-testid="export-excel">
                    <FileSpreadsheet className="w-4 h-4 me-2 text-emerald-600" /> {t("review_export_excel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCsv} data-testid="export-csv">
                    <TableIcon className="w-4 h-4 me-2 text-blue-600" /> {t("review_export_csv")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportSheets} data-testid="export-sheets">
                    <FileSpreadsheet className="w-4 h-4 me-2" /> {t("review_export_sheets")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <Button onClick={() => navigate("/upload")} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            <UploadIcon className="w-4 h-4 me-2" />
            {t("dash_upload_new")}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="w-12">
                <Checkbox 
                  checked={documents.length > 0 && selected.size === documents.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>{lang === "ar" ? "اسم الملف" : "Filename"}</TableHead>
              <TableHead>{lang === "ar" ? "القالب" : "Template"}</TableHead>
              <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
              <TableHead>{lang === "ar" ? "التاريخ" : "Date"}</TableHead>
              <TableHead className="text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {lang === "ar" ? "جاري التحميل..." : "Loading..."}
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>{lang === "ar" ? "لا توجد مستندات مرفوعة بعد" : "No documents uploaded yet"}</p>
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => {
                const isSelected = selected.has(doc.document_id);
                return (
                  <TableRow key={doc.document_id} className={isSelected ? "bg-indigo-50/50" : undefined}>
                    <TableCell>
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(doc.document_id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="truncate max-w-xs">{doc.original_filename}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lang === "ar" ? doc.template_name_ar : doc.template_name_en}
                    </TableCell>
                    <TableCell>
                      <Badge variant={doc.status === "completed" || doc.status === "reviewed" ? "success" : "secondary"}>
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(doc.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-end">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/review/${doc.document_id}`)}
                      >
                        <Eye className="w-4 h-4 me-1" />
                        {t("dash_review")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
