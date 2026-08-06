import { supabase, useSupabase } from '../supabase.js';

const MAX_AVATAR_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const validateAvatarFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, and WebP images are allowed.' };
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return { valid: false, error: 'Avatar file size must be less than 3 MB.' };
  }

  return { valid: true, error: null };
};

export const uploadAvatar = async (file) => {
  const valRes = validateAvatarFile(file);
  if (!valRes.valid) {
    return { success: false, url: null, error: valRes.error };
  }

  if (!useSupabase) {
    return { success: false, url: null, error: 'Supabase storage disabled.' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, url: null, error: 'User must be authenticated to upload avatar.' };
    }

    const userId = session.user.id;
    const fileExt = file.name.split('.').pop() || 'webp';
    const filePath = `${userId}/avatar_${Date.now()}.${fileExt}`;

    const { data, error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadErr) {
      return { success: false, url: null, error: uploadErr.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl || null;

    if (!publicUrl) {
      return { success: false, url: null, error: 'Failed to generate public URL for uploaded avatar.' };
    }

    // Update profile table with avatar URL
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (profileErr) {
      console.warn('[AVATAR SERVICE] Profile avatar_url update warning:', profileErr.message);
    }

    return { success: true, url: publicUrl, error: null };
  } catch (err) {
    return { success: false, url: null, error: err.message };
  }
};
