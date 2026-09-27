import { describe, expect, it } from 'vitest';

import { GenericWebContentProvider } from '../../../../src/modules/content/providers/generic/generic-web-content-provider.js';
import { EvidenceBuilder } from '../../../../src/modules/evidence/application/evidence-builder.js';
import { htmlFetch, webFixture } from '../../../helpers/web-fixtures.js';

const ctx = { jobId: 'job-1', outputLanguage: 'en', tempDir: '/tmp/test' };

describe('EvidenceBuilder structured web evidence', () => {
  it('renders structured data and page text as their own prompt sections', async () => {
    const content = await new GenericWebContentProvider({
      fetchImpl: htmlFetch(webFixture('recipe-blog-graph.html')),
    }).acquire('https://bake.example/banana-bread/', ctx);
    const builder = new EvidenceBuilder();
    const items = builder.build({ acquiredContent: content });

    expect(items.map((i) => i.metadata?.field).filter(Boolean)).toEqual([
      'title',
      'structured_recipe',
      'page_text',
    ]);

    const prompt = builder.formatForPrompt(items);
    const structuredAt = prompt.indexOf('Structured recipe data published by the page');
    const pageTextAt = prompt.indexOf('Page text (readable text');
    expect(structuredAt).toBeGreaterThan(0);
    expect(pageTextAt).toBeGreaterThan(structuredAt);
    expect(prompt).toContain('Yield: 1 loaf (10 slices) (servings: 1)');
    expect(prompt).toContain('Batter:\n1. Mash the bananas');
    expect(prompt).toContain('Bake:\n3. Bake at 175°C for 60 minutes.');
    expect(prompt).toContain('Calories per serving: 210');
    expect(prompt).not.toContain('Metadata:');
  });

  it('adds nothing new for content without structured data or page text', () => {
    const items = new EvidenceBuilder().build({
      acquiredContent: {
        sourceType: 'INSTAGRAM',
        originalUrl: 'https://instagram.com/reel/1',
        normalizedUrl: 'https://instagram.com/reel/1',
        caption: '200g spaghetti',
        images: [],
        metadata: {},
      },
    });
    expect(items).toHaveLength(1);
  });
});
