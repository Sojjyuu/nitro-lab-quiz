import type { Comment as ApiComment, Status as ApiStatus } from "./lib/api/api";

type LegacyCommentFields = {
  id?: string;
  owner?: string;
  body?: string;
  created_at?: string;
};

type LegacyStatusFields = {
  id?: string;
  owner?: string;
  body?: string;
  created_at?: string;
  like_count?: number;
  comments?: Comment[];
  is_liked?: boolean;
};

export type Comment = ApiComment & LegacyCommentFields;
export type StatusItem = ApiStatus & LegacyStatusFields;
export type { ApiStatus as Status };
