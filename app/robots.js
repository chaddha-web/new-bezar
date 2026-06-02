export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bezar.in';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account/', '/admin/', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
