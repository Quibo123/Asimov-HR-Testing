# Talently API: templates and jobs

Status: DRAFT, to be reviewed with Rishi.

## Conventions

- All `/talently/*` routes need `Authorization: Bearer <token>`.
  Users in more than one tenant must also send `X-Tenant-ID`.
- `/portal/*` routes are public: no token needed.
- Errors look like `{ "statusCode": 400, "error": "Bad Request", "message": "..." }`.
- 400 = invalid input, 401 = no or bad token, 403 = role lacks permission, 404 = not found,
  409 = conflict (for example, publishing a job that is not a draft).
- Reading needs `talently.jobs.view`. Creating, editing, copying, publishing and closing need `talently.jobs.manage`.

## Question types and rules

| type | scored | weight | options |
|---|---|---|---|
| SINGLE_CHOICE, MULTIPLE_CHOICE | yes | 1-100 | 2 or more, each with scorePercent 0-100 |
| YES_NO | yes | 1-100 | exactly 2 |
| NUMBER_BANDS | yes | 1-100 | bands with minValue and/or maxValue; must not overlap; a missing min or max means open-ended |
| RATING | yes | 1-100 | exactly 5 options, one per rating; minValue = maxValue = 1..5 |
| SHORT_TEXT, FILE | no | must be 0 | none |

- Weights of all scored questions must add up to exactly 100.
- `mustHave: true` means a candidate scoring 0% on that question is knocked out (scored questions only).

## Templates

### POST /talently/templates  (201)

Request:
```json
{
  "name": "Support engineer screening",
  "questions": [
    {
      "type": "YES_NO",
      "text": "Are you authorised to work in India?",
      "weight": 40,
      "required": true,
      "mustHave": true,
      "options": [
        { "label": "Yes", "scorePercent": 100 },
        { "label": "No", "scorePercent": 0 }
      ]
    },
    {
      "type": "NUMBER_BANDS",
      "text": "Years of experience",
      "weight": 60,
      "options": [
        { "label": "0 to 2", "minValue": 0, "maxValue": 2, "scorePercent": 30 },
        { "label": "3 to 5", "minValue": 3, "maxValue": 5, "scorePercent": 70 },
        { "label": "6 or more", "minValue": 6, "maxValue": null, "scorePercent": 100 }
      ]
    },
    { "type": "SHORT_TEXT", "text": "Why do you want this job?", "weight": 0, "required": false },
    { "type": "FILE", "text": "Upload your resume", "weight": 0, "required": true }
  ]
}
```

Response 201: the saved template with `id`, `groupId`, `version: 1` and its `questions` with `options`.

Error 400 when weights are wrong:
```json
{ "statusCode": 400, "error": "Bad Request",
  "message": "questions: Weights of scored questions must add up to 100 (currently 90)." }
```

### GET /talently/templates
Response 200: `{ "items": [ { "id", "groupId", "name", "version", "createdAt" } ] }`

### GET /talently/templates/:id
Response 200: the full template with questions and options (weights included; this is an internal route).

### PUT /talently/templates/:id
Body: same shape as the create request. It replaces the whole question list.

- If no published or closed job uses this version, it is edited in place and `newVersion` is `false`.
- If a published or closed job uses it, that version is left untouched and a new version is created
  in the same group (`newVersion: true`, new `id`, `version` + 1).

Response 200:
```json
{ "template": { "id": "uuid", "groupId": "uuid", "name": "...", "version": 2, "questions": [] },
  "newVersion": true }
```

### POST /talently/templates/:id/copy  (201)
Body: `{}` or `{ "name": "New name" }`. Creates a new independent template at version 1.

## Jobs

### POST /talently/jobs  (201)
```json
{ "title": "Support Engineer", "location": "Chennai", "templateId": "uuid" }
```
Response: the job with `status: "DRAFT"` and `templateVersion: null`.

### POST /talently/jobs/:id/publish
No body. Sets `status: "PUBLISHED"` and stores the template version on the job (`templateVersion`).
After this the job's questions and scoring never change. 409 if the job is not a draft.

### POST /talently/jobs/:id/close
No body. Only a published job can be closed. 409 otherwise.

### GET /talently/jobs and GET /talently/jobs/:id
List, or one job with `template: { id, name, version }`.

## Public portal

### GET /portal/jobs/:id  (no token)
Only works for a published job; otherwise 404. It never returns weights, score percentages or must-have flags.
Options are sent for single choice, multiple choice and yes/no only. Rating questions carry a fixed scale.

```json
{
  "id": "uuid",
  "title": "Support Engineer",
  "location": "Chennai",
  "publishedAt": "2026-10-07T10:00:00.000Z",
  "questions": [
    { "id": "uuid", "type": "YES_NO", "text": "Are you authorised to work in India?", "required": true,
      "options": [ { "id": "uuid", "label": "Yes" }, { "id": "uuid", "label": "No" } ] },
    { "id": "uuid", "type": "NUMBER_BANDS", "text": "Years of experience", "required": true },
    { "id": "uuid", "type": "RATING", "text": "Rate your English", "required": true,
      "scale": { "min": 1, "max": 5 } },
    { "id": "uuid", "type": "SHORT_TEXT", "text": "Why do you want this job?", "required": false },
    { "id": "uuid", "type": "FILE", "text": "Upload your resume", "required": true }
  ]
}
```