const FIELDS = `title, "slug": slug.current, seoTitle, metaDescription, "ogImageUrl": ogImage.asset->url, publishedAt, body, faq[]{question, answer}`;

export const LIST_QUERY = `*[_type == $type && defined(slug.current) && !(_id in path("drafts.**"))] | order(publishedAt desc){title, "slug": slug.current, metaDescription, publishedAt}`;
export const DOC_QUERY = `*[_type == $type && slug.current == $slug && !(_id in path("drafts.**"))][0]{${FIELDS}}`;
export const SLUGS_QUERY = `*[_type in ["post", "comparisonPage"] && defined(slug.current) && !(_id in path("drafts.**"))]{_type, "slug": slug.current, _updatedAt}`;
