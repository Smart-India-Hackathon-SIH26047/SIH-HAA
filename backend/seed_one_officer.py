from app.database import SessionLocal
from app.models import Officer

db = SessionLocal()
officer = Officer(
    name="Test Counsellor",
    role="counsellor",
    district="Jaipur",
)
db.add(officer)
db.commit()
db.refresh(officer)
print("Created officer:", officer.id)
db.close()