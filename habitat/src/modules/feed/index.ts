import { defineModule } from '../sdk/define';
import { FeedCard } from './FeedCard';
import { manifest } from './manifest';
import { Page } from './Page';

export default defineModule({ manifest, Page, FeedCard });
