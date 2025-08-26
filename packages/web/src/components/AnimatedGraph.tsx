import { useEffect, useRef } from 'react';

export function AnimatedGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Animation variables
    let animationId: number;
    let time = 0;

    // Node properties
    const nodes = Array.from({ length: 12 }, (_, i) => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 3 + 2,
      color: `hsl(${Math.random() * 60 + 120}, 70%, 60%)`, // Green-ish colors
      priority: Math.random(),
    }));

    // Connections between nodes
    const connections: Array<[number, number]> = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() < 0.3) { // 30% chance of connection
          connections.push([i, j]);
        }
      }
    }

    const animate = () => {
      time += 0.01;
      
      // Clear canvas
      ctx.fillStyle = 'rgba(17, 24, 39, 0.1)'; // Very transparent dark overlay for fade effect
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Update node positions
      nodes.forEach((node, i) => {
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off edges
        if (node.x <= node.radius || node.x >= canvas.offsetWidth - node.radius) {
          node.vx *= -1;
        }
        if (node.y <= node.radius || node.y >= canvas.offsetHeight - node.radius) {
          node.vy *= -1;
        }

        // Keep within bounds
        node.x = Math.max(node.radius, Math.min(canvas.offsetWidth - node.radius, node.x));
        node.y = Math.max(node.radius, Math.min(canvas.offsetHeight - node.radius, node.y));

        // Animate priority (affects size and brightness)
        node.priority = 0.5 + 0.3 * Math.sin(time + i * 0.5);
      });

      // Draw connections first (so they appear behind nodes)
      connections.forEach(([i, j]) => {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        const distance = Math.sqrt((nodeA.x - nodeB.x) ** 2 + (nodeA.y - nodeB.y) ** 2);
        const opacity = Math.max(0, 1 - distance / 200) * 0.3;

        ctx.strokeStyle = `rgba(34, 197, 94, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nodeA.x, nodeA.y);
        ctx.lineTo(nodeB.x, nodeB.y);
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach((node) => {
        const size = node.radius * (0.5 + node.priority * 0.5);
        const opacity = 0.6 + node.priority * 0.4;

        // Outer glow
        ctx.shadowColor = 'rgba(34, 197, 94, 0.5)';
        ctx.shadowBlur = size * 2;

        // Node
        ctx.fillStyle = `rgba(34, 197, 94, ${opacity})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Inner highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
        ctx.beginPath();
        ctx.arc(node.x - size * 0.3, node.y - size * 0.3, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: 'transparent' }}
    />
  );
}