import { requireServerEnv } from '../config/env';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

export type YouTubeRequestOptions = {
  path: string;
  params: Record<string, string | number | boolean | undefined>;
};

export const buildYouTubeUrl = ({ path, params }: YouTubeRequestOptions) => {
  const url = new URL(`${YOUTUBE_API_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
};

export const fetchYouTubeJson = async <T>(options: YouTubeRequestOptions): Promise<T> => {
  const env = requireServerEnv();
  const response = await fetch(buildYouTubeUrl(options), {
    headers: {
      'x-goog-api-key': env.YOUTUBE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

