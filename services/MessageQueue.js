const RETRY_DELAY_MS = 30 * 1000;
const MAX_RETRIES    = 3;
const POLL_INTERVAL  = 5 * 1000;

class MessageQueue {
  constructor() {
    this.queue      = [];
    this.processing = false;
    setInterval(() => this._process(), POLL_INTERVAL);
  }

  enqueue(task) {
    const item = { ...task, retries: 0, nextRetryAt: Date.now() };
    this.queue.push(item);
    console.log(`[Queue] Enqueued ${task.type} for ${task.recipientId} — queue size: ${this.queue.length}`);
  }

  async _process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const now   = Date.now();
    const ready = this.queue.filter(t => t.nextRetryAt <= now);

    for (const task of ready) {
      this.queue.splice(this.queue.indexOf(task), 1);
      try {
        const api    = require("./InstagramAPI");
        const client = task.client || null;

        if (task.type === "image") {
          await api.sendImageDM(task.recipientId, task.imageUrl, client);
        } else if (task.type === "video") {
          await api.sendVideoDM(task.recipientId, task.videoUrl, client);
        } else if (task.type === "buttons") {
          await api.sendButtonsDM(task.recipientId, task.text, task.buttons, client);
        } else if (task.type === "carousel") {
          await api.sendCarouselDM(task.recipientId, task.cards, client);
        } else {
          await api.sendDM(task.recipientId, task.message, client);
        }
        console.log(`[Queue] Delivered ${task.type} to ${task.recipientId}`);
      } catch (err) {
        task.retries += 1;
        if (task.retries < MAX_RETRIES) {
          task.nextRetryAt = Date.now() + RETRY_DELAY_MS;
          this.queue.push(task);
          console.warn(`[Queue] Retry ${task.retries}/${MAX_RETRIES} for ${task.recipientId} in 30s — ${err.message}`);
        } else {
          console.error(`[Queue] Dropped ${task.type} to ${task.recipientId} after ${MAX_RETRIES} retries`);
        }
      }
    }

    this.processing = false;
  }
}

module.exports = new MessageQueue();
