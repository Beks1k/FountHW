> ### ⚠️ Disclaimer
>
>!!!IF YOU HATE AI AND PROJECTSA MADE BY ITS HAND PLEASE LEAVE THIS REPOSITORY PAGE AND DONT HATE THE PROJECT
>
> This project is in **beta** and was **built with the assistance of AI**.
>
> The code has not been reviewed by a professional security auditor, and no
> formal security testing has been carried out. It is provided as-is, for
> educational and personal use.
>
> You are responsible for your own data. Review the
> [Firestore rules](firestore.rules) before trusting it with anything
> sensitive, and do not use it to store confidential or regulated information.
> The authors accept no liability for data loss, security incidents, or any
> other damage arising from use of this software.

# FountHW - Homework Manager

A simple homework management app for classrooms. Teachers create classes, assign homework, and grade submissions. Students join with a class PIN and mark assignments as done.

## A few words from the one of the main managers and helpers of this project

This project was built with data security and seamless deployment in mind. 
A special thanks to my AI partner for assisting with architecture design, setting up secure CI/CD pipelines via GitHub Actions, hiding Firebase keys, and securing Firestore rules.

> "Code is just a tool, but when driven by the right ideas and solid protection, it can do great things. Best of luck with your deployment and the success of your application!"
> 
> — **Google Gemini AI Assistant** 🚀


## What is this app, and what was it made for?

Keeping track of homework in a classroom is messy: assignments get written on
boards, muttered out loud, forgotten in notebooks, and grades live in a
separate notebook nobody can see. Existing school platforms are heavy,
expensive, and full of features nobody uses.

FountHW was made to be the opposite of that: one shared place per class where
the teacher posts homework, students mark it done, and grades come back. No
paper notebooks, no lost messages, no accounts to buy — just a class PIN that
connects everyone in under a minute. It was built as a personal project to
solve a real problem in real classrooms, and it does one job and stays out of
the way.

## Features

- Email/password authentication
- Email domain validation on signup (real domains only, any provider)
- Beta notice: students are told to write their password down, because a lost
  password cannot be recovered yet
- Teacher creates a class and shares a 6-digit PIN
- Students join with the PIN
- Teachers create homework with a custom maximum grade
- Split a class into named groups and target homework/announcements at specific groups
- Students mark homework as done
- Teachers grade submissions
- Class announcements
- Profile page: change username, change password, view class PIN
- Admin panel: view users, ban/unban, broadcast and remove system notifications
- Real-time updates via Firebase

## Tech Stack

- React + Vite
- Firebase (Auth + Firestore)
- Cloudflare-free email validation via DNS-over-HTTPS (MX lookup)
- GitHub Pages deployment

## Setup

1. Register as a **Teacher** — you get a class and a 6-digit PIN
2. Share the PIN with your students
3. Students register as **Student** with the PIN

## Password reset (none)

There is no password reset and no email in this app yet. The sign-in screen
warns every user that the app is in **beta** and that they should **remember
their password** — a forgotten password means the account cannot be recovered.
A teacher can still set a password for a student in the Firebase console
(Authentication → Users → "Set a new password").

## Groups

A class can be split into named groups.

1. Teacher opens the **Groups** tab and creates groups ("Group A", "Group B"…)
2. Teacher puts each student into a group with the dropdown
3. When creating homework or an announcement, the teacher picks who it is for:
   **Everyone in the class**, one group, or several groups at once
4. Students only see the items that target their group (or everyone)

> **"Everyone in the class" is a different target from "all groups".**
> Picking *Everyone in the class* stores the wildcard `*`, so students who are
> not in any group see the item too. Ticking every group by hand stores the
> list of group ids instead, which deliberately leaves ungrouped students out.
> The picker says so when you pick groups by hand.

Group isolation is enforced **in Firestore rules**, not just hidden in the UI — a
student who crafts a query for another group is rejected by the server.

Grades cannot be self-awarded server-side either: a submission is created with
the plain `done` status and no grade, and only the class teacher (or the admin)
can put a grade on it — even a hand-crafted API call is rejected.

## Security trade-offs (deliberate)

- **Class PINs are readable by any signed-in user.** The join flow matches
  students to classes by querying `classes` for the PIN, so the collection
  must be readable. A determined user could therefore discover another
  class's PIN by guessing. Rewriting this to work without list access (invite
  links, hashed PINs) is future work — for a classroom this is acceptable.
- **Attendance/"teacher account" trust is self-declared.** Anyone can register
  as a teacher; the admin Review queue flags teacher accounts so the admin can
  confirm or ban them.
- **No password reset.** The Firebase console is the only way to set a new
  password for someone who lost theirs.

> **Why the app uses two queries for students:** Firestore rules are not
> filters. If a query would return a document the user may not read, the whole
> query fails. So students fetch "targeted at everyone" and "targeted at my
> group" with two `array-contains` queries instead of one `classId` query. That
> needs the composite indexes in `firestore.indexes.json` (see below).

---

> **Disclaimer:** This application was generated with the assistance of AI. While efforts have been made to ensure functionality and security, the code has not undergone professional security auditing. Use at your own discretion. The developers are not liable for any data loss, security issues, or other problems that may arise from using this application.

