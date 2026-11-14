import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/** On native, TUS needs a local file, so remote demo files are downloaded to the cache first. */
export async function localUri(uri: string): Promise<string> {
  if (Platform.OS === 'web' || !/^https?:/.test(uri)) return uri;
  const dest = `${FileSystem.cacheDirectory}takeone-${Date.now()}.mp4`;
  return (await FileSystem.downloadAsync(uri, dest)).uri;
}
