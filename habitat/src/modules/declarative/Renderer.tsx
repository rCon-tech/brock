'use client';

import type { ReactNode } from 'react';
import type { CollectionDef, ModuleManifest } from '../sdk/types';
import { CounterBlock } from './blocks/CounterBlock';
import { FormBlock } from './blocks/FormBlock';
import { ImageGridBlock } from './blocks/ImageGridBlock';
import { ListBlock } from './blocks/ListBlock';
import { TabsBlock } from './blocks/TabsBlock';
import type { ViewNode } from './mdl-schema';

/** Turns a validated view tree into React, using the same SDK hooks as hand-written modules. */
export function Renderer({ manifest, view }: { manifest: ModuleManifest; view: ViewNode }) {
  const id = manifest.id;
  const def = (c: string): CollectionDef => manifest.collections[c]!;

  const render = (node: ViewNode, key?: string | number): ReactNode => {
    switch (node.type) {
      case 'stack':
        return (
          <div key={key} className="space-y-4">
            {node.children.map((c, i) => render(c, i))}
          </div>
        );
      case 'text':
        return (
          <p
            key={key}
            className={
              node.style === 'title'
                ? 'text-2xl font-extrabold'
                : node.style === 'muted'
                  ? 'text-sm text-ink-soft'
                  : ''
            }
          >
            {node.text}
          </p>
        );
      case 'form':
        return (
          <FormBlock
            key={key}
            moduleId={id}
            collection={node.collection}
            def={def(node.collection)}
            title={node.title}
            submitLabel={node.submitLabel}
            fields={node.fields}
          />
        );
      case 'list':
        return (
          <ListBlock
            key={key}
            moduleId={id}
            collection={node.collection}
            filter={node.filter}
            order={node.order}
            empty={node.empty}
            cells={node.cells}
          />
        );
      case 'tabs':
        return (
          <TabsBlock
            key={key}
            tabs={node.tabs.map((t) => ({ label: t.label, content: render(t.view) }))}
          />
        );
      case 'counter':
        return (
          <CounterBlock
            key={key}
            moduleId={id}
            collection={node.collection}
            filter={node.filter}
            label={node.label}
          />
        );
      case 'image-grid':
        return (
          <ImageGridBlock key={key} moduleId={id} collection={node.collection} field={node.field} />
        );
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{manifest.name}</h1>
      {render(view)}
    </div>
  );
}
