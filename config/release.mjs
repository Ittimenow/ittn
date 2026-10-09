export const redirects = {
  '/services/web': '/services/sites/',
  '/soprovozhdenie-vashih-it-proektov': '/services/support/',
};
export const internalPaths = ['/design-system/', '/global-styles/', '/idea/', '/hero-lab/', '/404.html', '/404/'];
export function releaseConfig(env = process.env) {
  const production = env.DEPLOY_ENV === 'production';
  if (env.DEPLOY_ENV && !['staging', 'production'].includes(env.DEPLOY_ENV)) throw new Error('DEPLOY_ENV must be staging or production');
  if (production && !env.SITE_URL) throw new Error('Production requires SITE_URL');
  const site = new URL(env.SITE_URL || 'https://ittimenow-ittn-020d.twc1.net');
  if (!['https:', 'http:'].includes(site.protocol) || site.pathname !== '/' || site.search || site.hash || site.username || site.password) throw new Error('SITE_URL must be an absolute site origin without a path or credentials');
  if (production && (site.protocol !== 'https:' || /(^localhost$|\.test$|\.invalid$|\.twc1\.net$|^127\.)/.test(site.hostname))) throw new Error('Production requires the public HTTPS domain in SITE_URL');
  return { production, site: site.origin, redirects, internalPaths };
}
