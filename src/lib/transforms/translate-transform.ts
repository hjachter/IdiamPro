'use client';

/**
 * The "translate" transform — implements NodeTransformer against the
 * translateNodeContentAction server action. Plugs into the same engine as
 * refresh; no engine changes needed.
 */

import type { NodeTransformer, TransformNodeContext } from './transform-engine';
import { translateNodeContentAction } from '@/app/actions';
import { getUserApiKey } from '@/lib/byok-keys';

export interface TranslateTransformConfig {
  targetLanguage: string;
  useLocal: boolean;
}

export function createTranslateTransformer(config: TranslateTransformConfig): NodeTransformer {
  return {
    kind: 'translate',
    async transformNode(ctx: TransformNodeContext) {
      const result = await translateNodeContentAction({
        userApiKey: getUserApiKey('gemini'),
        nodeName: ctx.node.name,
        ancestorPath: ctx.ancestorPath,
        currentContent: ctx.node.content || '',
        targetLanguage: config.targetLanguage,
        useLocal: config.useLocal,
      });
      return {
        afterContent: result.content,
        citations: result.citations,
        changed: result.changed,
        error: result.error,
        model: result.model,
        modelProvider: result.modelProvider,
        webGrounded: result.webGrounded,
      };
    },
  };
}
