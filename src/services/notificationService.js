import { supabase, useSupabase } from '../supabase.js';

export const getNotifications = async () => {
  if (!useSupabase) {
    return { success: true, data: [], error: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: true, data: [], error: null };
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: data || [], error: null };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};

export const getUnreadCount = async () => {
  if (!useSupabase) {
    return { count: 0 };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { count: 0 };
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', session.user.id)
      .eq('is_read', false);

    if (error) {
      return { count: 0 };
    }

    return { count: count || 0 };
  } catch (err) {
    return { count: 0 };
  }
};

export const markRead = async (notificationId) => {
  if (!useSupabase || !notificationId) {
    return { success: false, error: 'Notification ID required.' };
  }

  try {
    const { data, error } = await supabase.rpc('mark_notification_read', { notification_id: notificationId });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const markAllRead = async () => {
  if (!useSupabase) {
    return { success: true };
  }

  try {
    const { data, error } = await supabase.rpc('mark_all_notifications_read');
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const subscribeToNotifications = (userId, onNotification) => {
  if (!useSupabase || !userId) {
    return { unsubscribe: () => {} };
  }

  const channel = supabase
    .channel(`public:notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`
      },
      (payload) => {
        if (payload.new && onNotification) {
          onNotification(payload.new);
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    }
  };
};
