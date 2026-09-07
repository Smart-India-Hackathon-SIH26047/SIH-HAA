"""
Gap 2 — GET /people, filterable by district and state.

Run: python -m tests.test_people_list    (from backend/)
"""

import sys
from datetime import datetime, timedelta

from tests.support import Check, fresh_db, http_client, make_person, make_score

from app.routes.people import router


def main():
    check = Check()
    db = fresh_db()
    client = http_client(router, db)

    def read_people(**params):
        """Go through the real HTTP layer so query parsing is covered too."""
        response = client.get("/people", params=params)
        assert response.status_code == 200, response.text
        return response.json()

    asha = make_person(db, "JPR-0001", district="Jaipur", state="Rajasthan")
    bimal = make_person(db, "JOD-0002", district="Jodhpur", state="Rajasthan")
    chandra = make_person(db, "PTN-0003", district="Patna", state="Bihar")
    never_scored = make_person(db, "JPR-0004", district="Jaipur", state="Rajasthan")

    # Asha has three scores; only the newest band should surface.
    base = datetime(2026, 9, 1, 10, 0, 0)
    make_score(db, asha, 20.0, "stable", created_at=base)
    make_score(db, asha, 55.0, "watch", created_at=base + timedelta(days=1))
    make_score(db, asha, 78.0, "elevated", created_at=base + timedelta(days=2))
    make_score(db, bimal, 91.0, "priority", created_at=base)
    make_score(db, chandra, 12.0, "stable", created_at=base)

    print("\n[unfiltered]")
    everyone = read_people()
    check.equals("returns every person", len(everyone), 4)
    by_pseudonym = {p["pseudonym"]: p for p in everyone}
    check.equals(
        "latest band wins, not the first or the highest",
        by_pseudonym["JPR-0001"]["band"],
        "elevated",
    )
    check.equals(
        "unscored person still appears",
        by_pseudonym["JPR-0004"]["band"],
        None,
    )
    check.equals("state included", by_pseudonym["PTN-0003"]["state"], "Bihar")
    check.equals("district included", by_pseudonym["JOD-0002"]["district"], "Jodhpur")
    check.that("id is a string", isinstance(by_pseudonym["JOD-0002"]["id"], str))
    check.equals(
        "no real name is exposed",
        [k for k in by_pseudonym["JPR-0001"] if "name" in k],
        [],
    )

    print("\n[filters]")
    check.equals(
        "district filter",
        sorted(p["pseudonym"] for p in read_people(district="Jaipur")),
        ["JPR-0001", "JPR-0004"],
    )
    check.equals(
        "state filter",
        sorted(p["pseudonym"] for p in read_people(state="Rajasthan")),
        ["JOD-0002", "JPR-0001", "JPR-0004"],
    )
    check.equals(
        "district and state combined",
        [p["pseudonym"] for p in read_people(district="Patna", state="Bihar")],
        ["PTN-0003"],
    )
    check.equals(
        "contradictory filters return nothing",
        read_people(district="Patna", state="Rajasthan"),
        [],
    )
    check.equals(
        "filter is case-insensitive",
        [p["pseudonym"] for p in read_people(district="jaipur", state="RAJASTHAN")],
        ["JPR-0001", "JPR-0004"],
    )
    check.equals(
        "surrounding whitespace tolerated",
        [p["pseudonym"] for p in read_people(district="  Jodhpur ")],
        ["JOD-0002"],
    )
    check.equals("unknown district returns empty", read_people(district="Nowhere"), [])

    print("\n[shape]")
    check.equals(
        "exactly the agreed keys",
        sorted(everyone[0].keys()),
        ["band", "case_phase", "district", "id", "last_scored_at", "pseudonym", "score", "state"],
    )
    check.equals("latest score value included", by_pseudonym["JPR-0001"]["score"], 78.0)
    check.that("last_scored_at included", by_pseudonym["JPR-0001"]["last_scored_at"])
    check.equals("unscored person has null score", by_pseudonym["JPR-0004"]["score"], None)
    check.equals(
        "unscored person has null timestamp", by_pseudonym["JPR-0004"]["last_scored_at"], None
    )
    # District first (Jaipur < Jodhpur < Patna), pseudonym only breaking ties.
    check.equals(
        "ordered by district then pseudonym",
        [(p["district"], p["pseudonym"]) for p in everyone],
        [
            ("Jaipur", "JPR-0001"),
            ("Jaipur", "JPR-0004"),
            ("Jodhpur", "JOD-0002"),
            ("Patna", "PTN-0003"),
        ],
    )

    # A window function is only worth it if it stays one query.
    print("\n[efficiency]")
    statements = []
    from sqlalchemy import event

    event.listen(db.bind, "before_cursor_execute", lambda *a: statements.append(a[2]))
    read_people()
    selects = [s for s in statements if s.strip().upper().startswith("SELECT")]
    check.equals("one SELECT regardless of person count", len(selects), 1)

    db.close()
    return check.report()


if __name__ == "__main__":
    sys.exit(main())
