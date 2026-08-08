# Accounts & teacher role

Login is **username + password only**. No email addresses, no password-reset emails.

## Roles

| Role | Flag | Can |
|------|------|-----|
| Student | `is_teacher = false` | Course, flashcards, chat |
| Teacher | `is_teacher = true` | Everything above + **Teacher dashboard** |

Teachers are set manually (seed env, SQL, or checkbox when creating an account in the UI).

## Seed accounts

```bash
npm run db:seed
```

| Username | Password (default) | Role |
|----------|-------------------|------|
| `student` | `latin-learn` | student |
| `teacher` | `latin-teach` | teacher |

Override with `SEED_USERNAME`, `SEED_PASSWORD`, `SEED_TEACHER_USERNAME`, `SEED_TEACHER_PASSWORD`, etc.

## Promote an existing user to teacher

```sql
UPDATE users SET is_teacher = true WHERE username = 'yourname';
```

Then sign out and back in (JWT must refresh).

## Teacher dashboard (`/teacher`)

- List learners with completion counts and last activity  
- Open a student: completions, recent attempt results, flashcard stats  
- **Create account** (username, display name, password)  
- **Reset password** for any user (you tell them the new password offline)

## Username rules

- 2–32 characters  
- Lowercase letters, numbers, `_`, `-` only  
- Unique  

## Schema note

`users.username` replaced `users.email`. `npm run db:seed` renames the column if an old `email` column still exists.
