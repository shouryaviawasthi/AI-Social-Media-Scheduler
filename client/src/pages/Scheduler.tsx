import React, { useEffect, useState } from "react";
import { PLATFORMS } from "../assets/assets";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ClockIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import {
  type SocialPost,
} from "../lib/storage";
import { apiFetch } from "../lib/api";

const fileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read the selected image."));
    };
    reader.readAsDataURL(file);
  });

const Scheduler = () => {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [content, setContent] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [postErrors, setPostErrors] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set());
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const fetchPosts = async (): Promise<void> => {
    try {
      setPosts(await apiFetch<SocialPost[]>("/api/posts"));
    } catch {
      setPosts([]);
    }
  };

  const fetchConnectedAccounts = async (): Promise<void> => {
    try {
      const accounts = await apiFetch<{ platform: string }[]>("/api/social/accounts");
      setConnectedPlatforms(new Set(accounts.map((acc) => acc.platform)));
    } catch {
      setConnectedPlatforms(new Set());
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void fetchPosts();
      void fetchConnectedAccounts();
    }, 0);
    const interval = setInterval(() => {
      setNow(Date.now());
      void fetchPosts();
    }, 1000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, []);

  const scheduled: SocialPost[] = posts.filter(
    (post: SocialPost) => post.status === "scheduled",
  );
  const published: SocialPost[] = posts.filter(
    (post: SocialPost) => post.status === "published",
  );

  const formatCountdown = (scheduledFor?: string) => {
    if (!scheduledFor) return "No date";
    const remaining = new Date(scheduledFor).getTime() - now;
    if (remaining <= 0) return "Overdue";
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds}s`;
  };

  const publishNow = async (postId: string) => {
    setPublishingPostId(postId);
    setPostErrors((previous) => ({ ...previous, [postId]: "" }));
    try {
      await apiFetch(`/api/posts/${postId}/publish`, {
        method: "POST",
      });
      await fetchPosts();
    } catch (publishError) {
      setPostErrors((previous) => ({
        ...previous,
        [postId]: publishError instanceof Error ? publishError.message : "Unable to publish post.",
      }));
    } finally {
      setPublishingPostId(null);
    }
  };

  const removeScheduledPost = async (postId: string) => {
    if (!window.confirm("Remove this scheduled post?")) return;
    try {
      await apiFetch<void>(`/api/posts/${postId}`, { method: "DELETE" });
      setPosts((previous) => previous.filter((post) => post._id !== postId));
    } catch (removeError) {
      setPostErrors((previous) => ({
        ...previous,
        [postId]: removeError instanceof Error ? removeError.message : "Unable to remove post.",
      }));
    }
  };

  const togglePlateform = (id: string) => {
    if (!connectedPlatforms.has(id)) {
      setError(`Please connect your ${id.charAt(0).toUpperCase() + id.slice(1)} account first in the Accounts page.`);
      return;
    }
    setError("");
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || !scheduledDate || !scheduledTime || selectedPlatforms.length === 0) {
      setError("Enter content, choose a platform, and select a date and time.");
      return;
    }
    if (selectedPlatforms.includes("instagram") && !mediaFile?.type.startsWith("image/")) {
      setError("Instagram requires an image. Attach an image or remove Instagram from the selected platforms.");
      return;
    }
    if (mediaFile && mediaFile.size > 7 * 1024 * 1024) {
      setError("Images must be smaller than 7 MB.");
      return;
    }

    setError("");
    setLoading(true);
    let saved = false;
    try {
      const createdPost = await apiFetch<SocialPost>("/api/posts", {
        method: "POST",
        body: JSON.stringify({
        content: content.trim(),
        platforms: selectedPlatforms,
        scheduledFor: new Date(`${scheduledDate}T${scheduledTime}`).toISOString(),
        status: "scheduled",
        mediaType: mediaFile?.type,
        mediaUrl: mediaFile ? await fileAsDataUrl(mediaFile) : undefined,
        }),
      });
      await apiFetch("/api/activities", {
        method: "POST",
        body: JSON.stringify({
          actionType: "POST_SCHEDULED",
          description: `Scheduled post for ${selectedPlatforms.join(", ")}`,
          relatedPost: { _id: createdPost._id, content: createdPost.content },
        }),
      });
      setPosts((prev: SocialPost[]) => [createdPost, ...prev]);
      saved = true;
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Unable to schedule post.");
    } finally {
      setLoading(false);
      if (saved) {
        setContent("");
        setScheduledDate("");
        setScheduledTime("");
        setSelectedPlatforms([]);
        setMediaFile(null);
      }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* compose panel ----- left panel */}
      <div className="w-full lg:w-115 shrink-0">
        <div className=" bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-lg text-slate-700">Compose Post</h2>
          </div>
          <form className="space-y-5" onSubmit={handleSchedule}>
            {/* plateform */}
            <div>
              <label className=" block text-xs text-slate-500 uppercase mb-2">
                Plateforms
              </label>
              {loadingAccounts ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="size-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                  Loading connected accounts...
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3 ">
                    {PLATFORMS.filter((platform) => platform.id !== "twitter").map((p) => {
                      const active = selectedPlatforms.includes(p.id);
                      const isConnected = connectedPlatforms.has(p.id);
                      return (
                        <button
                          onClick={() => togglePlateform(p.id)}
                          key={p.id}
                          type="button"
                          disabled={!isConnected}
                          className={`flex items-center gap-1.5 p-3 rounded-md border transition-all duration-150 ${
                            active
                              ? "bg-red-50 border-red-300 text-red-500 scale-100"
                              : isConnected
                              ? "border-slate-200 text-slate-500 hover:border-slate-300"
                              : "border-slate-200 text-slate-300 cursor-not-allowed opacity-50"
                          }`}
                          title={isConnected ? `Select ${p.name}` : `Connect ${p.name} first in Accounts page`}
                        >
                          <p.icon className="size-4.5" />
                        </button>
                      );
                    })}
                  </div>
                  {connectedPlatforms.size === 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ No accounts connected. Please visit the Accounts page to connect Facebook, Instagram, or LinkedIn.
                    </p>
                  )}
                </>
              )}
            </div>
            {/* content */}
            <div>
              <label className="block text-xs text-slate-500 uppercase mb-2">
                Content
              </label>
              <textarea
                required
                rows={5}
                placeholder="what do you want to share today"
                className=" w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 outline-none resize-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div
                className={`text-right text-xs mt-1 font-medium ${content.length > 270 ? " text-red-500  " : "text-slate-400"}`}
              >
                {content.length}/280
              </div>
            </div>

            {/* media upload */}

            <div>
              <label>Media(optional)</label>
              {mediaFile ? (
                <div className="relative rounded-xl border-slate-200 bg-slate-50 border overflow-hidden ">
                  {mediaFile.type.startsWith("image/") ? (
                    <img
                      src={URL.createObjectURL(mediaFile)}
                      alt="preview"
                      className=" w-full h-40 object-cover"
                    />
                  ) : (
                    <video
                      src={URL.createObjectURL(mediaFile)}
                      className="w-full h-40 object-cover"
                      controls
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setMediaFile(null)}
                    className=" absolute top-2 right-2 flex items-center justify-center transition-colors "
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-5 py-10 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition-all group ">
                  <span className=" text-sm text-slate-500 group-hover:text-red-600 transition-colors ">
                    click to add image or video
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && setMediaFile(e.target.files[0])
                    }
                  />
                </label>
              )}
            </div>
            {/* date and time */}

            <div className=" grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className=" block text-xs text-slate-500 uppercase mb-2">
                  Date
                </label>
                <div className="relate">
                  <CalendarIcon
                    className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400
                     pointer-events-none "
                  />
                  <input
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    type="date"
                    required
                  />
                </div>
              </div>

              {/* for time */}
              <div>
                <label className=" block text-xs text-slate-500 uppercase mb-2">
                  Date
                </label>
                <div className="relate">
                  <ClockIcon
                    className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400
                     pointer-events-none "
                  />
                  <input
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    type="time"
                    required
                  />
                </div>
              </div>
            </div>

            {/* submit */}

            <button
              type="submit"
              disabled={loading}
              className=" w-full flex items-center justify-center gap-2 py-3.5 bg-red-500 hover:bg-red-600 transition-all text-white rounded-lg"
            >
              {loading ? (
                <>
                  <div className=" size-4 border-2 border-white border-white border-t-transparent rounded-full animate-spin" />
                  scheduling...
                </>
              ) : (
                <>
                  schedule Post <ArrowRightIcon className="size-4" />
                </>
              )}
            </button>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </form>
        </div>
      </div>

      {/* Queue panel ----- right panel */}

      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {/* Upcoming */}
        <div className=" bg-white rounded-2xl border  border-slate-200 overflow-hidden">
          <div className=" flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
            <CalendarDaysIcon className=" size-4 text-zinc-500" />
            <h3 className="text-slate-900 text-sm">Upcoming</h3>
            <span className="m1-auto text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full">
              {scheduled.length}
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {scheduled.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                {" "}
                No Post Scheduled yet
              </div>
            ) : (
              scheduled.map((post: SocialPost) => {
                return (
                  <div
                    key={post._id}
                    className="px-5 py-4 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-1.5 items-center">
                        {post.platforms.map((pl: string) => {
                          const meta = PLATFORMS.find((p) => p.id === pl);
                          return meta ? (
                            <meta.icon
                              key={pl}
                              className=" size-3.5 text-slate-400"
                            />
                          ) : null;
                        })}
                      </div>

                      <div className=" flex items-center gap-2">
                        {post.mediaType && (
                          <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-md font-semibold capitalize">
                            {post.mediaType}
                          </span>
                        )}

                        <span className="text-xs text-slate-400">
                          {post.scheduledFor
                            ? new Date(post.scheduledFor).toLocaleString()
                            : "No date"}
                        </span>
                        <span className="text-xs font-medium text-red-500">
                          {formatCountdown(post.scheduledFor)}
                        </span>
                        <button
                          type="button"
                          onClick={() => publishNow(post._id)}
                          disabled={publishingPostId === post._id}
                          className="text-xs font-medium text-slate-500 hover:text-red-600 disabled:opacity-50"
                        >
                          {publishingPostId === post._id ? "Publishing..." : "Publish now"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeScheduledPost(post._id)}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Remove scheduled post"
                          title="Remove scheduled post"
                        >
                          <Trash2Icon className="size-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 max-w-md">
                      {post.content}
                    </p>
                    {post.platforms.includes("instagram") && !post.mediaUrl && (
                      <p className="mt-2 text-xs text-amber-700">
                        Instagram requires an image. Remove this post and schedule it again with an image attached.
                      </p>
                    )}
                    {postErrors[post._id] && (
                      <p className="mt-2 text-xs text-red-600" role="alert">{postErrors[post._id]}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* published post */}

        <div className=" bg-white rounded-2xl border  border-slate-200 overflow-hidden">
          <div className=" flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
            <SendIcon className=" size-4 text-zinc-500" />
            <h3 className="text-slate-900 text-sm">Published</h3>
            <span className="m1-auto text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full">
              {published.length}
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {published.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                {" "}
                No Post published yet
              </div>
            ) : (
              published.map((post: SocialPost) => {
                return (
                  <div
                    key={post._id}
                    className="px-5 py-4 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-1.5 items-center">
                        {post.platforms.map((pl: string) => {
                          const meta = PLATFORMS.find((p) => p.id === pl);
                          return meta ? (
                            <meta.icon
                              key={pl}
                              className=" size-3.5 text-slate-400"
                            />
                          ) : null;
                        })}
                      </div>

                      <div className=" flex items-center gap-2">
                        {post.mediaType && (
                          <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-md font-semibold capitalize">
                            {post.mediaType}
                          </span>
                        )}

                        <span className="text-xs text-slate-400">
                          {post.updatedAt
                            ? new Date(post.updatedAt).toLocaleString()
                            : "No date"}
                        </span>
                        <span className=" text-sm bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">Published</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 max-w-4/5">
                      {post.content}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>


      </div>
    </div>
  );
};

export default Scheduler;
