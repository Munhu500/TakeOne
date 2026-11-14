import { Platform } from 'react-native';
import * as tus from 'tus-js-client';
import { localUri } from './sample';
import { SUPABASE_URL, supabase } from './supabase';

/**
 * Resumable (TUS) upload to Supabase Storage: survives flaky mobile connections and resumes from the last chunk.
 * `uri` is a local file uri on native, or a blob:/https: url on web.
 */
export async function uploadResumable(bucket: string, objectName: string, uri: string, contentType: string, onProgress?: (fraction: number) => void): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in again to upload');
  const file = Platform.OS === 'web' ? await (await fetch(uri)).blob() : ({ uri: await localUri(uri) } as unknown as Blob);
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 2000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${token}`, 'x-upsert': 'true' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024, // Supabase requires 6MB chunks
      metadata: { bucketName: bucket, objectName, contentType, cacheControl: '3600' },
      onError: (e) => reject(new Error(e.message.includes('response text') ? 'Upload failed. Check your connection and try again.' : e.message)),
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((prev) => { if (prev[0]) upload.resumeFromPreviousUpload(prev[0]); upload.start(); });
  });
}
