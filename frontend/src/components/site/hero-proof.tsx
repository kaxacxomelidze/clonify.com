import { useSiteLanguage } from "@/hooks/use-site-language";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const PORTRAITS = [
  { src: "/portraits/creator-01.jpg", position: "50% 50%", origin: "50% 0%", scale: 1.65 },
  { src: "/portraits/creator-02.jpg", position: "50% 55%", origin: "50% 50%", scale: 1.75 },
  { src: "/portraits/creator-03.jpg", position: "55% 52%", origin: "50% 50%", scale: 1.45 },
];

export function HeroProof() {
  const { t: tr } = useSiteLanguage();
  return (
    <div className="hero-proof" data-hero-reveal>
      <div className="proof-stack">
        {PORTRAITS.map((portrait, index) => (
          <Dialog key={portrait.src}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="proof-avatar"
                aria-label={`${tr("View portrait")} ${index + 1}`}
              >
                <img
                  src={portrait.src}
                  alt=""
                  width={44}
                  height={44}
                  decoding="async"
                  style={{
                    objectPosition: portrait.position,
                    transformOrigin: portrait.origin,
                    transform: `scale(${portrait.scale})`,
                  }}
                />
              </button>
            </DialogTrigger>
            <DialogContent
              className="proof-portrait-dialog"
              closeLabel={tr("Close portrait")}
              aria-describedby={undefined}
              data-lenis-prevent
            >
              <DialogTitle className="sr-only">
                {tr("Portrait")} {index + 1}
              </DialogTitle>
              <img
                src={portrait.src}
                alt={`${tr("Portrait")} ${index + 1}`}
                className="proof-portrait-image"
              />
            </DialogContent>
          </Dialog>
        ))}
      </div>
      <p>
        <strong>{tr("Trusted by ambitious creators.")}</strong>
        <br />
        <span>{tr("Built for what comes next.")}</span>
      </p>
    </div>
  );
}
