import { defineType } from "sanity";

import { comparisonFields, postFields } from "./fields";

export const post = defineType({ name: "post", title: "Blog post", type: "document", fields: postFields });

/** Comparison pages are authored in the CMS; no product names are hard-coded here. */
export const comparisonPage = defineType({ name: "comparisonPage", title: "Comparison page", type: "document", fields: comparisonFields });

export const schemaTypes = [post, comparisonPage];
