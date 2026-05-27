import { memo, useEffect, useRef } from 'react';

function MiniSparklineInner({ prices, trend }: { prices: readonly number[]; trend: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prices.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    const color = trend === 'up' ? '#3fb950' : trend === 'down' ? '#f85149' : '#8b949e';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    prices.forEach((p, i) => {
      const x = (i / (prices.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((p - min) / span) * (h - 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [prices, trend]);

  if (prices.length < 2) return null;
  return <canvas ref={canvasRef} className="sparkline" width={56} height={14} aria-hidden />;
}

export const MiniSparkline = memo(MiniSparklineInner);
