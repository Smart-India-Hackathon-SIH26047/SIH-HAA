from app.database import SessionLocal
from app.data_access import create_person
 
db = SessionLocal()
person = create_person(
    db,
    pseudonym="P-TEST-01",
    language="hi",
    case_phase="investigation",
    district="Jaipur",
    state="Rajasthan",
)
print("Created person:", person.id)
db.close()
