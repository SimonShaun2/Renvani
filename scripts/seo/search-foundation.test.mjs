// Dependency-free checks for Node >=22.6. Does not replace the app's Vitest suite or a Next.js build.
// Run from repo root: node --experimental-strip-types --test scripts/seo/search-foundation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_SEARCH_COPY, INDUSTRY_SEARCH_COPY, PRODUCT_SEARCH_TITLES, industrySearchCopy, productSearchCopy,
  breadcrumbStructuredData, websiteStructuredData } from '../../apps/web/src/lib/seo/search-foundation.ts';

const origin = 'https://getrenvani.com';
const trail = [{ name: 'Industries', path: '/industries' }, { name: 'HVAC & Refrigeration', path: '/industries/hvac' }];
for (const [slug, copy] of Object.entries(INDUSTRY_SEARCH_COPY)) {
  test(`industry copy: ${slug}`, () => {
    assert.deepEqual(industrySearchCopy({ slug, title: 'fallback', description: 'fallback' }), copy);
    assert.ok(copy.title.includes('Software'));
    assert.ok(copy.title.length <= 70); // Editorial guard, not a Google character-limit claim.
    assert.ok(copy.description.length >= 100 && copy.description.length <= 180);
    assert.ok(copy.description.includes('Renvani'));
  });
}
for (const [slug, title] of Object.entries(PRODUCT_SEARCH_TITLES)) {
  test(`product copy: ${slug}`, () => {
    const copy = productSearchCopy({ slug, name: 'Example', body: 'Approved page description.' });
    assert.equal(copy.title, title);
    assert.equal(copy.description, 'Approved page description.');
    assert.ok(title.length <= 70);
  });
}
test('all 37 target pages have unique search titles', () => {
  const titles = [HOME_SEARCH_COPY.title, ...Object.values(INDUSTRY_SEARCH_COPY).map(x => x.title), ...Object.values(PRODUCT_SEARCH_TITLES)];
  assert.equal(titles.length, 37);
  assert.equal(new Set(titles).size, titles.length);
});
test('industry descriptions are distinct', () => {
  const descriptions = Object.values(INDUSTRY_SEARCH_COPY).map(x => x.description);
  assert.equal(new Set(descriptions).size, 14);
});
for (const slug of ['new-trade', '__proto__', 'constructor', 'toString']) {
  test(`unknown slug retains existing copy: ${slug}`, () => {
    assert.deepEqual(industrySearchCopy({ slug, title: 'Original title', description: 'Original description' }), { title: 'Original title', description: 'Original description' });
    assert.deepEqual(productSearchCopy({ slug, name: 'Original', body: 'Original body' }), { title: 'Original · Renvani', description: 'Original body' });
  });
}
test('caller cannot mutate the registry via a returned copy', () => {
  const copy = industrySearchCopy({ slug: 'hvac', title: '', description: '' });
  copy.title = 'Changed';
  assert.notEqual(INDUSTRY_SEARCH_COPY.hvac.title, 'Changed');
});
test('breadcrumb describes the existing two-item visible hierarchy', () => {
  const result = breadcrumbStructuredData(origin, trail);
  assert.equal(result['@type'], 'BreadcrumbList');
  assert.deepEqual(result.itemListElement.map(x => [x.position, x.name, x.item]), [
    [1, 'Industries', origin + '/industries'], [2, 'HVAC & Refrigeration', origin + '/industries/hvac']
  ]);
});
for (const invalid of [null, '', 'javascript:alert(1)', 'https://user:secret@example.com', 'https://getrenvani.com/path', 'https://getrenvani.com?x=1', 'https://getrenvani.com#fragment', 'not-a-url']) {
  test(`structured data rejects non-origin input: ${invalid}`, () => {
    assert.equal(websiteStructuredData(invalid), null);
    assert.equal(breadcrumbStructuredData(invalid, trail), null);
  });
}
for (const path of ['//other.example', 'https://other.example', '/industries/hvac?email=x', '/industries/hvac#x', '/bad\\path', '/../private', '/%2e%2e/private', '/bad path']) {
  test(`breadcrumb rejects unsafe path: ${path}`, () => {
    assert.equal(breadcrumbStructuredData(origin, [trail[0], { name: 'Bad', path }]), null);
  });
}
test('breadcrumb rejects incomplete or unnamed trails', () => {
  assert.equal(breadcrumbStructuredData(origin, []), null);
  assert.equal(breadcrumbStructuredData(origin, [trail[0]]), null);
  assert.equal(breadcrumbStructuredData(origin, [trail[0], { name: ' ', path: '/industries/hvac' }]), null);
});
test('WebSite identity links to the existing Organization and makes no invented claims', () => {
  const data = websiteStructuredData(origin);
  assert.equal(data['@id'], origin + '/#website');
  assert.equal(data.publisher['@id'], origin + '/#organization');
  assert.equal(data.name, 'Renvani');
  assert.doesNotMatch(JSON.stringify(data), /aggregateRating|reviewCount|offers|sameAs|SearchAction/);
});
