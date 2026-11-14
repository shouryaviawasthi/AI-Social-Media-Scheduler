import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PLATFORMS } from "../assets/assets";
import { apiFetch } from "../lib/api";
import type { SocialPost } from "../lib/storage";

import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  HistoryIcon,
  Loader2Icon,
  TimerIcon,
  Wand2Icon,
  XIcon,
} from "lucide-react";

type Generation = {
  _id: string;
  prompt: string;
  content: string;
  tone: string;
  type: "text" | "image";
  createdAt: string;
};

const AIComposer = () => {
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("Professional");
  const [generateImage, setGenerateImage] = useState(true);
  const [useKnowledge, setUseKnowledge] = useState(false);
  const [loading, setLoading] = useState(false);

  // Image preview modal
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [generations, setGenerations] = useState<Generation[]>([]);
  const [error, setError] = useState("");

  // Scheduling state
  const [activeScheduler, setActiveScheduler] =
    useState<Generation | null>(null);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // =====================================================
  // GENERATE AI CONTENT
  // =====================================================

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setError("Enter an idea before generating a post.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await apiFetch<{ type: "text" | "image"; content: string }>(
        "/api/generate",
        {
          method: "POST",
          body: JSON.stringify({
            prompt: trimmedPrompt,
            tone,
            generateImage,
            useKnowledge,
          }),
        },
      );

      setGenerations((previous) => [
        {
          _id: crypto.randomUUID(),
          prompt: trimmedPrompt,
          content: data.content,
          tone,
          type:
            data.type === "image"
              ? "image"
              : "text",
          createdAt: new Date().toISOString(),
        },
        ...previous,
      ]);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Generation failed."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // SCHEDULE POST
  // =====================================================

  const handleSchedule = async () => {
    if (
      !activeScheduler?.content?.trim() ||
      !scheduledDate ||
      !scheduledTime ||
      selectedPlatforms.length === 0
    ) {
      setError("Choose a platform, date, and time before scheduling.");
      return;
    }
    if (selectedPlatforms.includes("instagram") && activeScheduler.type !== "image") {
      setError("Instagram requires an image. Generate an image or remove Instagram from the selected channels.");
      return;
    }

    setScheduling(true);
    try {
      const createdPost = await apiFetch<SocialPost>("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          content: activeScheduler.type === "image" ? "AI generated image" : activeScheduler.content.trim(),
          platforms: selectedPlatforms,
          scheduledFor: new Date(`${scheduledDate}T${scheduledTime}`).toISOString(),
          status: "scheduled",
          mediaType: activeScheduler.type === "image" ? "image" : undefined,
          mediaUrl: activeScheduler.type === "image" ? activeScheduler.content : undefined,
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

      setActiveScheduler(null);
      setSelectedPlatforms([]);
      setScheduledDate("");
      setScheduledTime("");
      navigate("/scheduler");
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Unable to schedule post.");
    } finally {
      setScheduling(false);
    }
  };

  // =====================================================
  // TONES
  // =====================================================

  const tones = [
    "Professional",
    "Creative",
    "Funny",
    "Minimalist",
    "Excited",
  ];

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">

      {/* =====================================================
          INPUT SECTION
      ===================================================== */}

      <div className="space-y-6 text-center mt-20">

        <h1 className="text-3xl text-slate-700 tracking-tight">
          What should you create today
        </h1>

        <div className="relative group mt-12">

          <textarea
            className="w-full px-6 py-6 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 transition resize-none h-40"
            placeholder="Share your idea.... (e.g. A post about how you should go for coffee with someone ... gently)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="absolute bottom-4 right-2.5 flex items-center gap-3 text-sm">

            {/* KNOWLEDGE BASE TOGGLE */}

            <button
              onClick={() =>
                setUseKnowledge(!useKnowledge)
              }
              className="flex items-center gap-3 bg-blue-50 py-2 px-3 rounded-lg"
              title="Use your Knowledge Base for factual context"
            >
              <span>Knowledge</span>

              <div
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                  useKnowledge
                    ? "bg-blue-500"
                    : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none size-4 transform translate-y-0.5 rounded-full bg-white transition ${
                    useKnowledge
                      ? "translate-x-4.5"
                      : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>

            {/* AI IMAGE TOGGLE */}

            <button
              onClick={() =>
                setGenerateImage(!generateImage)
              }
              className="flex items-center gap-3 bg-red-50 py-2 px-3 rounded-lg"
            >
              <span>AI Image</span>

              <div
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                  generateImage
                    ? "bg-red-500"
                    : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none size-4 transform translate-y-0.5 rounded-full bg-white transition ${
                    generateImage
                      ? "translate-x-4.5"
                      : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>

            {/* GENERATE BUTTON */}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 px-4 py-2 rounded-lg"
            >
              {loading ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  Generate
                  <ArrowRightIcon className="size-4" />
                </>
              )}
            </button>

          </div>
        </div>

        {/* TONES */}

        <div>
          {tones.map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all border ${
                tone === t
                  ? "bg-red-500 border-red-500 text-white"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ERROR */}

        {error && (
          <p className="text-sm text-red-500">
            {error}
          </p>
        )}
      </div>

      {/* =====================================================
          RECENT GENERATIONS
      ===================================================== */}

      <div className="space-y-6 pt-12 border-t border-slate-100">

        <div className="flex items-center justify-between text-slate-600">

          <div className="flex items-center gap-2">
            <HistoryIcon className="size-5" />

            <h2 className="text-xl">
              Recent Generations
            </h2>
          </div>

          <span className="text-sm text-slate-500 bg-slate-50 px-2">
            {generations.length} total
          </span>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          {generations.map((gen) => (

            <div
              key={gen._id}
              className="group bg-white rounded-2xl border border-slate-100 p-5 hover:border-red-200 transition-all relative overflow-hidden"
            >

              <div className="flex flex-col h-full space-y-4">

                {/* DATE + TONE */}

                <div className="flex items-center justify-between">

                  <span className="text-xs text-slate-400 uppercase tracking-widest">
                    {new Date(
                      gen.createdAt
                    ).toLocaleString()}
                  </span>

                  <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-md">
                    {gen.tone}
                  </span>

                </div>

                {/* =================================================
                    IMAGE
                    ================================================= */}

                {gen.type === "image" ? (

                  <div
                    className="rounded-xl overflow-hidden border border-slate-50 bg-slate-50 cursor-pointer"
                    onClick={() =>
                      setSelectedImage(gen.content)
                    }
                    title="Click to view image"
                  >

                    <img
                      src={gen.content}
                      alt="Generated social media post"
                      className="w-full aspect-video object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />

                  </div>

                ) : (

                  /* =================================================
                     TEXT
                     ================================================= */

                  <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed flex-1">
                    {gen.content}
                  </p>
                )}

                {/* SCHEDULE BUTTON */}

                <div className="flex items-center gap-2 pt-2">

                  <button
                    onClick={() => {
                      setError("");
                      setActiveScheduler(gen);
                    }}
                    className="flex-1 bg-slate-100 hover:bg-red-500 hover:text-white text-slate-600 text-xs py-2.5 rounded-lg transition-all"
                  >
                    Schedule Post
                  </button>

                </div>

              </div>

            </div>
          ))}

          {/* EMPTY STATE */}

          {generations.length === 0 && (

            <div className="col-span-full py-20 text-center space-y-2">

              <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300">

                <Wand2Icon className="size-6" />

              </div>

              <p className="text-slate-400 text-sm">
                No content yet. Try generating some
                content using AI.
              </p>

            </div>
          )}

        </div>
      </div>

      {/* =====================================================
          IMAGE PREVIEW MODAL
      ===================================================== */}

      {selectedImage && (

        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() =>
            setSelectedImage(null)
          }
        >

          <div
            className="relative w-full max-w-4xl flex flex-col items-center"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* CLOSE BUTTON */}

            <button
              onClick={() =>
                setSelectedImage(null)
              }
              className="absolute -top-12 right-0 flex items-center justify-center w-10 h-10 rounded-full bg-white text-slate-700 hover:bg-slate-200 transition"
              aria-label="Close image"
            >
              <XIcon className="size-5" />
            </button>

            {/* FULL IMAGE */}

            <img
              src={selectedImage}
              alt="Generated social media post preview"
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl bg-white"
            />

            {/* DOWNLOAD BUTTON */}

            <a
              href={selectedImage}
              download="generated-image.png"
              className="mt-5 px-6 py-3 bg-white text-slate-900 rounded-lg font-medium hover:bg-slate-100 transition flex items-center gap-2"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              ↓ Download Image
            </a>

          </div>

        </div>
      )}

      {/* =====================================================
          SCHEDULER MODAL
      ===================================================== */}

      {activeScheduler && (

        <div className="fixed inset-0 min-h-screen z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">

          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">

            {/* HEADER */}

            <div className="flex items-center justify-between px-8 py-4 border-b border-slate-100 bg-slate-50/30">

              <h3 className="text-slate-900">
                Schedule Generation
              </h3>

              <button
                onClick={() =>
                  setActiveScheduler(null)
                }
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <XIcon className="size-5" />
              </button>

            </div>

            {/* CONTENT */}

            <div className="flex-1 overflow-y-auto p-8 space-y-4">

              {/* PROMPT */}

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">

                <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {activeScheduler.prompt}
                </p>

              </div>

              {/* GENERATED CONTENT */}

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">

                {activeScheduler.type === "image" ? (

                  <img
                    src={activeScheduler.content}
                    className="w-full aspect-square object-cover rounded-xl border border-slate-200 shadow-sm"
                    alt="Generated social media post"
                  />

                ) : (

                  <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                    {activeScheduler.content}
                  </p>

                )}

              </div>

            </div>

            {/* CHANNEL + DATE + TIME */}

            <div className="p-8 bg-slate-50/50 border-t border-slate-50 space-y-8">

              <div className="space-y-6">

                {/* CHANNELS */}

                <div>

                  <label className="block text-xs text-slate-600 uppercase tracking-widest mb-4">
                    Select Channels
                  </label>

                  <div className="flex flex-wrap gap-2">

                    {PLATFORMS.filter((platform) => platform.id !== "twitter").map((p) => {

                      const active =
                        selectedPlatforms.includes(
                          p.id
                        );

                      return (

                        <button
                          key={p.id}
                          onClick={() =>
                            setSelectedPlatforms(
                              (prev) =>
                                prev.includes(p.id)
                                  ? prev.filter(
                                      (x) =>
                                        x !== p.id
                                    )
                                  : [
                                      ...prev,
                                      p.id,
                                    ]
                            )
                          }
                          className={`p-2.5 rounded-md border text-xs ${
                            active
                              ? "bg-red-500/80 text-white"
                              : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                          }`}
                        >
                          <p.icon className="size-4.5" />
                        </button>

                      );
                    })}

                  </div>

                </div>

                {/* DATE */}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div className="relative">

                    <CalendarIcon className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                    <input
                      type="date"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-md text-slate-900 text-sm focus:outline-none transition-all"
                      value={scheduledDate}
                      onChange={(e) =>
                        setScheduledDate(
                          e.target.value
                        )
                      }
                    />

                  </div>

                </div>

                {/* TIME */}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div className="relative">

                    <ClockIcon className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                    <input
                      type="time"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-md text-slate-900 text-sm focus:outline-none transition-all"
                      value={scheduledTime}
                      onChange={(e) =>
                        setScheduledTime(
                          e.target.value
                        )
                      }
                    />

                  </div>

                </div>

              </div>

              {/* SCHEDULE BUTTON */}

              <button
                onClick={handleSchedule}
                disabled={scheduling}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-md bg-slate-200 text-slate-700 hover:bg-red-500 hover:text-white transition disabled:opacity-50"
              >

                {scheduling ? (

                  <Loader2Icon className="size-4 animate-spin" />

                ) : (

                  <TimerIcon className="size-4" />

                )}

                Scheduling post

              </button>
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

            </div>

          </div>

        </div>
      )}

    </div>
  );
};

export default AIComposer;