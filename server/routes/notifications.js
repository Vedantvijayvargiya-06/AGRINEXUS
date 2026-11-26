import { Router } from 'express';
import {
  listNotificationsForUser,
  getNotificationById,
  markNotificationRead,
  markAllNotificationsRead
} from '../store.js';
import { requireAuth, HttpError } from '../security.js';

const router = Router();

router.get('', requireAuth, (req, res) => {
  const notifs = listNotificationsForUser(req.currentUser.id);

  res.json(
    notifs.map((n) => ({
      id: n.id,
      user_id: n.user_id,
      batch_id: n.batch_id,
      title: n.title,
      title_hi: n.title_hi,
      message: n.message,
      message_hi: n.message_hi,
      type: n.type,
      severity: n.severity,
      is_read: n.is_read,
      sent_sms: n.sent_sms,
      created_at: new Date(n.created_at).toISOString()
    }))
  );
});

router.put('/read-all', requireAuth, (req, res) => {
  markAllNotificationsRead(req.currentUser.id);
  res.json({ status: 'success' });
});

router.put('/:notifId/read', requireAuth, (req, res, next) => {
  try {
    const notifId = Number(req.params.notifId);
    if (!Number.isInteger(notifId) || notifId <= 0) {
      throw new HttpError(400, 'Invalid notification ID');
    }
    const notif = getNotificationById(notifId);
    if (!notif) {
      throw new HttpError(404, 'Notification not found');
    }
    if (notif.user_id !== req.currentUser.id) {
      throw new HttpError(403, 'Access denied');
    }
    markNotificationRead(notifId);
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
});

export default router;
