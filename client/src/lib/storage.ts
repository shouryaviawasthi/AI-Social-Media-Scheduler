export type User = {
  id: string;
  name: string;
  email: string;
  password?: string;
  createdAt?: string;
};

export type SocialAccount = {
  _id: string;
  userId: string;
  platform: string;
  handle: string;
  status: "connected" | "disconnected";
  createdAt: string;
  updatedAt: string;
};

export type SocialPost = {
  _id: string;
  userId: string;
  content: string;
  platforms: string[];
  scheduledFor?: string;
  status: "scheduled" | "published";
  publishedPlatforms?: string[];
  mediaType?: string;
  mediaUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivityItem = {
  _id: string;
  userId: string;
  actionType: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  relatedPost?: {
    _id: string;
    content: string;
  } | null;
};

export type UserState = {
  accounts: SocialAccount[];
  posts: SocialPost[];
  activities: ActivityItem[];
};

const USERS_KEY = "scheduler_users";
const CURRENT_USER_KEY = "scheduler_current_user";
const DATA_KEY_PREFIX = "scheduler_data_";

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = <T,>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const getAllUsers = (): User[] => readJson<User[]>(USERS_KEY, []);

export const getCurrentUser = (): User | null => {
  const user = readJson<User | null>(CURRENT_USER_KEY, null);
  return user;
};

export const setCurrentUser = (user: User | null) => {
  if (!user) {
    localStorage.removeItem(CURRENT_USER_KEY);
    return;
  }

  writeJson(CURRENT_USER_KEY, user);
};

export const getUserState = (userId: string): UserState => {
  const key = `${DATA_KEY_PREFIX}${userId}`;
  return readJson<UserState>(key, { accounts: [], posts: [], activities: [] });
};

export const saveUserState = (userId: string, state: UserState) => {
  writeJson(`${DATA_KEY_PREFIX}${userId}`, state);
};

export const createUser = (name: string, email: string, password: string): User | null => {
  const normalizedEmail = email.trim().toLowerCase();
  const users = getAllUsers();

  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    return null;
  }

  const user: User = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    password,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeJson(USERS_KEY, users);
  setCurrentUser(user);
  saveUserState(user.id, { accounts: [], posts: [], activities: [] });
  return user;
};

export const loginUser = (email: string, password: string): User | null => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = getAllUsers().find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.password === password,
  );

  if (!user) {
    return null;
  }

  setCurrentUser(user);
  return user;
};

export const logoutUser = () => {
  setCurrentUser(null);
};

export const addAccountForUser = (platform: string) => {
  const user = getCurrentUser();
  if (!user) return null;

  const state = getUserState(user.id);
  const account: SocialAccount = {
    _id: crypto.randomUUID(),
    userId: user.id,
    platform,
    handle: `${user.name.replace(/\s+/g, "").toLowerCase()}-${platform}`,
    status: "connected",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const nextState = {
    ...state,
    accounts: [...state.accounts, account],
  };

  saveUserState(user.id, nextState);
  return account;
};

export const removeAccountForUser = (accountId: string) => {
  const user = getCurrentUser();
  if (!user) return;

  const state = getUserState(user.id);
  const nextState = {
    ...state,
    accounts: state.accounts.filter((account) => account._id !== accountId),
  };

  saveUserState(user.id, nextState);
};

export const addPostForUser = (post: Omit<SocialPost, "_id" | "userId" | "createdAt" | "updatedAt">) => {
  const user = getCurrentUser();
  if (!user) return null;

  const state = getUserState(user.id);
  const createdAt = new Date().toISOString();
  const nextPost: SocialPost = {
    _id: crypto.randomUUID(),
    userId: user.id,
    ...post,
    createdAt,
    updatedAt: createdAt,
  };

  const nextState = {
    ...state,
    posts: [nextPost, ...state.posts],
  };

  saveUserState(user.id, nextState);
  return nextPost;
};

export const addActivityForUser = (activity: Omit<ActivityItem, "_id" | "userId" | "createdAt" | "updatedAt">) => {
  const user = getCurrentUser();
  if (!user) return null;

  const state = getUserState(user.id);
  const now = new Date().toISOString();
  const item: ActivityItem = {
    _id: crypto.randomUUID(),
    userId: user.id,
    createdAt: now,
    updatedAt: now,
    ...activity,
  };

  const nextState = {
    ...state,
    activities: [item, ...state.activities],
  };

  saveUserState(user.id, nextState);
  return item;
};

export const getUserSummary = (userId: string): UserState => getUserState(userId);

export const publishDuePostsForUser = () => {
  const user = getCurrentUser();
  if (!user) return [] as SocialPost[];

  const state = getUserState(user.id);
  const now = Date.now();
  let changed = false;
  const publishedPostIds: string[] = [];

  const updatedPosts = state.posts.map((post) => {
    if (
      post.status === "scheduled" &&
      post.scheduledFor &&
      new Date(post.scheduledFor).getTime() <= now
    ) {
      changed = true;
      publishedPostIds.push(post._id);
      return {
        ...post,
        status: "published" as const,
        updatedAt: new Date().toISOString(),
      };
    }

    return post;
  });

  if (!changed) {
    return updatedPosts;
  }

  const nextState: UserState = {
    ...state,
    posts: updatedPosts,
  };

  saveUserState(user.id, nextState);

  updatedPosts
    .filter((post) => publishedPostIds.includes(post._id))
    .forEach((post) => {
      addActivityForUser({
        actionType: "POST_PUBLISHED",
        description: `Published post to ${post.platforms.join(", ")}`,
      });
    });

  return updatedPosts;
};

export const publishPostNowForUser = (postId: string) => {
  const user = getCurrentUser();
  if (!user) return null;

  const state = getUserState(user.id);
  const post = state.posts.find((item) => item._id === postId);
  if (!post || post.status === "published") return post ?? null;

  const publishedPost: SocialPost = {
    ...post,
    status: "published",
    updatedAt: new Date().toISOString(),
  };

  saveUserState(user.id, {
    ...state,
    posts: state.posts.map((item) => (item._id === postId ? publishedPost : item)),
  });

  addActivityForUser({
    actionType: "POST_PUBLISHED",
    description: `Published post to ${post.platforms.join(", ")}`,
  });

  return publishedPost;
};
