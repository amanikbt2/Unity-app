import { Platform } from 'react-native';
import { getPendingPosts, deletePendingPost } from './DatabaseService';
import * as Notifications from 'expo-notifications';
import { scheduleLocalNotification } from './NotificationService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";

function getFileNameFromUri(uri) {
  if (!uri || typeof uri !== 'string') return 'upload.jpg';
  const lastSegment = uri.split('/').pop() || 'upload.jpg';
  return lastSegment.includes('.') ? lastSegment : 'upload.jpg';
}

function getMimeTypeFromUri(uri) {
  const lower = (uri || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.m4v')) return 'video/x-m4v';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  return 'image/jpeg';
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }
  return data;
}

export async function fetchPosts() {
  return requestJson('/api/posts');
}

export async function createPost({
  content,
  authorId,
  authorName,
  authorAvatar,
  authorFlag,
  authorNativeLang,
  imageUris,
  imageUrls,
  mediaType,
  backgroundKey,
  description,
}) {
  const formData = new FormData();
  formData.append('content', content);
  formData.append('authorId', authorId || '');
  formData.append('authorName', authorName || '');
  formData.append('authorAvatar', authorAvatar || '');
  formData.append('authorFlag', authorFlag || '🌍');
  formData.append('authorNativeLang', authorNativeLang || '');
  formData.append('mediaType', mediaType || 'text');
  formData.append('backgroundKey', backgroundKey || '');
  formData.append('description', description || '');

  if (imageUris && Array.isArray(imageUris)) {
    for (const uri of imageUris) {
      if (Platform.OS === 'web') {
        try {
          const res = await fetch(uri);
          const blob = await res.blob();
          formData.append('images', blob, getFileNameFromUri(uri));
        } catch (e) {
          console.error("Failed to append web image blob", e);
        }
      } else if (uri.startsWith('file://')) {
        formData.append('images', {
          uri: uri,
          name: getFileNameFromUri(uri),
          type: getMimeTypeFromUri(uri),
        });
      }
    }
  }

  if (imageUrls && Array.isArray(imageUrls)) {
    formData.append('imageUrls', JSON.stringify(imageUrls));
  }

  return requestJson('/api/posts', {
    method: 'POST',
    body: formData,
  });
}

export async function togglePostLike(postId, userKey) {
  return requestJson(`/api/posts/${postId}/like`, {
    method: 'POST',
    body: JSON.stringify({ userKey }),
  });
}

export async function addPostComment(postId, comment) {
  return requestJson(`/api/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(comment),
  });
}

export async function deletePost(postId, userKey) {
  return requestJson(`/api/posts/${postId}`, {
    method: 'DELETE',
    body: JSON.stringify({ userKey }),
  });
}

export async function syncPendingPosts() {
  const pending = await getPendingPosts();
  if (pending.length === 0) return;

  for (const item of pending) {
    try {
      await createPost(item.payload);
      await deletePendingPost(item.id);
      
      scheduleLocalNotification(
        "Upload Complete",
        "Your post was successfully uploaded.",
        { seconds: 1 }
      );
    } catch (e) {
      console.error("Failed to sync pending post", item.id, e);
    }
  }
}
