export const drawingBackdrop = () => {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const style = canvas.style;
  style.width = "100%";
  style.height = "100%";
  style.position = "fixed";
  style.zIndex = "-1";
  style.top = "0";
  style.left = "0";
  style.pointerEvents = "none";
  const ctx = canvas.getContext("2d");
  if (!ctx) return void 0;

  let x: number, y: number, width: number, height: number, degree: number;

  const initCanvas = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    const offset = 145;
    x = width / 2;
    y = height - offset;
    degree = Math.max(width, height, 1000) / 11;
    drawCircles();
  };

  window.addEventListener("resize", initCanvas);

  const drawCircle = (radius: number, index: number) => {
    ctx.beginPath();
    const maxDim = Math.max(width, height);
    const progress = radius / maxDim;
    const alpha = Math.max(0, (1 - progress) * 0.2);

    // Glowing cyan / blue radar stroke
    ctx.strokeStyle = `rgba(22, 93, 255, ${alpha})`;
    ctx.lineWidth = index === 0 ? 2 : 1.5;
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
  };

  let step = 0;
  const drawCircles = () => {
    ctx.clearRect(0, 0, width, height);

    // Radial gradient glow around antenna center
    const radialGlow = ctx.createRadialGradient(x, y, 10, x, y, degree * 2.5);
    radialGlow.addColorStop(0, "rgba(22, 93, 255, 0.12)");
    radialGlow.addColorStop(0.5, "rgba(114, 46, 209, 0.04)");
    radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = radialGlow;
    ctx.beginPath();
    ctx.arc(x, y, degree * 2.5, 0, 2 * Math.PI);
    ctx.fill();

    for (let i = 0; i < 9; i++) {
      const radius = degree * i + (step % degree);
      drawCircle(radius, i);
    }
    step = (step + 0.5) % Number.MAX_SAFE_INTEGER;
  };

  const drawingAnimation = () => {
    const handler = () => {
      drawCircles();
      requestAnimationFrame(handler);
    };
    requestAnimationFrame(handler);
  };

  initCanvas();
  drawingAnimation();
};
