"""
Gap 1 — /officers/{id}/alerts now carries the person and band.

Run: python -m tests.test_alerts    (from backend/)
"""

import sys

from tests.support import Check, fresh_db, make_alert, make_officer, make_person, make_score

from app.data_access import get_open_alerts_for_officer
from app.routes.alerts import read_open_alerts


def main():
    check = Check()
    db = fresh_db()

    # Two districts, so role-based scoping is actually exercised.
    asha = make_person(db, "JPR-0001", district="Jaipur", state="Rajasthan")
    bimal = make_person(db, "JOD-0002", district="Jodhpur", state="Rajasthan")

    asha_score = make_score(db, asha, value=71.2, band="elevated")
    bimal_score = make_score(db, bimal, value=88.0, band="priority")

    asha_alert = make_alert(db, asha_score, severity="high")
    make_alert(db, bimal_score, severity="critical")
    # An acknowledged alert must stay out of the "open" list.
    make_alert(db, asha_score, severity="low", status="acknowledged")

    admin = make_officer(db, "Sunil Verma", "admin", district="Jaipur")
    district_officer = make_officer(db, "Anita Desai", "district_officer", district="Jaipur")
    counsellor = make_officer(db, "Priya Sharma", "counsellor", district="Jaipur")

    print("\n[data_access] joined rows")
    rows = get_open_alerts_for_officer(db, officer_id=admin.id)
    check.equals("admin sees both open alerts", len(rows), 2)
    check.that(
        "each row is (Alert, Person, Score)",
        all(len(r) == 3 for r in rows),
    )

    print("\n[route] serialised payload")
    payload = read_open_alerts(officer_id=str(admin.id), db=db)
    by_id = {item["id"]: item for item in payload}
    item = by_id[str(asha_alert.id)]

    # Existing fields must be untouched.
    check.equals("id preserved", item["id"], str(asha_alert.id))
    check.equals("score_id preserved", item["score_id"], str(asha_score.id))
    check.equals("severity preserved", item["severity"], "high")
    check.equals("status preserved", item["status"], "open")
    check.that("assigned_to preserved", "assigned_to" in item)

    # New fields.
    check.equals("person_id added", item["person_id"], str(asha.id))
    check.equals("pseudonym added", item["pseudonym"], "JPR-0001")
    check.equals("district added", item["district"], "Jaipur")
    check.equals("band added, from the score", item["band"], "elevated")
    check.that(
        "band is not confused with severity",
        item["band"] != item["severity"],
    )

    print("\n[scoping] role rules still hold")
    check.equals(
        "district officer sees only their district",
        [i["district"] for i in read_open_alerts(str(district_officer.id), db)],
        ["Jaipur"],
    )
    check.equals(
        "counsellor sees only alerts assigned to them",
        read_open_alerts(str(counsellor.id), db),
        [],
    )
    check.equals(
        "acknowledged alerts stay excluded",
        len([i for i in read_open_alerts(str(admin.id), db) if i["status"] != "open"]),
        0,
    )
    check.equals(
        "unknown officer gets an empty list",
        read_open_alerts("00000000-0000-0000-0000-000000000000", db),
        [],
    )

    # Guard against the classic multi-entity join mistake.
    print("\n[sanity] no cartesian product")
    check.equals(
        "one row per open alert, not per join combination",
        len(read_open_alerts(str(admin.id), db)),
        2,
    )
    check.equals(
        "bimal's alert resolves to bimal",
        next(i["pseudonym"] for i in payload if i["severity"] == "critical"),
        bimal.pseudonym,
    )

    db.close()
    return check.report()


if __name__ == "__main__":
    sys.exit(main())
