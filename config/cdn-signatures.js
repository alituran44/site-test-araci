module.exports = {
  'Vercel Edge Network': ['x-vercel-id', 'x-vercel-cache'],
  'Netlify Edge': ['x-nf-request-id'],
  'Cloudflare': ['cf-ray', 'cf-cache-status'],
  'Fastly': ['x-served-by', 'x-fastly-request-id'],
  'Amazon CloudFront': ['x-amz-cf-id'],
  'Akamai': ['x-akamai-transformed', 'x-akamai-request-id', 'x-akamai-session-info']
};
