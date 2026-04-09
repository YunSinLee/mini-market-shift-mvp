import { randomUUID } from "node:crypto";
import {
  ALLOWED_EVENTS,
  REQUIRED_EVENT_CONTEXT_FIELDS
} from "../constants/events.mjs";

export class TelemetryRecorder {
  constructor(eventContext) {
    this._validateContext(eventContext);
    this.eventContext = { ...eventContext };
    this.currentSessionId = null;
    this.records = [];
  }

  _validateContext(context) {
    for (const key of REQUIRED_EVENT_CONTEXT_FIELDS) {
      if (!context[key]) {
        throw new Error(`missing required telemetry field: ${key}`);
      }
    }
  }

  startSession(sessionId = randomUUID(), payload = {}) {
    this.currentSessionId = sessionId;
    return this.emit("session_start", payload);
  }

  emit(eventName, payload = {}) {
    if (!ALLOWED_EVENTS.has(eventName)) {
      throw new Error(`unknown telemetry event: ${eventName}`);
    }
    if (!this.currentSessionId) {
      throw new Error("cannot emit telemetry before startSession");
    }

    const record = {
      ...this.eventContext,
      session_id: this.currentSessionId,
      event_time: new Date().toISOString(),
      event_name: eventName,
      payload
    };

    this.records.push(record);
    return record;
  }

  endSession(payload = {}) {
    const record = this.emit("session_end", payload);
    this.currentSessionId = null;
    return record;
  }

  countByEvent(eventName) {
    return this.records.filter((record) => record.event_name === eventName).length;
  }
}
