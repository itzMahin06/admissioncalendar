# Admission Calendar 2026 🎓

বাংলাদেশের বিশ্ববিদ্যালয় ভর্তি পরীক্ষার সম্পূর্ণ ক্যালেন্ডার — আবেদন, পরীক্ষা, ফলাফল ও প্রয়োজনীয় সকল তথ্য এক জায়গায়।
এখন ইউজার লগইন/রেজিস্ট্রেশন, পার্সোনাল বুকমার্ক, জিপিএ-ভিত্তিক আবেদনযোগ্য বিশ্ববিদ্যালয় সাজেশন এবং একটি সম্পূর্ণ
অ্যাডমিন প্যানেল সহ।

---

## ✨ Features

- 📅 সম্পূর্ণ ভর্তি ক্যালেন্ডার (আবেদন / পরীক্ষা / প্রবেশপত্র / ফলাফল) — গেস্ট ইউজাররাও দেখতে পারবেন
- 🔐 ইমেইল/পাসওয়ার্ড ও Google দিয়ে সাইন আপ/সাইন ইন (Firebase Authentication)
- ⭐ পছন্দের বিশ্ববিদ্যালয় বুকমার্ক করা (লগইন প্রয়োজন)
- 🎓 SSC + HSC জিপিএ দিয়ে স্বয়ংক্রিয়ভাবে আবেদনযোগ্য বিশ্ববিদ্যালয়ের তালিকা
- 🛠️ অ্যাডমিন প্যানেল — বিশ্ববিদ্যালয় ও ইউজার প্রোফাইল যোগ/সম্পাদনা/মুছে ফেলা/ফিল্টার করা
- 🔔 টোস্ট নোটিফিকেশন — লগআউট অবস্থায় প্রিমিয়াম ফিচার ব্যবহারের চেষ্টা করলে
- 🌗 ডার্ক/লাইট থিম, রেসপন্সিভ ডিজাইন, লাইভ কাউন্টডাউন টাইমার
- ℹ️ About Us / Privacy Policy / Contact পেজ (টেলিগ্রাম গ্রুপ লিংকসহ)

---

## 🩹 সাম্প্রতিক বাগ ফিক্স

- **প্রোফাইল/বুকমার্ক/হেডার আইকন লোড না হওয়া বাগ ফিক্স করা হয়েছেঃ** `profile.js`, `admin.js` একটি
  race condition এর কারণে মাঝেমধ্যে Firebase-এর auth স্টেট মিস করে ফেলতো (পেজ লোড হওয়ার আগেই auth
  চেক শেষ হয়ে গেলে)। এখন সব পেজ `onAuthReady()` হেল্পার ব্যবহার করে, যা নিশ্চিত করে auth স্টেট
  রেজল্ভ হওয়ার সাথে সাথেই — আগে হোক বা পরে — সঠিকভাবে প্রোফাইল ডাটা লোড হবে, হেডারের প্রোফাইল
  আইকন লগইন/লগআউট অবস্থা ঠিকভাবে দেখাবে, এবং বুকমার্ক আইকনগুলো সঠিকভাবে সিঙ্ক হবে।
- **কাউন্টডাউন টাইমার ফিক্স করা হয়েছেঃ** আগে "ডেডলাইন কাউন্টডাউন" ও "পরীক্ষা কাউন্টডাউন" প্লেইন
  টেক্সট ফিল্ড ছিল যেখানে ভুল ফরম্যাট লিখলে (যেমন `YYYY-MM-DD` এর বদলে `DD-MM-YYYY`) কাউন্টডাউন
  ভুল দেখাতো। এখন এগুলো নেটিভ ডেট-টাইম পিকার (`datetime-local`), তাই ফরম্যাট ভুল হওয়ার সুযোগ নেই।
  এছাড়া অবৈধ/পুরনো ফরম্যাটের ডাটার জন্য নিরাপদ ফলব্যাক (`—`) যোগ করা হয়েছে এবং কাউন্টডাউন এখন
  প্রতি সেকেন্ডে আপডেট হয় (আগে প্রতি মিনিটে হতো)।
- **এক্সাম ট্যাবে ইউনিট গ্রুপিং যোগ করা হয়েছেঃ** বিশ্ববিদ্যালয়ের ফর্মে নতুন ঐচ্ছিক `examUnit`
  ফিল্ড যোগ হয়েছে। একই বিশ্ববিদ্যালয়ের একাধিক ইউনিট থাকলে পরীক্ষা ট্যাবে নামটি একবার দেখাবে এবং
  তার নিচে প্রতিটি ইউনিট আলাদা পরীক্ষার তারিখ/কাউন্টডাউনসহ দেখাবে।
- **Firestore rules হার্ডেনিং করা হয়েছেঃ** সাধারণ ইউজার এখন আর নিজের `role` ফিল্ড পরিবর্তন করে
  নিজেকে অ্যাডমিন বানাতে পারবে না, এবং `bookmarks` সবসময় লিস্ট টাইপ কিনা যাচাই করা হয়।

---

## 📁 Project Structure

```
├── index.html              # প্রধান ক্যালেন্ডার পেজ (public)
├── login.html               # সাইন ইন পেজ
├── register.html            # রেজিস্ট্রেশন পেজ
├── profile.html              # ইউজার প্রোফাইল (তথ্য / বুকমার্ক / যোগ্য বিশ্ববিদ্যালয়)
├── admin.html                # অ্যাডমিন প্যানেল (শুধুমাত্র info.itzmahin@gmail.com)
├── about.html / privacy.html / contact.html
├── api/
│   └── firebase-config.js    # Vercel Serverless Function — env var থেকে Firebase config সার্ভ করে
├── assets/
│   ├── firebase-config.js    # Firebase init করে window.firebaseConfig দিয়ে (নিজে এডিট করার দরকার নেই)
│   ├── common.css            # শেয়ার্ড ডিজাইন সিস্টেম
│   ├── common.js             # হেডার/ফুটার, থিম, টোস্ট, অথ-স্টেট
│   ├── calendar.js            # index.html এর লজিক
│   ├── auth.js                 # লগইন/রেজিস্ট্রেশন লজিক
│   ├── profile.js              # প্রোফাইল পেজ লজিক
│   └── admin.js                # অ্যাডমিন প্যানেল লজিক
├── seed/
│   ├── universities-seed.json  # data.json থেকে রূপান্তরিত প্রাথমিক ডাটা
│   └── import.js                # Firestore এ ডাটা ইম্পোর্ট করার স্ক্রিপ্ট (ঐচ্ছিক)
├── firestore.rules             # Firestore সিকিউরিটি রুলস
└── favicon / icons (অপরিবর্তিত)
```

> পুরনো `data.json`, `script.js`, `style.css` ফাইলগুলো আর ব্যবহার হচ্ছে না — সমস্ত ডাটা এখন Firestore থেকে লোড হয়।
> `seed/universities-seed.json` এ পুরনো `data.json` এর সব তথ্য একত্র করে রাখা হয়েছে, যা আপনি Firestore-এ ইম্পোর্ট করতে পারবেন।

---

## 🔥 Firebase Setup (ধাপে ধাপে)

### ১. Firebase প্রজেক্ট তৈরি করুন
1. [Firebase Console](https://console.firebase.google.com/) এ যান → **Add project**
2. প্রজেক্টের নাম দিন (যেমনঃ `admission-calendar`) এবং তৈরি করুন

### ২. Web App যোগ করুন
1. প্রজেক্ট ওভারভিউ থেকে **</> (Web)** আইকনে ক্লিক করুন
2. অ্যাপের নাম দিন, রেজিস্টার করুন
3. যে `firebaseConfig` অবজেক্ট দেখাবে (নিচের মতো), সেটির প্রতিটি ভ্যালু **Vercel Environment Variable**
   হিসেবে সেট করুন — কোনো কী কোডে হার্ডকোড করার দরকার নেই

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

**Vercel Dashboard → আপনার প্রজেক্ট → Settings → Environment Variables** এ গিয়ে এই ৬টি ভ্যারিয়েবল
যোগ করুনঃ

| Key | Value (উদাহরণ) |
|---|---|
| `FIREBASE_API_KEY` | `apiKey` এর মান |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` এর মান (`your-project.firebaseapp.com`) |
| `FIREBASE_PROJECT_ID` | `projectId` এর মান |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` এর মান |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` এর মান |
| `FIREBASE_APP_ID` | `appId` এর মান |

সেভ করার পর প্রজেক্ট রি-ডিপ্লয় করুন (Vercel → Deployments → সর্বশেষ ডিপ্লয়মেন্টের পাশে **⋯ → Redeploy**)।

> কীভাবে কাজ করেঃ প্রতিটি HTML পেজ প্রথমে `/api/firebase-config.js` (একটি Vercel Serverless
> Function) লোড করে, যেটি উপরের এনভায়রনমেন্ট ভ্যারিয়েবলগুলো পড়ে `window.firebaseConfig` সেট করে
> দেয়। এরপর `assets/firebase-config.js` সেই কনফিগ দিয়ে Firebase initialize করে। ফলে আপনার
> Firebase কী গিটহাব রিপোজিটরিতে প্লেইন টেক্সটে থাকে না।
>
> **লোকাল ডেভেলপমেন্টের জন্যঃ** `vercel dev` কমান্ড দিয়ে চালালে `/api` রুটও লোকালি কাজ করবে (এবং
> `vercel env pull` দিয়ে `.env.local` এ ভ্যারিয়েবলগুলো নিয়ে আসতে পারেন)। প্লেইন
> `python3 -m http.server` দিয়ে চালালে `/api/firebase-config.js` কাজ করবে না — সেক্ষেত্রে
> সাময়িকভাবে `assets/firebase-config.js` এর উপরে সরাসরি `window.firebaseConfig = {...}` বসিয়ে
> টেস্ট করতে পারেন (কিন্তু সেটা কমিট করবেন না)।

### ৩. Authentication চালু করুন
1. **Build → Authentication → Get started**
2. **Sign-in method** ট্যাবে গিয়ে চালু করুনঃ
   - **Email/Password**
   - **Google**
3. Google সাইন-ইন চালু করার সময় একটি support email দিতে হবে — আপনার ইমেইল দিন

### ৪. Firestore Database চালু করুন
1. **Build → Firestore Database → Create database**
2. **Production mode** সিলেক্ট করুন, নিকটতম region বেছে নিন
3. তৈরি হওয়ার পর **Rules** ট্যাবে গিয়ে এই রিপোর `firestore.rules` ফাইলের কনটেন্ট পেস্ট করে **Publish** করুন

### ৫. Authorized domain যোগ করুন (Google সাইন-ইনের জন্য জরুরি)
GitHub Pages এ ডিপ্লয় করার পর, **Authentication → Settings → Authorized domains** এ গিয়ে
আপনার GitHub Pages ডোমেইন (যেমনঃ `yourusername.github.io`) যোগ করুন।

### ৬. প্রাথমিক বিশ্ববিদ্যালয় ডাটা যোগ করুন
দুইটি উপায়ে করতে পারেনঃ

**সহজ উপায় — অ্যাডমিন প্যানেল থেকে ম্যানুয়ালি যোগ করুন:**
1. `info.itzmahin@gmail.com` দিয়ে রেজিস্টার/সাইন ইন করুন (এই ইমেইলটিই অ্যাডমিন হিসেবে ধরা হয়)
2. প্রোফাইল আইকন → **অ্যাডমিন প্যানেল** এ যান
3. **নতুন বিশ্ববিদ্যালয়** বাটনে ক্লিক করে একে একে তথ্য যোগ করুন

**দ্রুত উপায় — বাল্ক ইম্পোর্ট স্ক্রিপ্ট চালান:**
```bash
cd seed
npm install firebase-admin
# Firebase Console → Project settings → Service accounts → Generate new private key
# ডাউনলোড করা ফাইলটি seed/serviceAccountKey.json নামে সেভ করুন
node import.js
```
এটি `universities-seed.json` এর সব ৫২টি এন্ট্রি Firestore এ যোগ করে দেবে। **এরপর অ্যাডমিন প্যানেল থেকে
প্রতিটি এন্ট্রি রিভিউ করে নিন** — যেহেতু এটি পুরনো `data.json` থেকে স্বয়ংক্রিয়ভাবে একত্রিত করা, কিছু এন্ট্রি
(যেমন `DU` আবেদন সারি বনাম `DU (A)` পরীক্ষার সারি) ম্যানুয়ালি মার্জ/ঠিক করা প্রয়োজন হতে পারে। প্রতিটি
বিশ্ববিদ্যালয়ের জন্য `requiredGPA` (আবেদনের জন্য প্রয়োজনীয় সম্মিলিত SSC+HSC জিপিএ) যোগ করতে ভুলবেন না —
এটি ছাড়া প্রোফাইল পেজের "যোগ্য বিশ্ববিদ্যালয়" ফিচার কাজ করবে না।

---

## 👑 Admin Access

অ্যাডমিন প্যানেল (`admin.html`) শুধুমাত্র **`info.itzmahin@gmail.com`** ইমেইল দিয়ে লগইন করা অ্যাকাউন্ট থেকে
অ্যাক্সেস করা যাবে। এই ইমেইলটি `assets/firebase-config.js` এর `ADMIN_EMAIL` ভ্যারিয়েবলে এবং
`firestore.rules` ফাইলে সেট করা আছে — অ্যাডমিন ইমেইল পরিবর্তন করতে চাইলে দুই জায়গাতেই আপডেট করুন।

> **নোটঃ** অ্যাডমিন প্যানেল থেকে ইউজার "মুছে ফেলা" শুধুমাত্র তাদের Firestore প্রোফাইল ডাটা মুছে ফেলে —
> Firebase Authentication থেকে সম্পূর্ণ অ্যাকাউন্ট মুছতে হলে Firebase Admin SDK ব্যবহার করে একটি
> Cloud Function লিখতে হবে (ক্লায়েন্ট-সাইড কোড থেকে অন্য ইউজারের auth অ্যাকাউন্ট মোছা সম্ভব নয়, এটি
> Firebase এর একটি নিরাপত্তা সীমাবদ্ধতা)।

---

## 🚀 Deploy করুন GitHub Pages এ

1. একটি নতুন GitHub রিপোজিটরি তৈরি করুন
2. এই ফোল্ডারের সব ফাইল পুশ করুনঃ
   ```bash
   git init
   git add .
   git commit -m "Admission Calendar with Firebase auth, bookmarks & admin panel"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
3. GitHub রিপোতে **Settings → Pages** এ যান
4. **Source**: `Deploy from a branch` → Branch: `main` → folder: `/ (root)` সিলেক্ট করে **Save** করুন
5. কিছুক্ষণ পর সাইটটি লাইভ হবে এখানেঃ `https://<your-username>.github.io/<repo-name>/`
6. এই ডোমেইনটি Firebase Console → Authentication → Settings → **Authorized domains** এ যোগ করতে ভুলবেন না
   (নাহলে Google সাইন-ইন কাজ করবে না)

---

## 🔒 Firestore Security Rules

Firebase Console → Firestore Database → **Rules** ট্যাবে গিয়ে নিচের রুলসগুলো পেস্ট করে **Publish**
করুন (এই একই কনটেন্ট রিপোর `firestore.rules` ফাইলেও আছে)ঃ

```
rules_version = '2';

// Copy these rules into Firebase Console → Firestore Database → Rules,
// or deploy with the Firebase CLI: firebase deploy --only firestore:rules
//
// IMPORTANT: after pasting, click "Publish". Rules only take effect once
// published — editing this file locally does nothing to your live project.

service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null &&
             request.auth.token.email == "info.itzmahin@gmail.com";
    }

    // Anyone (including signed-out visitors) can read the calendar data.
    // Only the admin account may create, edit, or delete universities.
    match /universities/{uniId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Homepage "Latest Updates" YouTube video links.
    // Anyone can read; only the admin can add/edit/delete.
    match /videos/{videoId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // username → {uid, email} reservation docs. The document ID *is* the
    // lowercased username, which is what makes usernames unique: Firestore
    // only allows a `create` when the doc doesn't already exist, so trying
    // to reserve a taken username is automatically rejected (falls through
    // to `allow update: if false` below). This same public-readable mapping
    // is also how the login page resolves "email or username" logins, and
    // how the client shows a live "available / taken" check while typing.
    match /usernames/{usernameId} {
      allow get: if true;    // live availability check + username-login lookup
      allow list: if false;  // no need to ever enumerate all usernames
      allow create: if request.auth != null &&
                       request.resource.data.uid == request.auth.uid &&
                       request.resource.data.email == request.auth.token.email &&
                       usernameId == usernameId.lower() &&
                       usernameId.matches('[a-z0-9_]{3,20}');
      allow update: if false; // immutable — to "rename", delete + create instead
      allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }

    // Each signed-in user can read/write only their own profile document.
    // The admin account can read/write every profile (for the admin panel).
    //
    // A regular user may create/update their own doc, but may NOT set
    // `role` to anything other than "user" (so the client can't grant
    // itself admin access) and their `bookmarks` field must stay a list.
    // The admin bypasses these checks entirely so the admin panel can
    // freely edit any profile, including role.
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow read: if isAdmin();

      allow create: if isAdmin() ||
                       (request.auth != null && request.auth.uid == userId &&
                        request.resource.data.role == "user" &&
                        request.resource.data.bookmarks is list);

      allow update: if isAdmin() ||
                       (request.auth != null && request.auth.uid == userId &&
                        (!('role' in request.resource.data) ||
                         request.resource.data.role == resource.data.role) &&
                        (!('bookmarks' in request.resource.data) ||
                         request.resource.data.bookmarks is list));

      allow delete: if isAdmin();
    }
  }
}
```

> এখানে হার্ডকোড করা `info.itzmahin@gmail.com` ইমেইলটিই অ্যাডমিন অ্যাক্সেস নিয়ন্ত্রণ করে — অ্যাডমিন
> ইমেইল পরিবর্তন করতে চাইলে এখানে এবং `assets/firebase-config.js` এর `ADMIN_EMAIL` — দুই জায়গাতেই
> আপডেট করুন।
>
> **নতুন কী যোগ হলোঃ** আগের রুলসে যেকোনো লগইন করা ইউজার নিজের প্রোফাইল ডকুমেন্টে `role: "admin"` বসিয়ে
> দিতে পারতো (যদিও তাতে বাস্তবে অ্যাডমিন অ্যাক্সেস পাওয়া যেত না, কারণ `admin.html` ইমেইল চেক করে)।
> এখন রুলস স্পষ্টভাবে নিজের `role` পরিবর্তন করা আটকায়, এবং `bookmarks` সবসময় লিস্ট টাইপ কিনা যাচাই
> করে — শুধুমাত্র অ্যাডমিন অ্যাকাউন্ট যেকোনো ইউজারের `role` পরিবর্তন করতে পারবে।

---

## 🗄️ Firestore Data Model

**`universities/{id}`**
```
name, applyLink, applyLinkText, deadline, deadlineCountdown,
examUnit, admitCard, examDate, examCountdown, negative, calculator (bool),
secondTime (bool), circularLink, resultDate, resultLink,
requiredGPA (number), order (number), active (bool)
```

> **`examUnit`** ঐচ্ছিক টেক্সট ফিল্ড (যেমন `"A ইউনিট"`)। একই বিশ্ববিদ্যালয়ের একাধিক ইউনিট/শিফট থাকলে
> একই `name` দিয়ে আলাদা আলাদা ডকুমেন্ট তৈরি করুন, শুধু `examUnit` ও `examDate`/`examCountdown` আলাদা
> রাখুন। ক্যালেন্ডার পেজের **পরীক্ষা** ট্যাবে তখন বিশ্ববিদ্যালয়ের নামটি একবার (rowspan দিয়ে) দেখাবে,
> আর তার নিচে প্রতিটি ইউনিট নিজস্ব পরীক্ষার তারিখ ও কাউন্টডাউনসহ দেখাবে।

**`users/{uid}`**
```
name, username, email, photoURL, sscGPA, hscGPA, sscMark, hscMark,
bookmarks (array of university ids), role ("user" | "admin"),
profileComplete (bool), createdAt
```

---

## 🛠️ Local Development

কোনো বিল্ড স্টেপ প্রয়োজন নেই — এটি প্লেইন HTML/CSS/JS। যেকোনো লোকাল সার্ভার দিয়ে চালাতে পারবেনঃ

```bash
python3 -m http.server 8080
# অথবা
npx serve .
```

তারপর ব্রাউজারে `http://localhost:8080` এ যান।

---

## 📌 Notes

- সাইটটি এখন সম্পূর্ণরূপে Firebase নির্ভর — Vercel এ সঠিক Environment Variables (`FIREBASE_API_KEY`
  ইত্যাদি, উপরের টেবিল দেখুন) সেট না করলে ক্যালেন্ডার ডাটা লোড হবে না এবং লগইন/রেজিস্ট্রেশন কাজ করবে না।
- গেস্ট (লগইন ছাড়া) ইউজাররা ক্যালেন্ডারের সব তথ্য দেখতে পারবেন, কিন্তু বুকমার্ক করতে গেলে বা প্রোফাইল/অ্যাডমিন
  পেজে যেতে চাইলে "ফুল অ্যাক্সেস ও প্রিমিয়াম ফিচারের জন্য সাইন ইন/সাইন আপ করুন" টোস্ট দেখানো হবে।
- Telegram গ্রুপ লিংক ও যোগাযোগের তথ্য পরিবর্তন করতে `contact.html` ও `index.html` এ খুঁজে পরিবর্তন করুন।
