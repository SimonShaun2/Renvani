import { defineArrayMember, defineField } from "sanity";

/** Shared SEO content fields for `post` and `comparisonPage`. */
export const seoContentFields = [
  defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
  defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title", maxLength: 96 }, validation: (r) => r.required() }),
  defineField({ name: "seoTitle", title: "SEO title", type: "string", validation: (r) => r.max(70) }),
  defineField({ name: "metaDescription", title: "Meta description", type: "text", rows: 3, validation: (r) => r.max(160) }),
  defineField({ name: "ogImage", title: "Social share image", type: "image" }),
  defineField({ name: "publishedAt", title: "Published at", type: "datetime" }),
  defineField({ name: "body", title: "Body", type: "array", of: [defineArrayMember({ type: "block" })] }),
  defineField({
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
  })
];
