import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.checkin import router as checkin_router
from app.routes.people import router as people_router
from app.routes.alerts import router as alerts_router
from app.routes.consent import router as consent_router
from app.routes.case_events import router as case_events_router
from app.routes.support import router as support_router
from app.ml_services import load_all_models
app = FastAPI()
load_all_models()
# Browser origins allowed to call this API, comma-separated. Set it in the
# deployment environment to the real frontend URL, e.g.
#   CORS_ALLOW_ORIGINS=https://saathi.vercel.app,https://saathi-preview.vercel.app
#
# "*" is deliberately not accepted alongside credentials: the CORS spec forbids
# that pair, and browsers reject the response rather than falling back, so the
# previous wildcard would have failed in production the moment it mattered.
_cors_origins = [
    origin.strip().rstrip("/")
    for origin in os.environ.get("CORS_ALLOW_ORIGINS", "").split(",")
    if origin.strip() and origin.strip() != "*"
]
if not _cors_origins:
    # Local development only. Deployments must set CORS_ALLOW_ORIGINS.
    _cors_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]
    print(
        "[CORS] CORS_ALLOW_ORIGINS is not set; allowing local dev origins only. "
        "A deployed frontend will be blocked until this is set."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(checkin_router)
app.include_router(people_router)
app.include_router(alerts_router)
app.include_router(consent_router)
app.include_router(case_events_router)
app.include_router(support_router)


@app.get("/")
def read_root():
    return {"status": "running"}