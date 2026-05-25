'use client';

/**
 * The "refresh" transform (LIVE BOOKS) — implements the NodeTransformer
 * contract against the existing AI provider abstraction via the
 * refreshNodeContentAction server action.
 *
 * A future "translate" transform (#52) would live alongside this file and
 * implement the same NodeTransformer interface, then plug into the same
 * runTransformPreview engine — no engine changes needed.
 */

import type { TransformUpdateMode } from '@/types';
import type { NodeTransformer, TransformNodeContext } from './transform-engine';
import { refreshNodeContentAction } from '@/app/actions';
import { getUserApiKey } from '@/lib/byok-keys';

export interface RefreshTransformConfig {
  updateMode: TransformUpdateMode;
  useLocal: boolean;
}

export function createRefreshTransformer(config: RefreshTransformConfig): NodeTransformer {
  return {
    kind: 'refresh',
    async transformNode(ctx: TransformNodeContext) {
      const result = await refreshNodeContentAction({
      userApiKey: getUserApiKey('gemini'),
        nodeName: ctx.node.name,
        ancestorPath: ctx.ancestorPath,
        currentContent: ctx.node.content || '',
        updateMode: config.updateMode,
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
