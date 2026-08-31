import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPromise } from 'node:util/types';
import {
	createComponent,
	createHeadAndContent,
	renderComponent,
	renderTemplate,
	unescapeHTML,
} from '../../../../dist/runtime/server/index.js';
import type { RenderDestination } from '../../../../dist/runtime/server/render/common.js';

function createPartialResult() {
	return {
		partial: true,
		clientDirectives: new Map(),
		componentMetadata: new Map(),
		_metadata: {
			hasRenderedHead: false,
			headInTree: false,
			propagators: new Set(),
			extraHead: [] as string[],
			routeHasPropagation: false,
			pendingSlotEvaluations: [] as Promise<unknown>[],
		},
	};
}

function createNonPartialResult() {
	return {
		...createPartialResult(),
		partial: false,
	};
}

function renderToString(item: any): string | Promise<string> {
	if (isPromise(item)) {
		return item.then(renderToString);
	}
	let result = '';
	const destination: RenderDestination = {
		write: (chunk) => {
			result += chunk.toString();
		},
	};
	const renderResult = item.render(destination);
	if (isPromise(renderResult)) {
		return renderResult.then(() => result);
	}
	return result;
}

describe('partial pages emit propagated head content inline', () => {
	it('emits head content for HeadAndContent in partial pages', async () => {
		const styleContent = '<style>.test{color:red}</style>';
		const PropagatingContent = createComponent(
			{
				factory(_result) {
					return createHeadAndContent(
						unescapeHTML(styleContent),
						renderTemplate`<div class="test">content</div>`,
					);
				},
				propagation: 'self',
			},
		);

		const result = createPartialResult();
		const rendered = renderComponent(result as any, 'PropagatingContent', PropagatingContent, {});
		const html = await renderToString(rendered);

		assert.ok(html.includes('.test{color:red}'), 'styles should be emitted inline for partials');
		assert.ok(html.includes('<div class="test">content</div>'), 'content should be rendered');
	});

	it('does not emit head content for HeadAndContent on non-partial pages', async () => {
		const styleContent = '<style>.test{color:red}</style>';
		const PropagatingContent = createComponent(
			{
				factory(_result) {
					return createHeadAndContent(
						unescapeHTML(styleContent),
						renderTemplate`<div class="test">content</div>`,
					);
				},
				propagation: 'self',
			},
		);

		const result = createNonPartialResult();
		const rendered = renderComponent(result as any, 'PropagatingContent', PropagatingContent, {});
		const html = await renderToString(rendered);

		assert.ok(
			!html.includes('.test{color:red}'),
			'styles should NOT be emitted inline for non-partial pages (handled by renderAllHeadContent)',
		);
		assert.ok(html.includes('<div class="test">content</div>'), 'content should be rendered');
	});

	it('handles nested propagating components inside a wrapper on partial pages', async () => {
		const styleContent = '<style>.nested{border:1px solid blue}</style>';
		const InnerContent = createComponent(
			{
				factory(_result) {
					return createHeadAndContent(
						unescapeHTML(styleContent),
						renderTemplate`<span class="nested">inner</span>`,
					);
				},
				propagation: 'self',
			},
		);

		const Wrapper = createComponent((result) => {
			return renderTemplate`<div>${renderComponent(result, 'InnerContent', InnerContent, {})}</div>`;
		});

		const result = createPartialResult();
		const rendered = renderComponent(result as any, 'Wrapper', Wrapper, {});
		const html = await renderToString(rendered);

		assert.ok(
			html.includes('.nested{border:1px solid blue}'),
			'nested propagated styles should be emitted inline for partials',
		);
		assert.ok(html.includes('<span class="nested">inner</span>'), 'nested content should render');
	});
});
