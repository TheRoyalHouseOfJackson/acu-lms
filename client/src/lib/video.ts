// Convert a video URL into an embeddable form. Returns { kind, src }.
export function resolveVideo(url: string): { kind: "youtube" | "vimeo" | "file" | "none"; src: string } {
  if (!url) return { kind: "none", src: "" };
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "youtube", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vim = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vim) return { kind: "vimeo", src: `https://player.vimeo.com/video/${vim[1]}` };
  return { kind: "file", src: url };
}
