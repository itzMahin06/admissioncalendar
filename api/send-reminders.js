/* ==========================================================================
   api/send-reminders.js
   Vercel Cron target — runs once a day (see vercel.json) and sends push
   notifications to users who bookmarked a university, when that
   university's application deadline OR any of its exam units' dates is
   exactly 7, 3, or 1 day away.

   Requires environment variables (Vercel Dashboard → Project → Settings →
   Environment Variables):
     FIREBASE_SERVICE_ACCOUNT_JSON   full service account JSON, as one line
     CRON_SECRET                     any random string you generate yourself
                                      (Vercel automatically sends this back
                                      as "Authorization: Bearer <value>" when
                                      it triggers a Cron Job that has this
                                      env var set — see vercel.json)
   ========================================================================== */

const { admin, db, parseCountdown, daysUntil, sendToTokens } = require('./_lib/notify-helpers');

const REMINDER_DAYS = [7, 3, 1];

module.exports = async (req, res) => {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [uniSnap, userSnap] = await Promise.all([
      db.collection('universities').get(),
      db.collection('users').get()
    ]);

    // uniId -> [{ uid, token }] — only users who bookmarked that specific
    // university AND have notifications enabled get reminders for it.
    const subscribersByUni = {};
    userSnap.forEach(doc => {
      const u = doc.data();
      if (!u.fcmToken || !Array.isArray(u.bookmarks)) return;
      u.bookmarks.forEach(uniId => {
        (subscribersByUni[uniId] = subscribersByUni[uniId] || []).push({ uid: doc.id, token: u.fcmToken });
      });
    });

    const jobs = [];

    uniSnap.forEach(uniDoc => {
      const u = uniDoc.data();
      const uniId = uniDoc.id;
      const subscribers = subscribersByUni[uniId] || [];
      if (!subscribers.length) return;

      const deadlineDate = parseCountdown(u.deadlineCountdown);
      if (deadlineDate) {
        const days = daysUntil(deadlineDate);
        if (REMINDER_DAYS.includes(days)) {
          subscribers.forEach(s => jobs.push({
            uid: s.uid, token: s.token,
            title: `⏰ ${u.name} — আবেদনের ডেডলাইন`,
            body: days === 1 ? 'আগামীকাল আবেদনের শেষ দিন!' : `আর মাত্র ${days} দিন বাকি আবেদনের জন্য।`,
            dedupKey: `${s.uid}_${uniId}_deadline_${days}`
          }));
        }
      }

      const units = Array.isArray(u.examUnits) && u.examUnits.length
        ? u.examUnits
        : ((u.examDate || u.examCountdown) ? [{ unit: u.examUnit || '', examCountdown: u.examCountdown || '' }] : []);

      units.forEach((unit, idx) => {
        const examDate = parseCountdown(unit.examCountdown);
        if (!examDate) return;
        const days = daysUntil(examDate);
        if (!REMINDER_DAYS.includes(days)) return;
        const unitLabel = unit.unit ? ` (${unit.unit})` : '';
        subscribers.forEach(s => jobs.push({
          uid: s.uid, token: s.token,
          title: `📝 ${u.name}${unitLabel} — পরীক্ষার তারিখ`,
          body: days === 1 ? 'আগামীকাল পরীক্ষা!' : `আর মাত্র ${days} দিন বাকি পরীক্ষার জন্য।`,
          dedupKey: `${s.uid}_${uniId}_exam_${idx}_${days}`
        }));
      });
    });

    // De-dupe against a log of already-sent reminders (so re-running the
    // cron the same day never sends the same reminder twice), then send.
    let sent = 0, skipped = 0, failed = 0;
    for (const job of jobs) {
      const logRef = db.collection('notif_log').doc(job.dedupKey);
      const logDoc = await logRef.get();
      if (logDoc.exists) { skipped++; continue; }

      const result = await sendToTokens([job.token], job.title, job.body, null, async () => {
        await db.collection('users').doc(job.uid).update({
          fcmToken: admin.firestore.FieldValue.delete()
        }).catch(() => {});
      });
      sent += result.sent;
      failed += result.failed;
      await logRef.set({ sentAt: new Date() });
    }

    res.status(200).json({ evaluated: jobs.length, sent, skipped, failed });
  } catch (err) {
    console.error('send-reminders failed:', err);
    res.status(500).json({ error: err.message });
  }
};
