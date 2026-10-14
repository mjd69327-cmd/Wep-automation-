import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/apiClient";
import { useLang } from "../context/LangContext";
import AppShell from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import {
  FileText,
  Receipt,
  ShoppingCart,
  IdCard,
  Plus,
  Trash2,
  LayoutTemplate,
  Upload as UploadIcon,
} from "lucide-react";

const iconMap = { FileText, Receipt, ShoppingCart, IdCard };

const defaultField = () => ({
  key: "",
  label_en: "",
  label_ar: "",
  type: "string",
  required: false,
});

export default function Templates() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState({ presets: [], custom: [] });
  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [fields, setFields] = useState([defaultField()]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/templates");
      setTemplates(data);
    } catch {}
  };
  useEffect(() => {
    load();
  }, []);

  const addField = () => setFields([...fields, defaultField()]);
  const removeField = (i) => setFields(fields.filter((_, idx) => idx !== i));
  const updateField = (i, k, v) => {
    const copy = [...fields];
    copy[i] = { ...copy[i], [k]: v };
    setFields(copy);
  };

  const save = async () => {
    if (!nameEn || !nameAr) {
      toast.error(lang === "ar" ? "املأ الاسم بالعربية والإنجليزية" : "Fill both names");
      return;
    }
    const cleaned = fields.filter((f) => f.key && f.label_en);
    if (cleaned.length === 0) {
      toast.error(lang === "ar" ? "أضف حقلاً واحداً على الأقل" : "Add at least one field");
      return;
    }
    setSaving(true);
    try {
      await api.post("/templates", { name_en: nameEn, name_ar: nameAr, fields: cleaned });
      toast.success(lang === "ar" ? "تم حفظ القالب" : "Template saved");
      setOpen(false);
      setNameEn("");
      setNameAr("");
      setFields([defaultField()]);
      load();
    } catch (e) {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    try {
      await api.delete(`/templates/${id}`);
      toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const useTemplate = (id) => navigate(`/upload?template=${id}`);

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="templates-title">
              {t("templates_title")}
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              {lang === "ar" ? "اختر قالباً جاهزاً أو ابنِ قالبك الخاص" : "Pick a ready template or build your own"}
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="create-template-btn">
                <Plus className="w-4 h-4 me-2" />
                {t("templates_create")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>{t("template_builder_title")}</DialogTitle>
                <DialogDescription>
                  {lang === "ar" ? "حدّد الحقول التي ترغب باستخراجها" : "Define fields you want extracted"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>{t("template_builder_name_en")}</Label>
                    <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="mt-1.5" data-testid="tpl-name-en" />
                  </div>
                  <div>
                    <Label>{t("template_builder_name_ar")}</Label>
                    <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="mt-1.5" data-testid="tpl-name-ar" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("templates_fields")}</Label>
                    <Button size="sm" variant="outline" onClick={addField} data-testid="add-field-btn">
                      <Plus className="w-4 h-4 me-1" />
                      {t("template_builder_add_field")}
                    </Button>
                  </div>
                  {fields.map((f, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2" data-testid={`field-row-${i}`}>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <Input
                          placeholder={t("template_builder_field_key")}
                          value={f.key}
                          onChange={(e) => updateField(i, "key", e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                        />
                        <Input
                          placeholder={t("template_builder_field_label_en")}
                          value={f.label_en}
                          onChange={(e) => updateField(i, "label_en", e.target.value)}
                        />
                        <Input
                          placeholder={t("template_builder_field_label_ar")}
                          value={f.label_ar}
                          onChange={(e) => updateField(i, "label_ar", e.target.value)}
                        />
                        <Select value={f.type} onValueChange={(v) => updateField(i, "type", v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="currency">Currency</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Switch checked={f.required} onCheckedChange={(v) => updateField(i, "required", v)} />
                          <span>{t("template_builder_required")}</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeField(i)} className="text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("common_cancel")}</Button>
                <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="save-template-btn">
                  {saving ? "..." : t("template_builder_save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t("templates_presets")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {templates.presets.map((tpl) => (
              <TemplateCard key={tpl.template_id} tpl={tpl} onUse={useTemplate} isCustom={false} t={t} lang={lang} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t("templates_custom")}</h2>
          {templates.custom.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
              <LayoutTemplate className="w-10 h-10 text-gray-400 mx-auto" />
              <p className="mt-2 text-sm text-gray-600">
                {lang === "ar" ? "لم تنشئ قوالب مخصصة بعد" : "You haven't created any custom templates"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {templates.custom.map((tpl) => (
                <TemplateCard key={tpl.template_id} tpl={tpl} onUse={useTemplate} onDelete={del} isCustom={true} t={t} lang={lang} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function TemplateCard({ tpl, onUse, onDelete, isCustom, t, lang }) {
  const Icon = iconMap[tpl.icon] || LayoutTemplate;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow" data-testid={`tpl-card-${tpl.template_id}`}>
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Icon className="w-5 h-5 text-indigo-600" />
        </div>
        <Badge variant="outline" className="text-[10px]">
          {tpl.fields.length} {t("templates_fields")}
        </Badge>
      </div>
      <h3 className="mt-3 font-display font-semibold text-base">{lang === "ar" ? tpl.name_ar : tpl.name_en}</h3>
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        {tpl.fields.slice(0, 3).map((f) => (lang === "ar" ? f.label_ar : f.label_en)).join(" · ")}
        {tpl.fields.length > 3 && " ..."}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1" onClick={() => onUse(tpl.template_id)} data-testid={`use-tpl-${tpl.template_id}`}>
          <UploadIcon className="w-3.5 h-3.5 me-1" />
          {t("templates_use")}
        </Button>
        {isCustom && (
          <Button size="sm" variant="ghost" onClick={() => onDelete(tpl.template_id)} className="text-red-500">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
