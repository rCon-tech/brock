import { loadMdl } from '../declarative/load';
import { createElement } from 'react';
import { Renderer } from '../declarative/Renderer';
import { defineModule } from '../sdk/define';
import doc from './module.json';

const { manifest, views } = loadMdl(doc);

/** A module with no code of its own: the platform renders its JSON definition. */
export default defineModule({
  manifest,
  Page: () => createElement(Renderer, { manifest, view: views.main }),
});
