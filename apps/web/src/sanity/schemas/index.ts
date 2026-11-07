import { defineType } from "sanity";

import { seoContentFields } from "./fields";

export const post = defineType({ name: "post", title: "Blog post", type: "document", fields: seoContentFields });

/** Comparison pages are authored in the CMS; no product names are hard-coded here. */
export const comparisonPage = defineType({ name: "comparisonPage", title: "Comparison page", type: "document", fields: seoContentFields });

export const schemaTypes = [post, comparisonPage];
