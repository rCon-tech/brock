import { defineModule } from '../sdk/define';
import { manifest } from './manifest';
import { Page } from './Page';
import { Widget } from './Widget';

export default defineModule({ manifest, Page, Widget });
