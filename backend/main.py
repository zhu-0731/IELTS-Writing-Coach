from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routers import settings as settings_router
from routers import profile as profile_router
from routers import reset as reset_router
from routers import essays as essays_router
from routers import hints as hints_router
from routers import coach as coach_router

app = FastAPI(title="IELTS Writing Coach API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings_router.router)
app.include_router(profile_router.router)
app.include_router(reset_router.router)
app.include_router(essays_router.router)
app.include_router(hints_router.router)
app.include_router(coach_router.router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}
