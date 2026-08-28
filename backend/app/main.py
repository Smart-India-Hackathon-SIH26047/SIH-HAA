from fastapi import FastAPI
from app.routes.checkin import router as checkin_router

app = FastAPI()
app.include_router(checkin_router)

@app.get("/")
def read_root():
    return {"status": "running"}