const NOT_DRAFT = `!(_id in path("drafts.**"))`;
const IMAGE = (field: string) => `${field}{"url": asset->url, alt}`;
const BODY = `body[]{..., _type == "inlineImage" => {"url": asset->url, alt}}`;

const POST_FIELDS = `title, "slug": slug.current, metaTitle, metaDescription, targetKeyword, excerpt, "featuredImage": ${IMAGE("featuredImage")}, author, publishedAt, updatedAt, ${BODY}, "relatedPosts": relatedPosts[]->{title, "slug": slug.current, excerpt}[defined(slug)], cta{label, href}, faq[]{question, answer}`;
const COMPARISON_FIELDS = `title, "slug": slug.current, metaTitle, metaDescription, "featuredImage": ${IMAGE("ogImage")}, publishedAt, ${BODY}, faq[]{question, answer}`;

export const LIST_QUERY = `*[_type == $type && defined(slug.current) && ${NOT_DRAFT}] | order(publishedAt desc){title, "slug": slug.current, metaDescription, excerpt, publishedAt}`;
export const POST_QUERY = `*[_type == "post" && slug.current == $slug && ${NOT_DRAFT}][0]{${POST_FIELDS}}`;
export const COMPARISON_QUERY = `*[_type == "comparisonPage" && slug.current == $slug && ${NOT_DRAFT}][0]{${COMPARISON_FIELDS}}`;
export const SLUGS_QUERY = `*[_type in ["post", "comparisonPage"] && defined(slug.current) && ${NOT_DRAFT}]{_type, "slug": slug.current, _updatedAt}`;
