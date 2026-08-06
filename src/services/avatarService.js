import { supabase, useSupabase } from '../supabase.js';

const withTimeout = (promise, ms = 15000) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Upload timed out.')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

export const uploadAvatar = async (file) => {
  if (!useSupabase) {
    return { success: false, avatarUrl: null, error: 'Supabase storage disabled.' };
  }

  if (!file) {
    return { success: false, avatarUrl: null, error: 'No file provided.' };
  }

  // 1. MIME type validation
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { success: false, avatarUrl: null, error: 'File must be JPEG, PNG, or WebP.' };
  }

  // 2. File size validation
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { success: false, avatarUrl: null, error: 'File size exceeds 3 MB limit.' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, avatarUrl: null, error: 'Not authenticated.' };
    }

    const userId = session.user.id;
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/avatar_${Date.now()}.${fileExt}`;

    // Upload to avatars bucket
    const { error: uploadError } = await withTimeout(
      supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true }),
      15000
    );

    if (uploadError) {
      return { success: false, avatarUrl: null, error: uploadError.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // Update user profile avatar_url
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return { success: true, avatarUrl: publicUrl, error: null };
  } catch (err) {
    return { success: false, avatarUrl: null, error: err.message };
  }
};
