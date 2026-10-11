import {
  registerApprovalWorkers,
  registerEmployeeEventWorker,
  registerNotificationWorker,
  registerScoreWorker,
} from "./platform/queue.js";
import { dispatchApprovalDecided } from "./platform/approvals/events.js";
import { runApprovalSweep } from "./platform/approvals/service.js";
import { requeueStuckEmails, sendNotificationEmail } from "./platform/notifications/service.js";
import { deliverEmployeeEvent, republishMissedEmployeeEvents } from "./modules/core/people/service.js";
import { runScoring } from "./modules/talently/scoring/runScoring.js";

// Handlers that react to approval.decided or employee events must be registered in the worker
// process, because the worker is the one that delivers those events.
export async function registerAllWorkers() {
  await registerScoreWorker(runScoring);
  await registerApprovalWorkers({
    onDecided: dispatchApprovalDecided,
    // The 10-minute sweep also re-queues emails and employee events that never got queued.
    onSweep: async () => {
      await runApprovalSweep();
      await requeueStuckEmails();
      await republishMissedEmployeeEvents();
    },
  });
  await registerNotificationWorker(sendNotificationEmail);
  await registerEmployeeEventWorker(deliverEmployeeEvent);
}