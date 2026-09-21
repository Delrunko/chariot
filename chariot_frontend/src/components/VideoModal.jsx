import React from "react";
import { useNavigate } from "react-router-dom";
import "./ReaderModal.css"; // reuse some styles for backdrop/modal

export default function VideoModal({ open = true, videoUrl = null, title = "Vidéo", onClose }) {
  const navigate = useNavigate();

  if (!open) return null;

  const fermer = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (onClose) onClose();
    else navigate(-1);
  };

  return (
    <div className="reader-modal-backdrop" onClick={fermer}>
      <div className="reader-modal reader-modal-noselect" onClick={(e) => e.stopPropagation()}>
        <div className="reader-modal-header">
          <h3>{title}</h3>
          <button type="button" className="reader-close" onClick={fermer}>
            Fermer
          </button>
        </div>

        <div style={{padding:12}}>
          {videoUrl ? (
            /\* If it's an iframe-capable URL, display in iframe; otherwise use <video> *\/
            (/(youtube|vimeo|youtu\.be|watch\?v=)/i.test(videoUrl) ? (
              <div style={{position:'relative', paddingBottom:'56.25%', height:0}}>
                <iframe title={title} src={videoUrl} style={{position:'absolute', top:0, left:0, width:'100%', height:'100%'}} frameBorder="0" allowFullScreen />
              </div>
            ) : (
              <video controls src={videoUrl} style={{width:'100%'}} />
            )) : (
            <div style={{padding:20, textAlign:'center'}}>
              <p style={{margin:0}}>Vidéo introuvable ou inaccessible.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
