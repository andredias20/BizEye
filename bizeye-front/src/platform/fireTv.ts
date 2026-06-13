export const isFireTvLikeDevice = () => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const hasFireTvToken = userAgent.includes('fire tv') || userAgent.includes('firetv');
  const hasFireTvModel = /\baft[a-z0-9]*\b/.test(userAgent);

  return hasFireTvToken || hasFireTvModel;
};
