import { defineModule } from '../sdk/define';
import { manifest } from './manifest';
import { Page } from './Page';
import { RecCard } from './RecCard';

export default defineModule({ manifest, Page, FeedCard: RecCard });
