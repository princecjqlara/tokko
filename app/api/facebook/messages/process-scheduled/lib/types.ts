export type ScheduledMessageRecord = {
  id: number;
  user_id: string;
  contact_ids: any;
  message: string;
  attachment?: any;
  scheduled_for: string;
};

export type ContactRecord = {
  id: number;
  contact_id: string;
  page_id: string;
  contact_name: string;
  page_name: string;
  last_send_status?: string | null;
  last_send_job_id?: number | null;
  last_send_at?: string | null;
};

export type ProcessResult = {
  processed: number;
  success: number;
  failed: number;
  errors: any[];
};
