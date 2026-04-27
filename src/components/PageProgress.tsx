import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function PageProgress() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    setVisible(true);
    setProgress(18);

    const mid = window.setTimeout(() => setProgress(72), 80);
    const done = window.setTimeout(() => setProgress(100), 260);
    const hide = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 520);

    return () => {
      window.clearTimeout(mid);
      window.clearTimeout(done);
      window.clearTimeout(hide);
    };
  }, [location.pathname, location.search]);

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[70] h-0.5 bg-transparent">
      <div
        className="h-full bg-blue-500 transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}