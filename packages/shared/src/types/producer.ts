export type ProducerStatus = "pending" | "active" | "rejected";

export type Producer = {
  id: string;
  commune_id: string;
  created_by: string;
  name: string;
  description: string;
  categories: string[];
  photo_path: string | null;
  pickup_location: string | null;
  delivers: boolean;
  contact_phone: string | null;
  contact_email: string | null;
  schedule: string | null;
  status: ProducerStatus;
  created_at: string;
  updated_at: string;
  communes?: { name: string };
  profiles?: { display_name: string };
};

export type CreateProducerInput = {
  name: string;
  description: string;
  categories: string[];
  pickup_location?: string | null;
  delivers?: boolean;
  contact_phone?: string | null;
  contact_email?: string | null;
  schedule?: string | null;
};
