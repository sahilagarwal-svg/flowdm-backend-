// In-memory message queue with automatic retry.
// On Instagram API failure, FlowEngine enqueues the message here.
// The worker retries every 30 s, up to MAX_RETRIES times.

const RETRY_DELAY_MS = 30 * 1000;
const MAX_RETRIES    = 3;
const POLL_INTERVAL  = 5 * 1000; // check queue every 5 s

class MessageQueue {
  constructor() {
    this.queue      = [];
    this.processing = false;
    setInterval(() => this._process(), POLL_INTERVAL);
  }

  // Called by FlowEngine when a direct send fails
  enqueue(task) {
    const item = { ...task, retries: 0, nextRetryAt: Date.now() };
    this.queue.push(item);
    console.log(`[Queue] Enqueued ${task.type} DM for ${task.recipientId} — queue size: ${this.queue.length}`);
  }

  async _process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const now   = Date.now();
    const ready = this.queue.filter((t) => t.nextRetryAt <= now);

    for (const task of ready) {
      this.queue.splice(this.queue.indexOf(task), 1);
      try {
        // Require lazily to avoid circular deps (InstagramAPI → nothing; FlowEngine → Queue → InstagramAPI)
        const api = require("./InstagramAPI");
        if (task.type === "image") {
          await api.sendImageDM(task.recipientId, task.imageUrl);
        } else {
          await api.sendDM(task.recipientId, task.message);
        }
        console.log(`[Queue] Delivered queued ${task.type} DM to ${task.recipientId}`);
      } catch (err) {
        task.retries += 1;
        if (task.retries < MAX_RETRIES) {
          task.nextRetryAt = Date.now() + RETRY_DELAY_MS;
          this.queue.push(task);
          console.warn(`[Queue] Retry ${task.retries}/${MAX_RETRIES} for ${task.recipientId} in 30 s — ${err.message}`);
        } else {
          console.error(`[Queue] Dropped ${task.type} DM to ${task.recipientId} after ${MAX_RETRIES} retries — ${err.message}`);
        }
      }
    }

    this.processing = false;
  }
}

module.exports = new MessageQueue();
