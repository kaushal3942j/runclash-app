import { supabase, useSupabase } from '../supabase';

/**
 * Upload media to Supabase storage.
 * @param {string} base64Data 
 * @param {string} mediaType - 'photo' or 'video'
 * @param {string} format - e.g. 'jpeg'
 * @param {string} userId
 */
export const uploadMedia = async (base64Data, mediaType, format, userId) => {
  if (!useSupabase) {
    throw new Error("Supabase is disabled.");
  }
  
  const fileName = `${userId}/${Date.now()}.${format}`;
  
  // Convert base64 to Blob
  const res = await fetch(`data:image/${format};base64,${base64Data}`);
  const blob = await res.blob();
  
  const { data, error } = await supabase.storage
    .from('social_media')
    .upload(fileName, blob, {
      contentType: `image/${format}`
    });
    
  if (error) {
    console.error("uploadMedia error:", error);
    throw error;
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('social_media')
    .getPublicUrl(fileName);
    
  return publicUrl;
};

/**
 * Create a new social post
 */
export const createPost = async (userId, mediaUrl, mediaType, caption, visibility = 'public', runId = null, territoryId = null) => {
  if (!useSupabase) return { success: false, error: 'Supabase disabled' };
  
  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      user_id: userId,
      media_url: mediaUrl,
      media_type: mediaType,
      caption: caption,
      visibility: visibility,
      run_id: runId,
      territory_id: territoryId
    })
    .select()
    .single();
    
  if (error) {
    console.error("createPost error:", error);
    return { success: false, error: error.message };
  }
  
  return { success: true, data };
};

/**
 * Fetch social posts for feed
 */
export const fetchPosts = async (feedType = 'global') => {
  if (!useSupabase) return { success: false, data: [] };
  
  let query = supabase
    .from('social_posts')
    .select(`
      *,
      profiles:user_id (id, display_name, avatar_url, clan_name),
      social_likes(count),
      social_comments(count)
    `)
    .order('created_at', { ascending: false });
    
  if (feedType === 'mine') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    query = query.eq('user_id', user.id);
  } else if (feedType === 'global') {
    query = query.eq('visibility', 'public');
  }
  // 'friends' feed would require complex join via friendships which is handled by RLS, 
  // but we can query visibility in ('public', 'friends') and let RLS filter out non-friends' friends posts.
  
  const { data, error } = await query.limit(50);
  
  if (error) {
    console.error("fetchPosts error:", error);
    return { success: false, error: error.message };
  }
  
  return { success: true, data };
};

export const toggleLikePost = async (postId) => {
  if (!useSupabase) return { success: false };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Check if liked
  const { data: existing } = await supabase.from('social_likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
  
  if (existing) {
    // unlike
    const { error } = await supabase.from('social_likes').delete().eq('id', existing.id);
    return { success: !error, action: 'unliked', error: error?.message };
  } else {
    // like
    const { error } = await supabase.from('social_likes').insert({ post_id: postId, user_id: user.id });
    return { success: !error, action: 'liked', error: error?.message };
  }
};

export const addComment = async (postId, text) => {
  if (!useSupabase) return { success: false };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data, error } = await supabase.from('social_comments').insert({
    post_id: postId,
    user_id: user.id,
    text: text
  }).select('*, profiles:user_id(display_name, avatar_url)').single();

  return { success: !error, data, error: error?.message };
};

export const getComments = async (postId) => {
  if (!useSupabase) return { success: false };
  const { data, error } = await supabase.from('social_comments')
    .select('*, profiles:user_id(display_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  return { success: !error, data, error: error?.message };
};
