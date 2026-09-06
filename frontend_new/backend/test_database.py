"""
Basic sanity tests for the database layer.
Run with: python test_database.py
"""
import time
import uuid
from sqlalchemy.exc import IntegrityError
from app.database import SessionLocal
from app.models import Person, Score
from app.data_access import create_person, create_score


def test_referential_integrity():
    db = SessionLocal()
    fake_person_id = uuid.uuid4()

    try:
        bad_score = Score(person_id=fake_person_id, value=0.5, band="watch")
        db.add(bad_score)
        db.commit()
        print("FAILED: insert succeeded when it should have been rejected.")
    except IntegrityError:
        db.rollback()
        print("PASSED: foreign key correctly rejected an invalid person_id.")
    finally:
        db.close()


def test_query_performance():
    db = SessionLocal()
    start = time.time()
    results = db.query(Score).filter(Score.band == "priority").all()
    elapsed = time.time() - start
    print(f"Query returned {len(results)} rows in {elapsed:.4f} seconds.")
    if elapsed > 1.0:
        print("WARNING: query took over 1 second — consider adding an index on scores.band.")
    else:
        print("PASSED: query performance looks fine.")
    db.close()


if __name__ == "__main__":
    print("Running referential integrity test...")
    test_referential_integrity()
    print()
    print("Running query performance test...")
    test_query_performance()