import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

# مسار مجلد البناء للواجهة الأمامية
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))
assets_path = os.path.join(frontend_dist, "assets")

# تقديم ملفات الأصول الثابتة إذا كانت موجودة
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if not os.path.exists(frontend_dist):
        return {"error": "Frontend build folder not found. Run npm run build."}
    
    target_path = os.path.join(frontend_dist, full_path)
    
    # إذا كان الملف المطلوبة موجوداً فعلياً (مثل صورة أو ملف JS/CSS فرعي)
    if full_path and os.path.exists(target_path) and os.path.isfile(target_path):
        return FileResponse(target_path)
    
    # وإلا يتم توجيه الطلب لصفحة index.html ليعمل نظام مسارات React Router
    index_file = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
        
    raise HTTPException(status_code=404, detail="Not Found")
