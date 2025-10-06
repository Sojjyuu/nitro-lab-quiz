const API_BASE = "/api";

type SignInRequest = {
  email: string;
  password: string;
};

type SignInResponse = {
  data: {
    _id: string;
    firstname: string;
    lastname: string;
    email: string;
    image: string;
    role: string;
    type: string;
    confirmed: boolean;
    education: {
      major: string;
      enrollmentYear: string;
      studentId: string;
      schoolId: string;
    };
    job: unknown[];
    createdAt: string;
    updatedAt: string;
    token: string;
  };
};

type Classmate = {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  image: string;
  role: string;
  type: string;
  confirmed: boolean;
  education: {
    major: string;
    enrollmentYear: string;
    studentId: string;
    schoolId: string;
    school?: {
      _id: string;
      name: string;
      province: string;
      logo: string;
    };
    advisorId?: string;
    advisor?: {
      _id: string;
      name: string;
      email: string;
      image: string;
    };
  };
  job: unknown[];
  createdAt: string;
  updatedAt: string;
};

type ClassmatesResponse = {
  data: Classmate[];
};

type StatusAuthor = {
  _id: string;
  name?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  image?: string;
};

type Comment = {
  _id: string;
  content: string;
  createdBy: string | StatusAuthor;
  like: (string | StatusAuthor)[];
  createdAt: string;
};

type Status = {
  _id: string;
  content: string;
  createdBy: string | StatusAuthor;
  like: (string | StatusAuthor)[];
  likeCount: number;
  hasLiked: boolean;
  comment: Comment[];
  createdAt: string;
  updatedAt: string;
};

type StatusListResponse = {
  data: Status[];
};

type StatusSingleResponse = {
  data: Status;
};

type CreateStatusPayload = {
  content: string;
};

type CreateCommentPayload = {
  content: string;
  statusId: string;
};

type LikeRequestPayload = {
  statusId: string;
  action?: "like" | "unlike";
};

type Profile = {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  image?: string;
  role?: string;
  type?: string;
  confirmed?: boolean;
  education?: {
    major?: string;
    enrollmentYear?: string;
    studentId?: string;
    schoolId?: string;
    school?: {
      _id?: string;
      name?: string;
      province?: string;
      logo?: string;
    };
    advisorId?: string;
    advisor?: {
      _id?: string;
      name?: string;
      email?: string;
      image?: string;
    };
    image?: string;
  };
  job?: unknown[];
  createdAt?: string;
  updatedAt?: string;
};

type ProfileResponse = {
  data: Profile;
};

async function handleJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = (errorBody as { error?: string; message?: string })?.error ||
      (errorBody as { error?: string; message?: string })?.message ||
      fallback;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function signIn(credentials: SignInRequest): Promise<SignInResponse["data"]> {
  const response = await fetch(`${API_BASE}/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  const json = await handleJson<SignInResponse>(response, "Sign in failed. Check email/password.");
  return json.data;
}

export async function fetchProfile(token: string): Promise<Profile> {
  const response = await fetch(`${API_BASE}/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await handleJson<ProfileResponse>(response, "Unable to load profile.");
  return json.data;
}

export async function fetchClassmates(year: string | number, token: string): Promise<Classmate[]> {
  const response = await fetch(`${API_BASE}/classmates?year=${encodeURIComponent(year)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await handleJson<ClassmatesResponse>(response, "Unable to load classmates.");
  return json.data;
}

export async function fetchStatuses(token: string): Promise<Status[]> {
  const response = await fetch(`${API_BASE}/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await handleJson<StatusListResponse>(response, "Unable to load statuses.");
  return json.data;
}

export async function createStatus(payload: CreateStatusPayload, token: string): Promise<Status> {
  const response = await fetch(`${API_BASE}/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await handleJson<StatusSingleResponse>(response, "Unable to create status.");
  return json.data;
}

export async function createComment(payload: CreateCommentPayload, token: string): Promise<Status> {
  const response = await fetch(`${API_BASE}/comment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await handleJson<StatusSingleResponse>(response, "Unable to add comment.");
  return json.data;
}

export async function likeStatus(statusId: string, token: string): Promise<Status> {
  const response = await fetch(`${API_BASE}/like`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ statusId } satisfies LikeRequestPayload),
  });

  const json = await handleJson<StatusSingleResponse>(response, "Unable to like status.");
  return json.data;
}

export async function unlikeStatus(statusId: string, token: string): Promise<Status> {
  const response = await fetch(`${API_BASE}/like`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ statusId, action: "unlike" } satisfies LikeRequestPayload),
  });

  const json = await handleJson<StatusSingleResponse>(response, "Unable to unlike status.");
  return json.data;
}

export type { Classmate, Status, Comment, Profile };
