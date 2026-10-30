// Single source of query keys. Features import from here; never inline key arrays.
export const qk = {
  me: () => ["me"] as const,
  usernameAvailable: (name: string) => ["username-available", name] as const,
  userSearch: (username: string) => ["user-search", username] as const,
  friends: () => ["friends"] as const,
  friendRequests: () => ["friend-requests"] as const,
  feed: () => ["feed"] as const,
  post: (id: string) => ["post", id] as const,
  profile: (username: string) => ["profile", username] as const,
  profilePosts: (userId: string) => ["profile-posts", userId] as const,
  comments: (postId: string) => ["comments", postId] as const,
  likers: (postId: string) => ["likers", postId] as const,
  signedUrls: (paths: readonly string[]) => ["signed-urls", ...paths] as const,
};
