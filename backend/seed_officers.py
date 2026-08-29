from app.database import SessionLocal
from app.models import Officer

db = SessionLocal()

officers = [
    Officer(name="Priya Sharma", role="counsellor", district="Jaipur"),
    Officer(name="Ravi Kumar", role="counsellor", district="Jodhpur"),
    Officer(name="Anita Desai", role="district_officer", district="Jaipur"),
    Officer(name="Sunil Verma", role="admin", district="Jaipur"),
]

for officer in officers:
    db.add(officer)

db.commit()

for officer in officers:
    db.refresh(officer)
    print(f"{officer.role:16} {officer.district:10} {officer.id}")

db.close()