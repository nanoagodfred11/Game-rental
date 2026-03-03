import mongoose, { type Document, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

export interface IAuditLog extends Document {
  action: string;
  actor_id: string;
  actor_email: string;
  actor_role: string;

  target_type: string;
  target_id: string;

  details: Record<string, unknown>;
  previous_state: Record<string, unknown>;
  new_state: Record<string, unknown>;

  ip_address: string;
  user_agent: string;

  created_at: Date;
}

export interface IAuditLogModel extends Model<IAuditLog> {
  logAction(params: {
    action: string;
    actor_id: string;
    actor_email: string;
    actor_role: string;
    target_type?: string;
    target_id?: string;
    details?: Record<string, unknown>;
    previous_state?: Record<string, unknown>;
    new_state?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
  }): Promise<IAuditLog>;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      required: true,
    },
    actor_id: {
      type: String,
      required: true,
      index: true,
    },
    actor_email: {
      type: String,
      required: true,
    },
    actor_role: {
      type: String,
      required: true,
    },

    // Target
    target_type: {
      type: String,
      index: true,
    },
    target_id: {
      type: String,
    },

    // Details
    details: {
      type: Schema.Types.Mixed,
    },
    previous_state: {
      type: Schema.Types.Mixed,
    },
    new_state: {
      type: Schema.Types.Mixed,
    },

    // Meta
    ip_address: {
      type: String,
    },
    user_agent: {
      type: String,
    },

    // Timestamps
    created_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: "audit_logs",
  }
);

auditLogSchema.statics.logAction = async function (params: {
  action: string;
  actor_id: string;
  actor_email: string;
  actor_role: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
  previous_state?: Record<string, unknown>;
  new_state?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}): Promise<IAuditLog> {
  const entry = new this(params);
  return entry.save();
};

export const AuditLog =
  (models.AuditLog as IAuditLogModel) ||
  model<IAuditLog, IAuditLogModel>("AuditLog", auditLogSchema);
