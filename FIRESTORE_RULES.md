# Firestore rules (internal, no login)

Data layout:

- `boards/{boardId}`: `{ title: string, members: { [memberId]: { name: string, order: number } } }`
- `boards/{boardId}/cells/{memberId_YYYY-MM-DD_hour}`: `{ s: "free" | "busy" | "reason", r?: string }`

Open read/write, limited to the board paths and to the shapes above. Anyone who has the app URL can edit; that is the intent for an internal group.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /boards/{boardId} {
      allow read: if true;
      allow write: if request.resource.data.keys().hasOnly(['title', 'members'])
                   && (!('title' in request.resource.data) || (request.resource.data.title is string && request.resource.data.title.size() <= 80));

      match /cells/{cellId} {
        allow read: if true;
        allow delete: if true;
        allow create, update: if request.resource.data.keys().hasOnly(['s', 'r'])
                              && request.resource.data.s in ['free', 'busy', 'reason']
                              && (!('r' in request.resource.data) || (request.resource.data.r is string && request.resource.data.r.size() <= 80));
      }
    }
  }
}
```

Source of truth: `firestore.rules`. Deploy: `npx firebase-tools deploy --only firestore` (project `web-xep-lich`, set in `.firebaserc`).
