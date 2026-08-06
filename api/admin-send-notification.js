

const { admin, db, requireAdmin, sendToTokens } = require('./_lib/notify-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { idToken, type, uniId, unitIndex, title, message } = req.body || {};

  try {
    await requireAdmin(idToken);
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }

  try {
    if (type === 'apply' || type === 'exam') {
      if (!uniId) return res.status(400).json({ error: 'uniId is required' });

      const uniDoc = await db.collection('universities').doc(uniId).get();
      if (!uniDoc.exists) return res.status(404).json({ error: 'University not found' });
      const u = uniDoc.data();

      let notifTitle, notifBody;
      if (type === 'apply') {
        notifTitle = `⏰ ${u.name} — আবেদনের রিমাইন্ডার`;
        notifBody = `আবেদনের ডেডলাইন: ${u.deadline || 'শীঘ্রই'}। এখনই আবেদন করুন।`;
      } else {
        const units = Array.isArray(u.examUnits) && u.examUnits.length ? u.examUnits : [];
        const unit = units[Number(unitIndex)];
        if (!unit) return res.status(400).json({ error: 'Invalid unitIndex for this university' });
        const unitLabel = unit.unit ? ` (${unit.unit})` : '';
        notifTitle = `📝 ${u.name}${unitLabel} — পরীক্ষার রিমাইন্ডার`;
        notifBody = `পরীক্ষার তারিখ: ${unit.examDate || 'শীঘ্রই'}। প্রস্তুতি নিয়ে রাখুন।`;
      }

      // Only users who bookmarked this university get apply/exam reminders
      // — same targeting the automatic daily cron uses.
      const userSnap = await db.collection('users').get();
      const tokens = [];
      const uidByToken = {};
      userSnap.forEach(doc => {
        const uData = doc.data();
        if (uData.fcmToken && Array.isArray(uData.bookmarks) && uData.bookmarks.includes(uniId)) {
          tokens.push(uData.fcmToken);
          uidByToken[uData.fcmToken] = doc.id;
        }
      });

      const result = await sendToTokens(tokens, notifTitle, notifBody, null, async (deadToken) => {
        const uid = uidByToken[deadToken];
        if (uid) {
          await db.collection('users').doc(uid).update({ fcmToken: admin.firestore.FieldValue.delete() }).catch(() => {});
        }
      });

      return res.status(200).json({ mode: type, targeted: tokens.length, ...result });
    }

    if (type === 'custom') {
      if (!title || !message) return res.status(400).json({ error: 'title and message are required' });

      // Broadcasts to every known token — signed-in users' fcmToken *and*
      // anonymous visitors who enabled notifications without an account
      // (one doc per token in the "subscribers" collection, doc ID = the
      // token itself — see assets/notifications.js).
      const [userSnap, subSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('subscribers').get()
      ]);
      const tokenSet = new Set();
      userSnap.forEach(doc => { const t = doc.data().fcmToken; if (t) tokenSet.add(t); });
      subSnap.forEach(doc => { const t = doc.data().token; if (t) tokenSet.add(t); });

      const result = await sendToTokens([...tokenSet], title, message, null, async (deadToken) => {
        await db.collection('subscribers').doc(deadToken).delete().catch(() => {});
      });

      return res.status(200).json({ mode: 'custom', targeted: tokenSet.size, ...result });
    }

    return res.status(400).json({ error: 'Unknown type — expected "apply", "exam", or "custom"' });
  } catch (err) {
    console.error('admin-send-notification failed:', err);
    return res.status(500).json({ error: err.message });
  }
};
