from app.database import Base, engine
from app.models import Person, Officer, CheckIn, Score, CaseEvent, Alert, AccessLog

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print("All tables created successfully.")