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
};

export type ProcessResult = {
  processed: number;
  success: number;
  failed: number;
  errors: any[];
};
