export type SendJobRecord = {
  id: number;
  user_id: string;
  contact_ids: any;
  message: string;
  attachment?: any;
  message_tag?: string;
  status: string;
  sent_count: number;
  failed_count: number;
  total_count: number;
  errors: any[];
  updated_at?: string;
  started_at?: string;
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

export type PageSendResult = {
  success: number;
  failed: number;
  errors: any[];
  cancelled?: boolean;
};
