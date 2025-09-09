# BinShare (Firebase + Google Login)

## Setup
1. Firebase Console → Project → Build → Authentication → **Google** provider Enable
2. Build → Firestore Database → Create (production mode)
3. Project Overview → Web app (</>) → Web app register → **config object** কপি
4. Firestore → **Rules** → `firestore.rules` ফাইলের কনটেন্ট পেস্ট করে Publish
5. `app.js`-এ তোমার firebaseConfig বসাও

## Run locally
- যেকোনো স্ট্যাটিক সার্ভার: `npx serve` (অথবা `index.html` ব্রাউজারে ওপেন)
- Login with Google → Create bin → নিজেরটা Delete করতে পারবে

## Deploy to Vercel
1. এই ফোল্ডার GitHub-এ পুশ করো
2. Vercel → New Project → তোমার রিপো সিলেক্ট
3. Framework: **Other** (Static)
4. Build command: *(ফাঁকা)*
5. Output directory: *(ফাঁকা)* (root)
6. Deploy

**Firebase Auth → Settings → Authorized domains**-এ তোমার `vercel.app` ডোমেইন **Add** করতে ভুলো না।

## Make someone Admin (optional)
- Admin SDK দিয়ে একবার custom claim সেট করলেই হবে:
```js
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
const sa = JSON.parse(fs.readFileSync("./serviceAccount.json","utf-8"));
initializeApp({ credential: cert(sa) });
const UID = "PUT_ADMIN_UID";
await getAuth().setCustomUserClaims(UID, { admin: true });
console.log("Admin set:", UID);
process.exit(0);
