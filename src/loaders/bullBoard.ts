import { createBullBoard } from "@bull-board/api";
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";

import {
  fullSyncQueue,
  incrementalSyncQueue,
  notificationChannelsRefreshQueue,
} from "../services/calendarSync";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

const queues = [
  new BullMQAdapter(fullSyncQueue),
  new BullMQAdapter(incrementalSyncQueue),
  new BullMQAdapter(notificationChannelsRefreshQueue),
];

createBullBoard({
  queues,
  serverAdapter,
});

export default serverAdapter;
