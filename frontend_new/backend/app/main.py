from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.checkin import router as checkin_router
from app.routes.people import router as people_router
from app.routes.alerts import router as alerts_router
from app.routes.consent import router as consent_router
from app.routes.case_events import router as case_events_router
from app.ml_services import load_all_models
app = FastAPI()
load_all_models()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your real frontend URL before deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(checkin_router)
app.include_router(people_router)
app.include_router(alerts_router)
app.include_router(consent_router)
app.include_router(case_events_router)


@app.get("/")
def read_root():
    return {"status": "running"}