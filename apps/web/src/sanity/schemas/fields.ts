import { defineArrayMember, defineField } from "sanity";

const requiredAlt = defineField({
  name: "alt",
  title: "Alt text",
  type: "string",
  description: "Describe the image for screen readers and search.",
  validation: (r) => r.required().min(3).max(160)
});

/** Image with REQUIRED alt text (featured images and inline body images). */
export const imageWithAlt = (name: string, title: string) =>
  defineField({ name, title, type: "image", options: { hotspot: true }, fields: [requiredAlt] });

/** Portable Text: paragraphs, H2/H3, quotes, bullet/number lists, links and inline images with required alt. */
export const portableBody = defineField({
  name: "body",
  title: "Body",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Normal", value: "normal" },
        { title: "H2", value: "h2" },
        { title: "H3", value: "h3" },
        { title: "Quote", value: "blockquote" }
      ],
      lists: [
        { title: "Bullet", value: "bullet" },
        { title: "Numbered", value: "number" }
      ]
    }),
    defineArrayMember({ type: "image", name: "inlineImage", title: "Image", options: { hotspot: true }, fields: [requiredAlt] })
  ]
});

export const faqField = defineField({
  name: "faq",
  title: "FAQ (optional)",
  type: "array",
  of: [
    defineArrayMember({
      type: "object",
      name: "faqItem",
      fields: [
        defineField({ name: "question", title: "Question", type: "string", validation: (r) => r.required() }),
        defineField({ name: "answer", title: "Answer", type: "text", rows: 3, validation: (r) => r.required() })
      ]
    })
  ]
});

const titleField = defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required().max(120) });
const slugField = defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title", maxLength: 96 }, validation: (r) => r.required() });
const metaTitleField = defineField({ name: "metaTitle", title: "Meta title", type: "string", validation: (r) => r.max(70) });
const metaDescriptionField = defineField({ name: "metaDescription", title: "Meta description", type: "text", rows: 3, validation: (r) => r.max(160) });
const publishedAtField = defineField({ name: "publishedAt", title: "Published at", type: "datetime" });

const EDITORIAL_NOTE = "Home services only. Do not name other software products. If fees are mentioned, the Service Fee is 5%.";

/** Blog post: full SEO article model. */
export const postFields = [
  titleField,
  slugField,
  metaTitleField,
  metaDescriptionField,
  defineField({ name: "targetKeyword", title: "Target keyword", type: "string", validation: (r) => r.max(80) }),
  defineField({ name: "excerpt", title: "Excerpt", type: "text", rows: 3, description: EDITORIAL_NOTE, validation: (r) => r.max(300) }),
  imageWithAlt("featuredImage", "Featured image"),
  defineField({ name: "author", title: "Author", type: "string", validation: (r) => r.max(80) }),
  publishedAtField,
  defineField({ name: "updatedAt", title: "Updated at", type: "datetime" }),
  portableBody,
  defineField({
    name: "relatedPosts",
    title: "Related posts",
    type: "array",
    of: [defineArrayMember({ type: "reference", to: [{ type: "post" }] })],
    validation: (r) => r.max(3).unique()
  }),
  defineField({
    name: "cta",
    title: "Call to action",
    type: "object",
    fields: [
      defineField({ name: "label", title: "Label", type: "string", validation: (r) => r.max(40) }),
      defineField({
        name: "href",
        title: "Link",
        type: "string",
        description: "Site path such as /demo or /growth-check.",
        validation: (r) => r.regex(/^\/[a-z0-9\-/]*$/, { name: "site path" })
      })
    ]
  }),
  faqField
];

/** Comparison page. Product names are authored in the CMS, never hard-coded here. */
export const comparisonFields = [
  titleField,
  slugField,
  metaTitleField,
  metaDescriptionField,
  imageWithAlt("ogImage", "Social share image"),
  publishedAtField,
  portableBody,
  faqField
];
