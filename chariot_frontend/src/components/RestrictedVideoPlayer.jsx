import { useEffect, useRef, useState } from "react";
import "./RestrictedVideoPlayer.css";

/**
 * Lecteur vidéo restreint : aucun contrôle natif du navigateur (donc aucun
 * bouton "Télécharger" ni menu "..." de Chrome/Edge), pas de clic droit,
 * pas de glisser-déposer, pas de Picture-in-Picture. Seules actions
 * possibles : lecture/pause, volume, progression, plein écran (zoom).
 *
 * Affiche un bandeau défilant en bas de la vidéo avec le nom de
 * l'application, le nom du client et son numéro.
 */
export default function RestrictedVideoPlayer({
  src,
  appName = "EDS",
  clientName = "",
  clientNumber = "",
}) {
  const videoRef = useRef(null);
  const wrapperRef = useRef(null);
  const [enLecture, setEnLecture] = useState(false);
  const [dureeTotale, setDureeTotale] = useState(0);
  const [tempsActuel, setTempsActuel] = useState(0);
  const [volume, setVolume] = useState(1);
  const [pleinEcran, setPleinEcran] = useState(false);

  const basculerLecture = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setEnLecture(true);
    } else {
      video.pause();
      setEnLecture(false);
    }
  };

  const surChangementProgression = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const nouveauTemps = Number(e.target.value);
    video.currentTime = nouveauTemps;
    setTempsActuel(nouveauTemps);
  };

  const surChangementVolume = (e) => {
    const video = videoRef.current;
    const nouveauVolume = Number(e.target.value);
    setVolume(nouveauVolume);
    if (video) video.volume = nouveauVolume;
  };

  const basculerPleinEcran = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setPleinEcran(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const formaterTemps = (secondes) => {
    if (!Number.isFinite(secondes)) return "0:00";
    const m = Math.floor(secondes / 60);
    const s = Math.floor(secondes % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  const texteDefilant = [appName, clientName, clientNumber].filter(Boolean).join("  •  ");

  return (
    <div
      ref={wrapperRef}
      className="restricted-video-wrapper"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        src={src}
        className="restricted-video-element"
        disablePictureInPicture
        controlsList="nodownload noremoteplayback nofullscreen"
        onClick={basculerLecture}
        onPlay={() => setEnLecture(true)}
        onPause={() => setEnLecture(false)}
        onLoadedMetadata={(e) => setDureeTotale(e.target.duration)}
        onTimeUpdate={(e) => setTempsActuel(e.target.currentTime)}
        onContextMenu={(e) => e.preventDefault()}
      />

      {texteDefilant && (
        <div className="restricted-video-marquee">
          <span>{texteDefilant}&nbsp;&nbsp;&nbsp;&nbsp;{texteDefilant}</span>
        </div>
      )}

      <div className="restricted-video-controls">
        <button type="button" onClick={basculerLecture} className="restricted-video-btn" aria-label={enLecture ? "Pause" : "Lecture"}>
          {enLecture ? "❚❚" : "►"}
        </button>

        <span className="restricted-video-time">{formaterTemps(tempsActuel)}</span>

        <input
          type="range"
          min={0}
          max={dureeTotale || 0}
          value={tempsActuel}
          onChange={surChangementProgression}
          className="restricted-video-progress"
        />

        <span className="restricted-video-time">{formaterTemps(dureeTotale)}</span>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={surChangementVolume}
          className="restricted-video-volume"
          aria-label="Volume"
        />

        <button type="button" onClick={basculerPleinEcran} className="restricted-video-btn" aria-label="Plein écran / zoom">
          {pleinEcran ? "⤡" : "⤢"}
        </button>
      </div>
    </div>
  );
}