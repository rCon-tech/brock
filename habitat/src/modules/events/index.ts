import { defineModule } from '../sdk/define';
import { FeedCard } from './FeedCard';
import { manifest } from './manifest';
import { Page } from './Page';
import { Widget } from './Widget';

export default defineModule({ manifest, Page, FeedCard, Widget });
