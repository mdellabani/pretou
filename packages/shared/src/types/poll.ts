export type PollType = "vote" | "participation";

export type Poll = {
  id: string;
  post_id: string;
  question: string;
  poll_type: PollType;
  allow_multiple: boolean;
  created_at: string;
  poll_options: PollOption[];
};

export type PollOption = {
  id: string;
  poll_id: string;
  label: string;
  position: number;
  poll_votes?: { user_id: string }[];
};

export type CreatePollInput = {
  question: string;
  poll_type: PollType;
  allow_multiple: boolean;
  options: string[];
};
