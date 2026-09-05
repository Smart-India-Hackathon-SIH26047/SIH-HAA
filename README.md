# SIH
## API contract

POST /checkin
Request:  { "person_id": "string", "text": "string", "channel": "text" }
Response: { "score": 0.72, "band": "elevated", "components": {...} }